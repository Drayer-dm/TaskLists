import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { AUTH_CONFIG, AuthService, LOCK_MS, MAX_FAILED_LOGINS } from './auth.service';

// Pruebas del login local (multiusuario). Preferences guarda en localStorage en
// las pruebas y en el almacenamiento de la app en Android.
describe('AuthService', () => {
  /** Servicio nuevo, como si se cerrara y abriera la app. Menos iteraciones = pruebas rápidas. */
  function freshService(): AuthService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AUTH_CONFIG, useValue: { iterations: 1_000 } }] });
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registra un usuario y deja la sesión abierta', async () => {
    const auth = freshService();
    expect(await auth.register('Ana', 'clave-segura')).toEqual({ ok: true });
    // El nombre se normaliza a minúsculas
    expect(auth.user()).toBe('ana');
  });

  it('no guarda la contraseña: sólo un hash con sal', async () => {
    await freshService().register('ana', 'clave-segura');
    const { value } = await Preferences.get({ key: 'users' });
    expect(value).not.toContain('clave-segura');
    const [user] = JSON.parse(value!);
    expect(user.hash).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(user.salt).toBeTruthy();
  });

  it('dos usuarios con la misma contraseña tienen hashes distintos (sal aleatoria)', async () => {
    const auth = freshService();
    await auth.register('ana', 'misma-clave');
    await auth.register('pedro', 'misma-clave');
    const [ana, pedro] = JSON.parse((await Preferences.get({ key: 'users' })).value!);
    expect(ana.hash).not.toBe(pedro.hash);
  });

  it('valida el usuario y el largo mínimo de la contraseña', async () => {
    const auth = freshService();
    expect((await auth.register('a', 'clave-segura')).ok).toBe(false);
    expect((await auth.register('con espacio', 'clave-segura')).ok).toBe(false);
    expect((await auth.register('<script>', 'clave-segura')).ok).toBe(false);
    expect(await auth.register('ana', 'corta')).toEqual({
      ok: false,
      error: 'La contraseña debe tener al menos 8 caracteres.',
    });
    expect(auth.user()).toBeNull();
  });

  it('no permite registrar dos veces el mismo usuario', async () => {
    const auth = freshService();
    await auth.register('ana', 'clave-segura');
    expect((await auth.register('ANA', 'otra-clave-1')).ok).toBe(false);
  });

  it('inicia sesión con la contraseña correcta', async () => {
    await freshService().register('ana', 'clave-segura');
    const auth = freshService();
    expect(await auth.login('ana', 'clave-segura')).toEqual({ ok: true });
    expect(auth.user()).toBe('ana');
  });

  it('con contraseña incorrecta o usuario inexistente da el MISMO mensaje genérico', async () => {
    await freshService().register('ana', 'clave-segura');
    const auth = freshService();
    const wrongPassword = await auth.login('ana', 'incorrecta');
    const unknownUser = await auth.login('nadie', 'clave-segura');
    expect(wrongPassword).toEqual({ ok: false, error: 'Usuario o contraseña incorrectos.' });
    expect(unknownUser).toEqual(wrongPassword);
    expect(auth.user()).toBeNull();
  });

  it(`bloquea el inicio de sesión tras ${MAX_FAILED_LOGINS} intentos fallidos`, async () => {
    await freshService().register('ana', 'clave-segura');
    const auth = freshService();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await auth.login('ana', 'incorrecta');
    }
    // Ni siquiera la contraseña correcta entra mientras dura el bloqueo
    const locked = await auth.login('ana', 'clave-segura');
    expect(locked.ok).toBe(false);
    expect(!locked.ok && locked.error).toContain('Demasiados intentos');

    // Pasado el bloqueo, vuelve a funcionar
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + LOCK_MS + 1);
    expect(await auth.login('ana', 'clave-segura')).toEqual({ ok: true });
  });

  it('la sesión sigue abierta al volver a abrir la app', async () => {
    await freshService().register('ana', 'clave-segura');
    const reopened = freshService();
    expect(reopened.user()).toBeNull();
    await reopened.restore();
    expect(reopened.user()).toBe('ana');
  });

  it('cerrar sesión borra la sesión del dispositivo', async () => {
    const auth = freshService();
    await auth.register('ana', 'clave-segura');
    await auth.logout();
    expect(auth.user()).toBeNull();
    expect(auth.syncKey()).toBeNull();

    const reopened = freshService();
    await reopened.restore();
    expect(reopened.user()).toBeNull();
  });

  it('la llave de la API se deriva igual en cualquier dispositivo y no es la contraseña ni el hash', async () => {
    const auth = freshService();
    await auth.register('ana', 'clave-segura');
    const key = auth.syncKey();
    const [user] = JSON.parse((await Preferences.get({ key: 'users' })).value!);
    expect(key).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(key).not.toBe(user.hash);
    expect(key).not.toContain('clave-segura');

    // "Otro dispositivo": mismo usuario y contraseña → misma llave
    localStorage.clear();
    const other = freshService();
    await other.register('ana', 'clave-segura');
    expect(other.syncKey()).toBe(key);
  });

  it('descarta una sesión dañada o vencida', async () => {
    await Preferences.set({ key: 'session', value: '{no es json' });
    const damaged = freshService();
    await damaged.restore();
    expect(damaged.user()).toBeNull();

    const old = { username: 'ana', syncKey: 'k', since: '2020-01-01T00:00:00.000Z' };
    await Preferences.set({ key: 'session', value: JSON.stringify(old) });
    const expired = freshService();
    await expired.restore();
    expect(expired.user()).toBeNull();
  });
});
