import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { TaskService } from './task.service';

// Pruebas del almacenamiento local: en el navegador (y en estas pruebas) Preferences
// guarda en localStorage; en Android usa SharedPreferences. El servicio es el mismo.
describe('TaskService', () => {
  /** Crea un servicio nuevo, como si se cerrara y se volviera a abrir la app */
  function freshService(): TaskService {
    TestBed.resetTestingModule();
    return TestBed.inject(TaskService);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('la primera vez carga las 2 tareas de ejemplo', async () => {
    const service = freshService();
    await service.load();
    expect(service.tasks().length).toBe(2);
  });

  it('las tareas siguen ahí al volver a abrir la app (con su fecha como Date)', async () => {
    const service = freshService();
    await service.add('Comprar pan', 'En la esquina');

    const reopened = freshService();
    await reopened.load();

    const saved = reopened.tasks().find((task) => task.title === 'Comprar pan');
    expect(saved).toBeDefined();
    expect(saved?.description).toBe('En la esquina');
    expect(saved?.createdAt).toBeInstanceOf(Date);
  });

  it('si el usuario borra todas, no vuelven las de ejemplo', async () => {
    const service = freshService();
    await service.load();
    for (const task of service.tasks()) {
      await service.remove(task.id);
    }

    const reopened = freshService();
    await reopened.load();
    expect(reopened.tasks()).toEqual([]);
  });

  it('no agrega ni edita si el título o la descripción quedan vacíos', async () => {
    const service = freshService();
    await service.load();
    const [first] = service.tasks();

    expect(await service.add('   ', 'Algo')).toBe(false);
    expect(await service.add('Algo', '')).toBe(false);
    expect(await service.update(first.id, '', 'Algo')).toBe(false);
    expect(service.tasks().length).toBe(2);
    expect(service.tasks()[0].title).toBe(first.title);
  });

  it('recorta los espacios y respeta los largos máximos', async () => {
    const service = freshService();
    await service.add('  ' + 'a'.repeat(100), '  desc  ');
    const added = service.tasks().at(-1);
    expect(added?.title.length).toBe(60);
    expect(added?.description).toBe('desc');
  });

  it('con datos dañados en el almacenamiento parte con la lista vacía', async () => {
    await Preferences.set({ key: 'tasks', value: '{esto no es JSON' });
    const service = freshService();
    await service.load();
    expect(service.tasks()).toEqual([]);
  });
});
