import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { CLOUDY, fakeAuth, fakeLocation, fakeWeather, PHOTO, SANTIAGO } from '../../testing/test-helpers';
import type { Task, TaskLocation, TaskWeather } from '../task.model';

import { TaskService } from './task.service';

// Pruebas del almacenamiento local: en el navegador (y en estas pruebas) Preferences
// guarda en localStorage; en Android usa SharedPreferences. El servicio es el mismo.
describe('TaskService', () => {
  /**
   * Crea un servicio nuevo, como si se cerrara y se volviera a abrir la app.
   * El GPS y el clima son falsos: `location` null = sin permiso o sin señal.
   */
  function freshService({
    user = 'ana' as string | null,
    location = null as TaskLocation | null,
    weather = CLOUDY as TaskWeather | null,
  } = {}) {
    TestBed.resetTestingModule();
    const auth = fakeAuth(user);
    TestBed.configureTestingModule({ providers: [auth.provider, fakeLocation(location), fakeWeather(weather)] });
    return { service: TestBed.inject(TaskService), auth };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('la primera vez carga las 2 tareas de ejemplo', async () => {
    const { service } = freshService();
    await service.load();
    expect(service.tasks().length).toBe(2);
  });

  it('las tareas siguen ahí al volver a abrir la app (con su fecha como Date)', async () => {
    await freshService().service.add('Comprar pan', 'En la esquina');

    const { service: reopened } = freshService();
    await reopened.load();

    const saved = reopened.tasks().find((task) => task.title === 'Comprar pan');
    expect(saved).toBeDefined();
    expect(saved?.description).toBe('En la esquina');
    expect(saved?.createdAt).toBeInstanceOf(Date);
  });

  it('si el usuario borra todas, no vuelven las de ejemplo', async () => {
    const { service } = freshService();
    await service.load();
    for (const task of service.tasks()) {
      await service.remove(task.id);
    }

    const { service: reopened } = freshService();
    await reopened.load();
    expect(reopened.tasks()).toEqual([]);
  });

  it('no agrega ni edita si el título o la descripción quedan vacíos', async () => {
    const { service } = freshService();
    await service.load();
    const [first] = service.tasks();

    expect(await service.add('   ', 'Algo')).toBe(false);
    expect(await service.add('Algo', '')).toBe(false);
    expect(await service.update(first.id, '', 'Algo')).toBe(false);
    expect(service.tasks().length).toBe(2);
    expect(service.tasks()[0].title).toBe(first.title);
  });

  it('recorta los espacios y respeta los largos máximos', async () => {
    const { service } = freshService();
    await service.add('  ' + 'a'.repeat(100), '  desc  ');
    const added = service.tasks().at(-1);
    expect(added?.title.length).toBe(60);
    expect(added?.description).toBe('desc');
  });

  it('con datos dañados en el almacenamiento parte con la lista vacía', async () => {
    await Preferences.set({ key: 'tasks:ana', value: '{esto no es JSON' });
    const { service } = freshService();
    await service.load();
    expect(service.tasks()).toEqual([]);
  });

  it('descarta las tareas guardadas con forma inválida (datos manipulados)', async () => {
    const valid = { id: 1, title: 'Válida', description: 'ok', createdAt: '2026-11-18T12:00:00.000Z' };
    await Preferences.set({ key: 'tasks:ana', value: JSON.stringify([valid, { id: 'x' }, { title: 5 }]) });
    const { service } = freshService();
    await service.load();
    expect(service.tasks().map((task) => task.title)).toEqual(['Válida']);
  });

  describe('GPS', () => {
    it('guarda la ubicación donde se crea la tarea, y sigue ahí al volver a abrir', async () => {
      const { service } = freshService({ location: SANTIAGO });
      await service.add('Con GPS', 'Creada en Santiago');
      expect(service.tasks().at(-1)?.location).toEqual(SANTIAGO);

      const { service: reopened } = freshService();
      await reopened.load();
      expect(reopened.tasks().at(-1)?.location).toEqual(SANTIAGO);
    });

    it('sin permiso o sin GPS la tarea se crea igual, pero sin ubicación', async () => {
      const { service } = freshService({ location: null });
      expect(await service.add('Sin GPS', 'desc')).toBe(true);
      expect(service.tasks().at(-1)?.location).toBeUndefined();
    });
  });

  describe('cámara', () => {
    it('guarda la foto adjunta y sigue ahí al volver a abrir la app', async () => {
      const { service } = freshService();
      await service.add('Con foto', 'desc', PHOTO);
      expect(service.tasks().at(-1)?.photo).toBe(PHOTO);

      const { service: reopened } = freshService();
      await reopened.load();
      expect(reopened.tasks().at(-1)?.photo).toBe(PHOTO);
    });

    it('no acepta como foto algo que no sea una imagen', async () => {
      const { service } = freshService();
      await service.add('Foto falsa', 'desc', 'javascript:alert(1)');
      expect(service.tasks().at(-1)?.photo).toBeUndefined();
    });

    it('adjunta, cambia y quita la foto de una tarea existente', async () => {
      const { service } = freshService();
      await service.load();
      const [first] = service.tasks();
      await service.setPhoto(first.id, PHOTO);
      expect(service.tasks()[0].photo).toBe(PHOTO);
      await service.setPhoto(first.id, null);
      expect(service.tasks()[0].photo).toBeUndefined();
    });
  });

  describe('clima (API)', () => {
    it('agrega el clima del lugar en segundo plano, sin demorar la creación', async () => {
      const { service } = freshService({ location: SANTIAGO });
      await service.add('Con clima', 'desc');
      await vi.waitFor(() => expect(service.tasks().at(-1)?.weather).toEqual(CLOUDY));
    });

    it('si la API del clima falla, la tarea queda igual (sin clima)', async () => {
      const { service } = freshService({ location: SANTIAGO, weather: null });
      await service.add('Sin clima', 'desc');
      await new Promise((resolve) => setTimeout(resolve));
      expect(service.tasks().at(-1)?.weather).toBeUndefined();
    });
  });

  describe('multiusuario', () => {
    it('cada usuario tiene su propia lista', async () => {
      const { service, auth } = freshService({ user: 'ana' });
      await service.add('Tarea de Ana', 'privada');

      auth.user.set('pedro');
      await service.load();
      expect(service.tasks().some((task) => task.title === 'Tarea de Ana')).toBe(false);

      auth.user.set('ana');
      await service.load();
      expect(service.tasks().some((task) => task.title === 'Tarea de Ana')).toBe(true);
    });

    it('sin sesión no hay tareas', async () => {
      const { service } = freshService({ user: null });
      await service.load();
      expect(service.tasks()).toEqual([]);
    });
  });

  describe('importar desde API', () => {
    const drafts = [
      { title: 'Importada 1', description: 'Importada desde DummyJSON · pendiente', externalId: 1 },
      { title: 'Importada 2', description: 'Importada desde DummyJSON · completada', externalId: 2 },
    ];

    it('agrega las tareas importadas y no las repite si se importan de nuevo', async () => {
      const { service } = freshService();
      expect(await service.importDrafts(drafts)).toBe(2);
      expect(await service.importDrafts(drafts)).toBe(0);
      expect(service.tasks().filter((task) => task.externalId !== undefined).length).toBe(2);
      expect(service.lastImportedId()).toBe(2);
    });

    it('les da ids únicos aunque se creen en el mismo milisegundo', async () => {
      const { service } = freshService();
      await service.importDrafts(drafts);
      const ids = service.tasks().map((task) => task.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('sincronización', () => {
    it('cada cambio local queda contado para sincronizarlo', async () => {
      const { service } = freshService();
      await service.load();
      const before = service.changes();
      await service.add('Nueva', 'desc');
      await service.update(service.tasks()[0].id, 'Editada', 'desc');
      await service.remove(service.tasks()[0].id);
      expect(service.changes()).toBe(before + 3);
    });

    it('recuerda los ids borrados hasta que el servidor los recibe', async () => {
      const { service } = freshService();
      await service.load();
      const [first] = service.tasks();
      await service.remove(first.id);
      expect(service.snapshot().deleted).toEqual([first.id]);

      await service.acknowledgeDeleted([first.id]);
      expect(service.snapshot().deleted).toEqual([]);
    });

    it('applyRemote mezcla lo del servidor con lo local y lo guarda', async () => {
      const { service } = freshService();
      await service.load();
      const remote: Task = {
        id: 99,
        title: 'Desde otro celular',
        description: 'remota',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await service.applyRemote([remote], [1]);
      expect(service.tasks().map((task) => task.id)).toEqual([2, 99]);

      const { service: reopened } = freshService();
      await reopened.load();
      expect(reopened.tasks().some((task) => task.title === 'Desde otro celular')).toBe(true);
    });

    it('aplicar datos del servidor NO cuenta como cambio local (no genera un envío extra)', async () => {
      const { service } = freshService();
      await service.load();
      const before = service.changes();
      await service.applyRemote([], []);
      expect(service.changes()).toBe(before);
    });
  });
});
