import { inject, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import type { Task } from '../task.model';
import { TASK_LIMITS } from '../task.model';

import { LocationService } from './location.service';

//Clave con la que se guardan las tareas
const STORAGE_KEY = 'tasks';

//Asi queda una tarea almacenada
type StoredTask = Omit<Task, 'createdAt'> & {
  createdAt: string;
};

//Tareas q se muestran la primera vez
function exampleTasks(): Task[] {
  const now = new Date();
  return [
    { id: 1, title: 'Ejemplo', description: 'Esta es una tarjeta de Ejemplo!', createdAt: now },
    {
      id: 2,
      title: '¿Cómo crear una tarea?',
      description: 'Escribe un título y una descripción en "Nueva tarea" y presiona Agregar tarea.',
      createdAt: now,
    },
  ];
}

//Limpiar los textos sin espacios a los lados
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

/*Servicio patron de tareas / repository
 * Es el único lugar que sabe dónde y cómo se guardan las tareas. La página sólo
 * lee `tasks` y llama a add() / update() / remove(). Cuando agreguemos GPS, foto
 * o la API, el cambio se hace aquí y la página casi no se toca.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  //signal cambia el angular solo redibuja
  private readonly store = signal<Task[]>([]);

  readonly tasks = this.store.asReadonly();

  private loading?: Promise<void>;

  // GPS: lo usa add() para guardar dónde se creó cada tarea
  private readonly locationService = inject(LocationService);

  // ??= : sólo lee el almacenamiento la primera vez; las siguientes reutiliza la misma promesa
  load(): Promise<void> {
    this.loading ??= this.readFromStorage();
    return this.loading;
  }

  async add(title: string, description: string): Promise<boolean> {
    await this.load();
    const texts = cleanTexts(title, description);
    if (!texts) {
      return false;
    }

    // Ubicación actual (null si no hay permiso o el GPS no respondió)
    const location = await this.locationService.getCurrentLocation();

    const task: Task = { id: this.nextId(), ...texts, createdAt: new Date() };
    if (location) {
      task.location = location;
    }
    this.store.update((tasks) => [...tasks, task]);
    await this.save();
    return true;
  }

  async update(id: number, title: string, description: string): Promise<boolean> {
    await this.load();
    const texts = cleanTexts(title, description);
    if (!texts) {
      return false;
    }
    this.store.update((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...texts } : task)));
    await this.save();
    return true;
  }

  async remove(id: number): Promise<void> {
    await this.load();
    this.store.update((tasks) => tasks.filter((task) => task.id !== id));
    await this.save();
  }

  private async readFromStorage(): Promise<void> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    // null = nunca se guardó nada (primera vez) → tareas de ejemplo.
    // "[]" = el usuario borró todas → se respeta la lista vacía.
    if (value === null) {
      this.store.set(exampleTasks());
      return;
    }
    try {
      const stored = JSON.parse(value) as StoredTask[];
      //la fecha volvio como texto: se convierte a Date de nuevo
      this.store.set(stored.map((task) => ({ ...task, createdAt: new Date(task.createdAt) })));
    } catch {
      // Datos dañados (JSON inválido): se parte con la lista vacía en vez de romper la app
      this.store.set([]);
    }
  }

  private async save(): Promise<void> {
    // JSON.stringify convierte cada Date en texto ("2026-11-17T12:00:00.000Z")
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(this.store()) });
  }

  /** Id único: el instante actual, o uno más que el mayor si dos tareas caen en el mismo milisegundo */
  private nextId(): number {
    const maxId = Math.max(0, ...this.store().map((task) => task.id));
    return Math.max(Date.now(), maxId + 1);
  }
}
