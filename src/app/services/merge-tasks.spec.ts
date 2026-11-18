import type { Task } from '../task.model';

import { mergeTasks } from './merge-tasks';

/** Tarea de prueba: `minute` define createdAt, `edited` define updatedAt */
function task(id: number, title: string, minute = id, edited = minute, extra: Partial<Task> = {}): Task {
  return {
    id,
    title,
    description: 'desc',
    createdAt: new Date(2026, 10, 18, 12, minute),
    updatedAt: new Date(2026, 10, 18, 12, edited),
    ...extra,
  };
}

// La mezcla decide qué queda en cada dispositivo después de sincronizar
describe('mergeTasks', () => {
  it('une las tareas de ambos lados', () => {
    const merged = mergeTasks([task(1, 'local')], [task(2, 'remota')], new Set());
    expect(merged.map((t) => t.title)).toEqual(['local', 'remota']);
  });

  it('si la misma tarea cambió en los dos lados, gana la edición más reciente', () => {
    const local = [task(1, 'editada aquí', 1, 30)];
    const remote = [task(1, 'editada en otro celular', 1, 10)];
    expect(mergeTasks(local, remote, new Set())[0].title).toBe('editada aquí');
    expect(mergeTasks(remote, local, new Set())[0].title).toBe('editada aquí');
  });

  it('quita las tareas borradas en cualquier dispositivo', () => {
    const merged = mergeTasks([task(1, 'a'), task(2, 'b')], [task(3, 'c')], new Set([2, 3]));
    expect(merged.map((t) => t.id)).toEqual([1]);
  });

  it('conserva la foto local aunque gane la versión remota (las fotos no viajan)', () => {
    const photo = 'data:image/jpeg;base64,AAAA';
    const local = [task(1, 'vieja', 1, 1, { photo })];
    const remote = [task(1, 'nueva', 1, 20)];
    const [merged] = mergeTasks(local, remote, new Set());
    expect(merged.title).toBe('nueva');
    expect(merged.photo).toBe(photo);
  });

  it('ordena por fecha de creación', () => {
    const merged = mergeTasks([task(3, 'tercera')], [task(1, 'primera'), task(2, 'segunda')], new Set());
    expect(merged.map((t) => t.title)).toEqual(['primera', 'segunda', 'tercera']);
  });

  it('no modifica las listas originales (función pura)', () => {
    const local = [task(1, 'a')];
    const remote = [task(1, 'b', 1, 50)];
    mergeTasks(local, remote, new Set());
    expect(local[0].title).toBe('a');
    expect(remote[0].title).toBe('b');
  });
});
