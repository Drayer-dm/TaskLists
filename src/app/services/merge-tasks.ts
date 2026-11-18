import type { Task } from '../task.model';

/**
 * Mezcla las tareas del dispositivo con las del servidor (sincronización en dos sentidos).
 * - Una tarea que está en un solo lado se conserva (la creó este u otro dispositivo).
 * - Si está en ambos, gana la versión con `updatedAt` más reciente (last-write-wins).
 * - Los ids borrados (en cualquier dispositivo) se quitan.
 * - La foto vive sólo en este dispositivo: se conserva aunque gane la versión remota.
 * Es una función pura (sin efectos): fácil de probar caso por caso.
 */
export function mergeTasks(local: readonly Task[], remote: readonly Task[], deleted: ReadonlySet<number>): Task[] {
  const merged = new Map<number, Task>();
  for (const task of local) {
    if (!deleted.has(task.id)) {
      merged.set(task.id, task);
    }
  }
  for (const task of remote) {
    if (deleted.has(task.id)) {
      continue;
    }
    const mine = merged.get(task.id);
    if (!mine) {
      merged.set(task.id, task);
    } else if (task.updatedAt.getTime() > mine.updatedAt.getTime()) {
      merged.set(task.id, mine.photo ? { ...task, photo: mine.photo } : task);
    }
  }
  return [...merged.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
}
