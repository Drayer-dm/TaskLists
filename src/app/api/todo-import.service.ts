import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { TaskDraft } from '../task.model';
import { TASK_LIMITS } from '../task.model';

import { ApiError, toApiError } from './api-error';

/** API pública de tareas de ejemplo (HTTPS, sin llave): https://dummyjson.com/docs/todos */
export const TODOS_URL = 'https://dummyjson.com/todos';
/** Cuántas tareas trae cada importación */
export const IMPORT_BATCH = 5;
/** DummyJSON tiene 254 tareas: al llegar al final se vuelve al principio */
const TOTAL_TODOS = 250;

interface DummyTodo {
  id: number;
  todo: string;
  completed: boolean;
}

function isDummyTodo(value: unknown): value is DummyTodo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { id, todo, completed } = value as Record<string, unknown>;
  return Number.isInteger(id) && typeof todo === 'string' && typeof completed === 'boolean';
}

/** Caracteres de control (saltos de línea, tabulaciones, NUL...) */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Limpia texto externo: sin caracteres de control, espacios simples y largo máximo */
export function sanitizeText(text: string, max: number): string {
  const clean = text.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Tarea de DummyJSON → borrador de tarea de TaskList */
export function toDraft(todo: DummyTodo): TaskDraft {
  return {
    title: sanitizeText(todo.todo, TASK_LIMITS.title),
    description: `Importada desde DummyJSON · ${todo.completed ? 'completada' : 'pendiente'}`,
    externalId: todo.id,
  };
}

/*
 * Importación de tareas desde una API externa.
 * Pide sólo los campos necesarios (select) y de a 5 (limit/skip: paginación),
 * valida cada elemento y descarta los que no tengan la forma esperada.
 */
@Injectable({ providedIn: 'root' })
export class TodoImportService {
  private readonly http = inject(HttpClient);

  /** Trae el siguiente grupo de tareas, a partir de la última importada */
  async fetchDrafts(lastImportedId = 0): Promise<TaskDraft[]> {
    const params = new HttpParams()
      .set('limit', IMPORT_BATCH)
      .set('skip', lastImportedId % TOTAL_TODOS)
      .set('select', 'todo,completed');
    let body: unknown;
    try {
      body = await firstValueFrom(this.http.get<unknown>(TODOS_URL, { params }));
    } catch (error) {
      throw toApiError(error);
    }
    const todos = (body as { todos?: unknown } | null)?.todos;
    if (!Array.isArray(todos)) {
      throw new ApiError('invalid', 'La API de tareas respondió datos no válidos.');
    }
    return todos
      .filter(isDummyTodo)
      .map(toDraft)
      .filter((draft) => draft.title !== '');
  }
}
