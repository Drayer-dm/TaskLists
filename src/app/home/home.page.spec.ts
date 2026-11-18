import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { fakeAuth, fakeLocation, fakeWeather, PHOTO, SANTIAGO } from '../../testing/test-helpers';
import { TodoImportService } from '../api/todo-import.service';
import type { PhotoResult } from '../services/camera.service';
import { CameraService } from '../services/camera.service';
import type { SyncState } from '../services/sync.service';
import { SyncService } from '../services/sync.service';
import { TaskService } from '../services/task.service';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let camera: { takePhoto: ReturnType<typeof vi.fn<() => Promise<PhotoResult>>> };
  let importer: { fetchDrafts: ReturnType<typeof vi.fn> };
  const syncState = signal<SyncState>({ status: 'synced', lastSync: new Date(), message: 'Sincronizado' });

  beforeEach(async () => {
    // en el navegador guarda en el localStorage y se limpia para que cada prueba parta igual
    localStorage.clear();
    // Periféricos y APIs falsos: GPS en Santiago, cámara que "saca" PHOTO
    camera = { takePhoto: vi.fn(async (): Promise<PhotoResult> => ({ status: 'ok', dataUrl: PHOTO })) };
    importer = {
      fetchDrafts: vi.fn(async () => [{ title: 'Buy milk', description: 'Importada', externalId: 1 }]),
    };
    TestBed.configureTestingModule({
      providers: [
        fakeAuth('ana').provider,
        fakeLocation(SANTIAGO),
        fakeWeather(null),
        { provide: CameraService, useValue: camera },
        { provide: TodoImportService, useValue: importer },
        { provide: SyncService, useValue: { state: syncState, sync: vi.fn(async () => true) } },
      ],
    });
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;

    await TestBed.inject(TaskService).load();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra las 2 tareas de ejemplo la primera vez', () => {
    expect(component.tasks().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('ion-item.task').length).toBe(2);
  });

  // Agregar tarea: guarda la fecha y hora de creación y limpia el formulario
  it('agrega la tarea con su fecha de creación y limpia los campos', async () => {
    const before = Date.now();
    component.newTitle = 'Comprar pan';
    component.newDescription = 'En la panadería de la esquina';

    await component.addTask();

    const tasks = component.tasks();
    const added = tasks[tasks.length - 1];
    expect(added.title).toBe('Comprar pan');
    expect(added.createdAt).toBeInstanceOf(Date);
    expect(added.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(component.newTitle).toBe('');
    expect(component.newDescription).toBe('');
  });

  it('elimina una tarea', async () => {
    const [first] = component.tasks();

    await component.deleteTask(first.id);

    expect(component.tasks().some((task) => task.id === first.id)).toBe(false);
  });

  // La fecha se muestra en cada fila con el formato dd/MM/yyyy · HH:mm
  it('muestra la fecha y hora de creación en cada tarea', () => {
    const times: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('app-timestamp time'));
    expect(times.length).toBe(component.tasks().length);
    expect(times[0].textContent).toMatch(/^\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}$/);
  });

  it('edita una tarea sin cambiar su id ni su fecha de creación', async () => {
    const original = component.tasks()[0];
    const saved = await component.saveEdit(original.id, 'Titulo Nuevo', 'Descripcion Nueva');

    const edited = component.tasks()[0];
    expect(saved).toBe(true);
    expect(edited.title).toBe('Titulo Nuevo');
    expect(edited.description).toBe('Descripcion Nueva');
    expect(edited.id).toBe(original.id);
    expect(edited.createdAt).toBe(original.createdAt);
    // updatedAt cambia: así gana esta edición al sincronizar
    expect(edited.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
  });

  it('no guarda la edición si un campo queda vacío', async () => {
    const original = { ...component.tasks()[0] };

    expect(await component.saveEdit(original.id, '   ', 'Algo')).toBe(false);
    expect(await component.saveEdit(original.id, 'Algo', '')).toBe(false);
    expect(component.tasks()[0]).toEqual(original);
  });

  // La pantalla se actualiza después de editar
  it('muestra el título editado en la lista', async () => {
    await component.saveEdit(component.tasks()[0].id, 'Título visible', 'Desc');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ion-item.task h2').textContent).toContain('Título visible');
  });

  it('muestra la ubicación (GPS) de la tarea creada, con enlace al mapa', async () => {
    component.newTitle = 'Con GPS';
    component.newDescription = 'Creada en Santiago';
    await component.addTask();
    fixture.detectChanges();

    // Las de ejemplo no tienen ubicación: el único app-location es el de la tarea nueva
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('app-location a');
    expect(link.textContent).toContain('-33.43780, -70.65050 · ±12 m');
    expect(link.getAttribute('href')).toBe('https://www.google.com/maps?q=-33.4378,-70.6505');
  });

  it('desactiva el botón mientras obtiene la ubicación', async () => {
    component.newTitle = 'Comprar pan';
    component.newDescription = 'En la esquina';

    const saving = component.addTask();
    expect(component.adding()).toBe(true);
    await saving;
    expect(component.adding()).toBe(false);
  });

  describe('cámara', () => {
    it('la foto tomada en el formulario se adjunta a la tarea nueva y se limpia', async () => {
      await component.takeDraftPhoto();
      expect(component.draftPhoto()).toBe(PHOTO);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-photo-thumb img').getAttribute('src')).toBe(PHOTO);

      component.newTitle = 'Con foto';
      component.newDescription = 'desc';
      await component.addTask();
      expect(component.tasks().at(-1)?.photo).toBe(PHOTO);
      expect(component.draftPhoto()).toBeNull();
    });

    it('adjunta una foto a una tarea existente y se muestra en la lista', async () => {
      await component.attachPhoto(component.tasks()[0]);
      fixture.detectChanges();
      const image: HTMLImageElement = fixture.nativeElement.querySelector('ion-item.task app-photo-thumb img');
      expect(image.getAttribute('src')).toBe(PHOTO);
      expect(image.getAttribute('alt')).toBe('Foto de la tarea Ejemplo');
    });

    it('si el usuario cancela o el permiso está bloqueado, no adjunta nada', async () => {
      camera.takePhoto.mockResolvedValueOnce({ status: 'cancelled' });
      await component.takeDraftPhoto();
      camera.takePhoto.mockResolvedValueOnce({ status: 'denied' });
      await component.attachPhoto(component.tasks()[0]);
      expect(component.draftPhoto()).toBeNull();
      expect(component.tasks()[0].photo).toBeUndefined();
    });
  });

  describe('servicios web', () => {
    it('importa tareas desde la API y las marca como "API"', async () => {
      await component.importTasks();
      fixture.detectChanges();
      expect(importer.fetchDrafts).toHaveBeenCalledWith(0);
      expect(component.tasks().at(-1)?.title).toBe('Buy milk');
      const last: HTMLElement = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('ion-item.task')).at(
        -1,
      )!;
      expect(last.querySelector('app-chip.source')?.textContent).toContain('API');
    });

    it('si la importación falla, la lista no cambia', async () => {
      importer.fetchDrafts.mockRejectedValueOnce(new Error('sin red'));
      await component.importTasks();
      expect(component.tasks().length).toBe(2);
      expect(component.importing()).toBe(false);
    });

    it('muestra el estado de la sincronización', () => {
      const status: HTMLElement = fixture.nativeElement.querySelector('app-sync-status [role="status"]');
      expect(status.textContent).toContain('Sincronizado');
    });
  });
});
