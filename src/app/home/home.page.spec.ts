import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { TaskService } from '../services/task.service';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    //en el navegador guarda en el local storage y se limpia para q cada prueba para igual
    localStorage.clear();
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

  it('edita una tarea sin cambiar su id ni su fecha', async () => {
    const original = component.tasks()[0];
    const saved = await component.saveEdit(original.id, 'Titulo Nuevo', 'Descripcion Nueva');

    const edited = component.tasks()[0];
    expect(saved).toBe(true);
    expect(edited.title).toBe('Titulo Nuevo');
    expect(edited.description).toBe('Descripcion Nueva');
    expect(edited.id).toBe(original.id);
    expect(edited.createdAt).toBe(original.createdAt);
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
});
