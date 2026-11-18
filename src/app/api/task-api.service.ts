import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Task } from '../task.model';
import { parseTasks, toStoredTask } from '../task.model';

import { ApiError, toApiError } from './api-error';
import { API_CONFIG } from './api.config';

/** Lo que guarda el servidor de cada usuario */
export interface RemoteSnapshot {
  tasks: Task[];
  /** Ids borrados en algún dispositivo (para borrarlos también en los demás) */
  deleted: number[];
  /** Versión de los datos: cambia con cada escritura (control de concurrencia) */
  version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** Valida la respuesta del servidor: nunca se confía en datos externos */
export function parseSnapshot(body: unknown): RemoteSnapshot {
  if (!isRecord(body) || !Array.isArray(body['tasks']) || !isVersion(body['version'])) {
    throw new ApiError('invalid', 'El servidor respondió datos no válidos.');
  }
  const deleted = Array.isArray(body['deleted'])
    ? body['deleted'].filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
    : [];
  // Las fotos nunca vienen del servidor: si llegara alguna, se ignora
  const tasks = parseTasks(body['tasks']).map(({ photo: _photo, ...task }) => task);
  return { tasks, deleted, version: body['version'] };
}

/*
 * Cliente de la API propia de sincronización (carpeta api/ del proyecto).
 *   GET /api/tasks  → tareas del usuario + versión
 *   PUT /api/tasks  → reemplaza las tareas (con If-Match: versión leída)
 * La llave del usuario la agrega authInterceptor; timeout y reintentos,
 * resilienceInterceptor. Este servicio sólo arma la petición y valida la respuesta.
 */
@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  async getTasks(): Promise<RemoteSnapshot> {
    try {
      const body = await firstValueFrom(this.http.get<unknown>(`${this.config.baseUrl}/tasks`));
      return parseSnapshot(body);
    } catch (error) {
      throw toApiError(error);
    }
  }

  /**
   * Envía todas las tareas. Las fotos NO se envían (privacidad y datos móviles).
   * If-Match: si otro dispositivo escribió entre medio, el servidor responde 412
   * y SyncService vuelve a leer y mezclar antes de reenviar.
   */
  async putTasks(tasks: readonly Task[], deleted: readonly number[], version: number): Promise<number> {
    const body = { tasks: tasks.map((task) => toStoredTask(task, false)), deleted };
    try {
      const response = await firstValueFrom(
        this.http.put<unknown>(`${this.config.baseUrl}/tasks`, body, { headers: { 'If-Match': `"${version}"` } }),
      );
      if (!isRecord(response) || !isVersion(response['version'])) {
        throw new ApiError('invalid', 'El servidor respondió datos no válidos.');
      }
      return response['version'];
    } catch (error) {
      throw toApiError(error);
    }
  }
}
