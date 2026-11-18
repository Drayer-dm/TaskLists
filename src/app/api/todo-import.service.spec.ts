import { TestBed } from '@angular/core/testing';

import { setupHttp } from '../../testing/http-testing';

import { ApiError } from './api-error';
import { IMPORT_BATCH, sanitizeText, TODOS_URL, TodoImportService } from './todo-import.service';

// Importación desde la API pública DummyJSON (respuesta simulada: no sale a internet)
describe('TodoImportService', () => {
  function setup() {
    const { backend } = setupHttp();
    return { service: TestBed.inject(TodoImportService), backend };
  }

  const todos = [
    { id: 6, todo: 'Buy groceries', completed: false },
    { id: 7, todo: 'Walk the dog', completed: true },
  ];

  it('pide de a 5 tareas, sólo los campos necesarios, desde la última importada', async () => {
    const { service, backend } = setup();
    const result = service.fetchDrafts(5);
    const request = backend.expectOne((req) => req.url === TODOS_URL);
    expect(request.request.params.get('limit')).toBe(String(IMPORT_BATCH));
    expect(request.request.params.get('skip')).toBe('5');
    expect(request.request.params.get('select')).toBe('todo,completed');
    request.flush({ todos, total: 254, skip: 5, limit: 5 });
    await result;
  });

  it('convierte cada tarea de la API en una tarea de TaskList', async () => {
    const { service, backend } = setup();
    const result = service.fetchDrafts();
    backend.expectOne((req) => req.url === TODOS_URL).flush({ todos });
    expect(await result).toEqual([
      { title: 'Buy groceries', description: 'Importada desde DummyJSON · pendiente', externalId: 6 },
      { title: 'Walk the dog', description: 'Importada desde DummyJSON · completada', externalId: 7 },
    ]);
  });

  it('descarta elementos con forma inesperada', async () => {
    const { service, backend } = setup();
    const result = service.fetchDrafts();
    backend
      .expectOne((req) => req.url === TODOS_URL)
      .flush({ todos: [todos[0], { id: 'x', todo: 3 }, null, { id: 9, todo: '   ', completed: false }] });
    expect((await result).map((draft) => draft.externalId)).toEqual([6]);
  });

  it('si la respuesta no trae la lista, avisa con ApiError "invalid"', async () => {
    const { service, backend } = setup();
    const result = service.fetchDrafts().catch((error: unknown) => error);
    backend.expectOne((req) => req.url === TODOS_URL).flush({ message: 'Not found' });
    expect(((await result) as ApiError).kind).toBe('invalid');
  });

  it('si la API falla (500), avisa con un error entendible', async () => {
    const { service, backend } = setup();
    const result = service.fetchDrafts().catch((error: unknown) => error);
    backend.expectOne((req) => req.url === TODOS_URL).flush({}, { status: 500, statusText: 'Server Error' });
    const error = (await result) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Error del servidor (500).');
  });

  it('al llegar al final de la lista vuelve a empezar', async () => {
    const { service, backend } = setup();
    const result = service.fetchDrafts(255);
    const request = backend.expectOne((req) => req.url === TODOS_URL);
    expect(request.request.params.get('skip')).toBe('5');
    request.flush({ todos: [] });
    await result;
  });

  describe('sanitizeText', () => {
    it('quita caracteres de control y espacios de más', () => {
      expect(sanitizeText('  Hola\u0000\n   mundo\t ', 60)).toBe('Hola mundo');
    });

    it('acorta los textos largos con "…" respetando el máximo', () => {
      const text = sanitizeText('a'.repeat(100), 60);
      expect(text.length).toBe(60);
      expect(text.endsWith('…')).toBe(true);
    });
  });
});
