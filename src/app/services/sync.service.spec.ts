import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { fakeAuth, fakeLocation, fakeWeather, PHOTO } from '../../testing/test-helpers';
import { ApiError } from '../api/api-error';
import type { ApiConfig } from '../api/api.config';
import { API_CONFIG } from '../api/api.config';
import type { RemoteSnapshot } from '../api/task-api.service';
import { TaskApiService } from '../api/task-api.service';
import type { Task } from '../task.model';

import { NetworkService } from './network.service';
import { SyncService } from './sync.service';
import { TaskService } from './task.service';

const remoteTask: Task = {
  id: 500,
  title: 'Creada en otro celular',
  description: 'remota',
  createdAt: new Date('2026-11-18T09:00:00.000Z'),
  updatedAt: new Date('2026-11-18T09:00:00.000Z'),
};

// Sincronización con una API falsa: se prueba el flujo completo (traer, mezclar,
// enviar), los estados que ve el usuario y el manejo de fallas de red.
describe('SyncService', () => {
  function setup({
    online = true,
    user = 'ana' as string | null,
    remote = [] as Task[],
    deleted = [] as number[],
  } = {}) {
    const api = {
      getTasks: vi.fn(async (): Promise<RemoteSnapshot> => ({ tasks: remote, deleted, version: 3 })),
      putTasks: vi.fn(async (_tasks: readonly Task[], _deleted: readonly number[], _version: number) => 4),
    };
    const reconnect: (() => void)[] = [];
    const network = { online: signal(online), onReconnect: (handler: () => void) => reconnect.push(handler) };
    const auth = fakeAuth(user);
    TestBed.configureTestingModule({
      providers: [
        auth.provider,
        fakeLocation(null),
        fakeWeather(null),
        { provide: TaskApiService, useValue: api },
        { provide: NetworkService, useValue: network },
        {
          provide: API_CONFIG,
          useValue: { syncDebounceMs: 5, pollMs: 0 } as ApiConfig,
        },
      ],
    });
    return {
      sync: TestBed.inject(SyncService),
      tasks: TestBed.inject(TaskService),
      api,
      network,
      auth,
      reconnect: () => reconnect.forEach((handler) => handler()),
    };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('trae, mezcla y envía: queda "Sincronizado" con la hora', async () => {
    const { sync, tasks, api } = setup({ remote: [remoteTask] });
    await tasks.load();

    expect(await sync.sync()).toBe(true);

    expect(api.getTasks).toHaveBeenCalledTimes(1);
    // Envía lo mezclado (la remota, creada a las 09:00, + las 2 de ejemplo, creadas ahora),
    // ordenado por fecha de creación y con la versión leída
    const [sent, , version] = api.putTasks.mock.calls[0];
    expect(sent.map((task) => task.id)).toEqual([500, 1, 2]);
    expect(version).toBe(3);
    expect(sync.state().status).toBe('synced');
    expect(sync.state().lastSync).toBeInstanceOf(Date);
    // La tarea del otro dispositivo ya está en la lista local
    expect(tasks.tasks().some((task) => task.title === 'Creada en otro celular')).toBe(true);
  });

  it('borra localmente lo que se borró en otro dispositivo', async () => {
    const { sync, tasks } = setup({ deleted: [1] });
    await tasks.load();
    await sync.sync();
    expect(tasks.tasks().map((task) => task.id)).toEqual([2]);
  });

  it('informa al servidor los borrados locales y los olvida al confirmarse', async () => {
    const { sync, tasks, api } = setup();
    await tasks.load();
    await tasks.remove(1);
    await sync.sync();
    expect(api.putTasks.mock.calls[0][1]).toEqual([1]);
    expect(tasks.snapshot().deleted).toEqual([]);
  });

  it('sin conexión no intenta enviar: queda "offline" y sincroniza al volver la red', async () => {
    const { sync, tasks, api, network, reconnect } = setup({ online: false });
    await tasks.load();

    expect(await sync.sync()).toBe(false);
    expect(api.getTasks).not.toHaveBeenCalled();
    expect(sync.state().status).toBe('offline');

    network.online.set(true);
    reconnect();
    await vi.waitFor(() => expect(sync.state().status).toBe('synced'));
  });

  it('si el servidor falla, muestra el error y las tareas siguen guardadas en el dispositivo', async () => {
    const { sync, tasks, api } = setup();
    api.getTasks.mockRejectedValue(new ApiError('server', 'Error del servidor (500).'));
    await tasks.add('No se pierde', 'aunque falle el servidor');

    expect(await sync.sync()).toBe(false);
    expect(sync.state()).toMatchObject({ status: 'error', message: 'Error del servidor (500).' });
    expect(tasks.tasks().some((task) => task.title === 'No se pierde')).toBe(true);
  });

  it('si el servidor no responde (sin red), queda "offline" con su mensaje', async () => {
    const { sync, tasks, api } = setup();
    api.getTasks.mockRejectedValue(new ApiError('offline', 'Sin conexión con el servidor.'));
    await tasks.load();
    await sync.sync();
    expect(sync.state()).toMatchObject({ status: 'offline', message: 'Sin conexión con el servidor.' });
  });

  it('conflicto (412): vuelve a leer, mezcla y reenvía una vez', async () => {
    const { sync, tasks, api } = setup();
    api.putTasks.mockRejectedValueOnce(new ApiError('conflict', 'Los datos cambiaron'));
    await tasks.load();
    expect(await sync.sync()).toBe(true);
    expect(api.getTasks).toHaveBeenCalledTimes(2);
    expect(api.putTasks).toHaveBeenCalledTimes(2);
  });

  it('agrupa varios cambios seguidos en un solo envío (debounce)', async () => {
    const { sync, tasks, api } = setup();
    await tasks.add('Uno', 'a');
    await tasks.add('Dos', 'b');
    await tasks.add('Tres', 'c');
    TestBed.tick(); // ejecuta el effect que observa los cambios
    expect(sync.state().status).toBe('pending');

    await vi.waitFor(() => expect(sync.state().status).toBe('synced'));
    expect(api.putTasks).toHaveBeenCalledTimes(1);
  });

  it('las fotos no salen del dispositivo: TaskApiService recibe la tarea y la envía sin foto', async () => {
    const { sync, tasks, api } = setup();
    await tasks.add('Con foto', 'privada', PHOTO);
    await sync.sync();
    // SyncService entrega la tarea completa; TaskApiService.putTasks quita la foto al serializar
    // (probado en task-api.service.spec). Aquí se verifica que la foto sigue en el dispositivo.
    expect(api.putTasks).toHaveBeenCalled();
    expect(tasks.tasks().at(-1)?.photo).toBe(PHOTO);
  });

  it('sin sesión no sincroniza', async () => {
    const { sync, api } = setup({ user: null });
    expect(await sync.sync()).toBe(false);
    expect(api.getTasks).not.toHaveBeenCalled();
  });

  it('reset() (al cerrar sesión) vuelve al estado inicial', async () => {
    const { sync, tasks } = setup();
    await tasks.load();
    await sync.sync();
    sync.reset();
    expect(sync.state()).toMatchObject({ status: 'idle', lastSync: null });
  });
});
