import { computed, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/** Iteraciones de PBKDF2: hacen lento (a propósito) adivinar contraseñas por fuerza bruta */
export const AUTH_CONFIG = new InjectionToken<{ iterations: number }>('AuthConfig', {
  providedIn: 'root',
  factory: () => ({ iterations: 100_000 }),
});

const USERS_KEY = 'users';
const SESSION_KEY = 'session';
const SESSION_DAYS = 30;

/** 3 a 20 caracteres: letras minúsculas, números, punto, guion y guion bajo */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;
export const PASSWORD_MIN_LENGTH = 8;
/** Tras 5 intentos fallidos seguidos, el inicio de sesión se bloquea 30 segundos */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 30_000;

/** Usuario guardado: la contraseña NUNCA se guarda, sólo su hash con sal */
interface StoredUser {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

/** Sesión abierta. syncKey es la llave para la API (derivada de la contraseña, no es la contraseña) */
interface Session {
  username: string;
  syncKey: string;
  since: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

const encoder = new TextEncoder();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

/** PBKDF2-SHA256 (Web Crypto, estándar del navegador): contraseña + sal → hash de 256 bits */
async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toBase64(bits);
}

/** Compara sin cortar en la primera diferencia (no filtra pistas por el tiempo de respuesta) */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Valida el formulario de registro. Devuelve el mensaje de error o null si está bien. */
export function validateCredentials(username: string, password: string): string | null {
  if (!USERNAME_PATTERN.test(normalizeUsername(username))) {
    return 'El usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { username, syncKey, since } = value as Record<string, unknown>;
  return typeof username === 'string' && typeof syncKey === 'string' && typeof since === 'string';
}

/*
 * Autenticación básica y multiusuario, 100 % en el dispositivo (funciona sin internet).
 * - Cada usuario tiene su propia lista de tareas (TaskService usa su nombre en la clave).
 * - Contraseña: se guarda sólo el hash PBKDF2 con sal aleatoria.
 * - Mensaje de error genérico ("usuario o contraseña incorrectos") y bloqueo
 *   temporal tras varios intentos fallidos.
 * - Para la API se deriva otra llave (syncKey) con otra sal: el servidor nunca
 *   recibe la contraseña ni el hash local.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(AUTH_CONFIG);
  private readonly session = signal<Session | null>(null);

  /** Usuario con sesión abierta (null = nadie) */
  readonly user = computed(() => this.session()?.username ?? null);
  /** Llave de la API del usuario actual */
  readonly syncKey = computed(() => this.session()?.syncKey ?? null);

  private restoring?: Promise<void>;
  private failedLogins = 0;
  private lockedUntil = 0;

  /** Recupera la sesión guardada (al abrir la app). Sólo lee el almacenamiento una vez. */
  restore(): Promise<void> {
    this.restoring ??= this.readSession();
    return this.restoring;
  }

  async register(username: string, password: string): Promise<AuthResult> {
    const error = validateCredentials(username, password);
    if (error) {
      return { ok: false, error };
    }
    const name = normalizeUsername(username);
    const users = await this.readUsers();
    if (users.some((user) => user.username === name)) {
      return { ok: false, error: 'Ese nombre de usuario ya existe en este dispositivo.' };
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt, this.config.iterations);
    users.push({ username: name, salt: toBase64(salt), hash, createdAt: new Date().toISOString() });
    await Preferences.set({ key: USERS_KEY, value: JSON.stringify(users) });
    await this.startSession(name, password);
    return { ok: true };
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const remaining = this.lockedUntil - Date.now();
    if (remaining > 0) {
      return { ok: false, error: `Demasiados intentos fallidos. Espera ${Math.ceil(remaining / 1000)} s.` };
    }
    const name = normalizeUsername(username);
    const user = (await this.readUsers()).find((stored) => stored.username === name);
    // Si el usuario no existe se calcula igual un hash: así tarda lo mismo y no revela qué usuarios existen
    const salt = user ? fromBase64(user.salt) : crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt, this.config.iterations);

    if (!user || !safeEqual(hash, user.hash)) {
      this.failedLogins++;
      if (this.failedLogins >= MAX_FAILED_LOGINS) {
        this.failedLogins = 0;
        this.lockedUntil = Date.now() + LOCK_MS;
      }
      return { ok: false, error: 'Usuario o contraseña incorrectos.' };
    }
    this.failedLogins = 0;
    await this.startSession(name, password);
    return { ok: true };
  }

  /** Cierra la sesión: borra la sesión (y su llave) del dispositivo */
  async logout(): Promise<void> {
    this.session.set(null);
    await Preferences.remove({ key: SESSION_KEY });
  }

  private async startSession(username: string, password: string): Promise<void> {
    // Llave para la API: misma contraseña + sal fija por usuario → la misma llave en cualquier dispositivo
    const syncKey = await pbkdf2(password, encoder.encode(`tasklist-sync:${username}`), this.config.iterations);
    const session: Session = { username, syncKey, since: new Date().toISOString() };
    this.session.set(session);
    await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) });
  }

  private async readSession(): Promise<void> {
    const { value } = await Preferences.get({ key: SESSION_KEY });
    if (!value) {
      return;
    }
    try {
      const session: unknown = JSON.parse(value);
      const expired = isSession(session) && Date.now() - new Date(session.since).getTime() > SESSION_DAYS * 86_400_000;
      if (isSession(session) && !expired) {
        this.session.set(session);
        return;
      }
    } catch {
      // sesión dañada: se descarta
    }
    await Preferences.remove({ key: SESSION_KEY });
  }

  private async readUsers(): Promise<StoredUser[]> {
    const { value } = await Preferences.get({ key: USERS_KEY });
    try {
      const users: unknown = value ? JSON.parse(value) : [];
      return Array.isArray(users) ? (users as StoredUser[]) : [];
    } catch {
      return [];
    }
  }
}
