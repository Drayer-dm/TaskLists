import { inject, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { WeatherService } from '../api/weather.service';
import type { Task, TaskDraft, TaskLocation } from '../task.model';
import { isImageDataUrl, parseTasks, TASK_LIMITS, toStoredTask } from '../task.model';

import { AuthService } from './auth.service';
import { LocationService } from './location.service';
import { mergeTasks } from './merge-tasks';

// Claves con las que se guardan las tareas: una lista por usuario ("tasks:ana", "tasks:pedro")
const TASKS_PREFIX = 'tasks:';
// Ids borrados que aún no se informan al servidor
const DELETED_PREFIX = 'tasks-deleted:';

// Tareas que se muestran la primera vez.
// updatedAt = 1970: cualquier edición real (de este u otro dispositivo) gana al sincronizar.
function exampleTasks(): Task[] {
  const now = new Date();
  const old = new Date(0);
  return [
    { id: 1, title: 'Ejemplo', description: 'Esta es una tarjeta de Ejemplo!', createdAt: now, updatedAt: old },
    {
      id: 2,
      title: '¿Cómo crear una tarea?',
      description: 'Escribe un título y una descripción en "Nueva tarea" y presiona Agregar tarea.',
      createdAt: now,
      updatedAt: old,
    },
  ];
}

// Limpiar los textos sin espacios a los lados
// Devuelve null si el título O la descripción quedan vacíos (los dos son obligatorios)
function cleanTexts(
  title: string,
  description: string,
): {
  title: string;
  description: string;
} | null {
  const cleanTitle = title.trim().slice(0, TASK_LIMITS.title);
  const cleanDescription = description.trim().slice(0, TASK_LIMITS.description);
  if (!cleanTitle || !cleanDescription) {
    return null;
  }
  return { title: cleanTitle, description: cleanDescription };
}

function parseIds(value: string | null): number[] {
  try {
    const ids: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

/* Servicio de tareas (patrón Repository)
 * Es el único lugar que sabe dónde y cómo se guardan las tareas. La página sólo
 * lee `tasks` y llama a add() / update() / remove(). GPS, foto, clima y la
 * sincronización se conectan aquí; la página casi no cambia.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly auth = inject(AuthService);
  // GPS: lo usa add() para guardar dónde se creó cada tarea
  private readonly locationService = inject(LocationService);
  // API del clima: dato adicional de cada tarea
  private readonly weatherService = inject(WeatherService);

  // signal: cuando cambia, Angular redibuja solo
  private readonly store = signal<Task[]>([]);
  readonly tasks = this.store.asReadonly();

  /** Sube con cada cambio hecho en este dispositivo: SyncService lo observa para sincronizar */
  private readonly changeCount = signal(0);
  readonly changes = this.changeCount.asReadonly();

  private deleted: number[] = [];
  private loadedUser: string | null = null;
  private loading: Promise<void> = Promise.resolve();

  /** Carga las tareas del usuario con sesión. Si es el mismo usuario, reutiliza la carga anterior. */
  load(): Promise<void> {
    const user = this.auth.user();
    if (user !== this.loadedUser) {
      this.loadedUser = user;
      this.deleted = [];
      this.store.set([]);
      this.loading = user ? this.readFromStorage(user) : Promise.resolve();
    }
    return this.loading;
  }

  /** Al cerrar sesión: se vacía la lista en memoria (la del dispositivo queda guardada) */
  clear(): void {
    this.loadedUser = null;
    this.deleted = [];
    this.store.set([]);
    this.loading = Promise.resolve();
  }

  async add(title: string, description: string, photo?: string): Promise<boolean> {
    await this.load();
    const texts = cleanTexts(title, description);
    if (!texts) {
      return false;
    }

    // Ubicación actual (null si no hay permiso o el GPS no respondió)
    const location = await this.locationService.getCurrentLocation();

    const now = new Date();
    const task: Task = { id: this.nextId(), ...texts, createdAt: now, updatedAt: now };
    if (location) {
      task.location = location;
    }
    if (photo && isImageDataUrl(photo)) {
      task.photo = photo;
    }
    this.store.update((tasks) => [...tasks, task]);
    await this.saveChange();

    // El clima se busca en segundo plano: la tarea aparece al tiro, sin esperar a la API
    if (location) {
      void this.attachWeather(task.id, location);
    }
    return true;
  }

  async update(id: number, title: string, description: string): Promise<boolean> {
    await this.load();
    const texts = cleanTexts(title, description);
    if (!texts) {
      return false;
    }
    const updatedAt = new Date();
    this.store.update((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...texts, updatedAt } : task)));
    await this.saveChange();
    return true;
  }

  /** Adjunta (o quita, con null) la foto de una tarea. La foto no se sincroniza. */
  async setPhoto(id: number, photo: string | null): Promise<void> {
    await this.load();
    if (photo !== null && !isImageDataUrl(photo)) {
      return;
    }
    this.store.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== id) {
          return task;
        }
        const { photo: _old, ...rest } = task;
        return photo ? { ...rest, photo } : rest;
      }),
    );
    await this.save();
  }

  async remove(id: number): Promise<void> {
    await this.load();
    this.store.update((tasks) => tasks.filter((task) => task.id !== id));
    // Se recuerda el id para borrarla también del servidor
    this.deleted = [...this.deleted, id];
    await this.saveChange();
  }

  /** Agrega tareas importadas desde una API. Salta las ya importadas. Devuelve cuántas agregó. */
  async importDrafts(drafts: readonly TaskDraft[]): Promise<number> {
    await this.load();
    const imported = new Set(this.store().map((task) => task.externalId));
    const now = new Date();
    let id = this.nextId();
    const fresh: Task[] = [];
    for (const draft of drafts) {
      const texts = cleanTexts(draft.title, draft.description);
      if (!texts || (draft.externalId !== undefined && imported.has(draft.externalId))) {
        continue;
      }
      const task: Task = { id: id++, ...texts, createdAt: now, updatedAt: now };
      if (draft.externalId !== undefined) {
        task.externalId = draft.externalId;
        imported.add(draft.externalId);
      }
      fresh.push(task);
    }
    if (fresh.length) {
      this.store.update((tasks) => [...tasks, ...fresh]);
      await this.saveChange();
    }
    return fresh.length;
  }

  /** Mayor id externo importado (para pedir a la API las siguientes) */
  lastImportedId(): number {
    return Math.max(0, ...this.store().map((task) => task.externalId ?? 0));
  }

  // ---- Sincronización (la usa SyncService) ----

  /** Mezcla lo que llegó del servidor con lo local y lo guarda */
  async applyRemote(remote: readonly Task[], remoteDeleted: readonly number[]): Promise<void> {
    await this.load();
    const deleted = new Set([...this.deleted, ...remoteDeleted]);
    this.store.set(mergeTasks(this.store(), remote, deleted));
    await this.save();
  }

  /** Lo que se envía al servidor */
  snapshot(): { tasks: Task[]; deleted: number[] } {
    return { tasks: this.store(), deleted: [...this.deleted] };
  }

  /** El servidor ya recibió estos borrados: se olvidan */
  async acknowledgeDeleted(ids: readonly number[]): Promise<void> {
    this.deleted = this.deleted.filter((id) => !ids.includes(id));
    await this.save();
  }

  // ---- Interno ----

  private async attachWeather(id: number, location: TaskLocation): Promise<void> {
    const user = this.loadedUser;
    const weather = await this.weatherService.getCurrent(location);
    // Si mientras tanto cambió el usuario o se borró la tarea, no se hace nada
    if (!weather || user !== this.loadedUser || !this.store().some((task) => task.id === id)) {
      return;
    }
    this.store.update((tasks) => tasks.map((task) => (task.id === id ? { ...task, weather } : task)));
    await this.saveChange();
  }

  private async readFromStorage(user: string): Promise<void> {
    const [{ value }, { value: deleted }] = await Promise.all([
      Preferences.get({ key: TASKS_PREFIX + user }),
      Preferences.get({ key: DELETED_PREFIX + user }),
    ]);
    if (user !== this.loadedUser) {
      return; // se cambió de usuario mientras se leía
    }
    this.deleted = parseIds(deleted);
    // null = nunca se guardó nada (primera vez) → tareas de ejemplo.
    // "[]" = el usuario borró todas → se respeta la lista vacía.
    if (value === null) {
      this.store.set(exampleTasks());
      return;
    }
    try {
      // parseTasks valida cada tarea (las fechas vuelven a ser Date)
      this.store.set(parseTasks(JSON.parse(value)));
    } catch {
      // Datos dañados (JSON inválido): se parte con la lista vacía en vez de romper la app
      this.store.set([]);
    }
  }

  /** Guarda y avisa que hubo un cambio local (para sincronizarlo) */
  private async saveChange(): Promise<void> {
    await this.save();
    this.changeCount.update((count) => count + 1);
  }

  private async save(): Promise<void> {
    const user = this.loadedUser;
    if (!user) {
      return;
    }
    // toStoredTask convierte cada Date en texto ("2026-11-17T12:00:00.000Z")
    await Promise.all([
      Preferences.set({ key: TASKS_PREFIX + user, value: JSON.stringify(this.store().map((t) => toStoredTask(t))) }),
      Preferences.set({ key: DELETED_PREFIX + user, value: JSON.stringify(this.deleted) }),
    ]);
  }

  /** Id único: el instante actual, o uno más que el mayor si dos tareas caen en el mismo milisegundo */
  private nextId(): number {
    const maxId = Math.max(0, ...this.store().map((task) => task.id));
    return Math.max(Date.now(), maxId + 1);
  }
}
