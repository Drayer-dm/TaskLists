import { TestBed } from '@angular/core/testing';

import { setupHttp, TEST_API } from '../../testing/http-testing';
import { PHOTO } from '../../testing/test-helpers';
import type { Task } from '../task.model';

import { ApiError } from './api-error';
import { parseSnapshot, TaskApiService } from './task-api.service';

const remoteTask = {
  id: 1,
  title: 'Remota',
  description: 'desde el servidor',
  createdAt: '2026-11-18T12:00:00.000Z',
  updatedAt: '2026-11-18T12:30:00.000Z',
};

function localTask(extra: Partial<Task> = {}): Task {
  return {
    id: 5,
    title: 'Local',
    description: 'con foto',
    createdAt: new Date('2026-11-18T10:00:00.000Z'),
    updatedAt: new Date('2026-11-18T10:00:00.000Z'),
    ...extra,
  };
}

// Cliente de la API propia: arma las peticiones correctas y valida las respuestas
describe('TaskApiService', () => {
  function setup() {
    const { backend } = setupHttp();
    return { api: TestBed.inject(TaskApiService), backend };
  }

  it('GET /tasks: convierte la respuesta en tareas (fechas como Date) con su versión', async () => {
    const { api, backend } = setup();
    const result = api.getTasks();
    const request = backend.expectOne(`${TEST_API}/tasks`);
    expect(request.request.method).toBe('GET');
    request.flush({ tasks: [remoteTask], deleted: [7], version: 3 });

    const snapshot = await result;
    expect(snapshot.version).toBe(3);
    expect(snapshot.deleted).toEqual([7]);
    expect(snapshot.tasks[0].updatedAt).toBeInstanceOf(Date);
    expect(snapshot.tasks[0].title).toBe('Remota');
  });

  it('descarta tareas inválidas y fotos que vinieran del servidor', () => {
    const snapshot = parseSnapshot({
      tasks: [{ ...remoteTask, photo: PHOTO }, { id: 'malo' }, { ...remoteTask, id: 2, title: '' }],
      deleted: [1, 'x'],
      version: 1,
    });
    expect(snapshot.tasks.length).toBe(1);
    expect(snapshot.tasks[0].photo).toBeUndefined();
    expect(snapshot.deleted).toEqual([1]);
  });

  it('rechaza una respuesta con forma inesperada (ApiError "invalid")', async () => {
    const { api, backend } = setup();
    const result = api.getTasks().catch((error: unknown) => error);
    backend.expectOne(`${TEST_API}/tasks`).flush({ hola: 'mundo' });
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('invalid');
  });

  it('PUT /tasks: envía If-Match con la versión leída y las tareas SIN fotos', async () => {
    const { api, backend } = setup();
    const result = api.putTasks([localTask({ photo: PHOTO })], [9], 3);
    const request = backend.expectOne(`${TEST_API}/tasks`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('If-Match')).toBe('"3"');
    expect(request.request.body.deleted).toEqual([9]);
    expect(request.request.body.tasks[0].photo).toBeUndefined();
    expect(request.request.body.tasks[0].createdAt).toBe('2026-11-18T10:00:00.000Z');
    expect(JSON.stringify(request.request.body)).not.toContain('base64');
    request.flush({ version: 4 });
    expect(await result).toBe(4);
  });

  it('412: avisa que hubo un conflicto (otro dispositivo escribió antes)', async () => {
    const { api, backend } = setup();
    const result = api.putTasks([], [], 1).catch((error: unknown) => error);
    backend.expectOne(`${TEST_API}/tasks`).flush({ version: 2 }, { status: 412, statusText: 'Precondition Failed' });
    expect(((await result) as ApiError).kind).toBe('conflict');
  });

  it('401: credenciales rechazadas con un mensaje para el usuario', async () => {
    const { api, backend } = setup();
    const result = api.getTasks().catch((error: unknown) => error);
    backend.expectOne(`${TEST_API}/tasks`).flush({}, { status: 401, statusText: 'Unauthorized' });
    const error = (await result) as ApiError;
    expect(error.kind).toBe('unauthorized');
    expect(error.message).toContain('contraseña');
  });

  it('500: error del servidor, sin exponer detalles internos', async () => {
    const { api, backend } = setup();
    const result = api.getTasks().catch((error: unknown) => error);
    backend
      .expectOne(`${TEST_API}/tasks`)
      .flush({ stack: 'Error en db.js:42' }, { status: 500, statusText: 'Internal Server Error' });
    const error = (await result) as ApiError;
    expect(error.kind).toBe('server');
    expect(error.message).toBe('Error del servidor (500).');
  });
});
