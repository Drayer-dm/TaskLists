import { firstValueFrom } from 'rxjs';

import { setupHttp, TEST_API } from '../../testing/http-testing';

import { toApiError } from './api-error';

// Interceptores: seguridad (credenciales sólo a nuestra API) y resiliencia
// (timeout + reintentos con backoff sólo en fallas temporales).
describe('interceptores HTTP', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authInterceptor (seguridad)', () => {
    it('agrega la llave y el usuario a las peticiones hacia nuestra API', async () => {
      const { http, backend } = setupHttp();
      const response = firstValueFrom(http.get(`${TEST_API}/tasks`));
      const request = backend.expectOne(`${TEST_API}/tasks`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer llave-de-prueba');
      expect(request.request.headers.get('X-TaskList-User')).toBe('ana');
      request.flush({});
      await response;
    });

    it('NUNCA envía las credenciales a APIs de terceros', async () => {
      const { http, backend } = setupHttp();
      const response = firstValueFrom(http.get('https://dummyjson.com/todos'));
      const request = backend.expectOne('https://dummyjson.com/todos');
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.headers.has('X-TaskList-User')).toBe(false);
      request.flush({});
      await response;
    });

    it('sin sesión no agrega credenciales', async () => {
      const { http, backend } = setupHttp({}, null);
      const response = firstValueFrom(http.get(`${TEST_API}/tasks`));
      const request = backend.expectOne(`${TEST_API}/tasks`);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
      await response;
    });
  });

  describe('resilienceInterceptor (rendimiento y fiabilidad)', () => {
    it('reintenta un GET ante una falla temporal (503) y termina bien', async () => {
      const { http, backend } = setupHttp();
      const response = firstValueFrom(http.get<{ ok: boolean }>(`${TEST_API}/tasks`));
      backend.expectOne(`${TEST_API}/tasks`).flush('caído', { status: 503, statusText: 'Service Unavailable' });
      const retry = await vi.waitFor(() => backend.expectOne(`${TEST_API}/tasks`));
      retry.flush({ ok: true });
      expect(await response).toEqual({ ok: true });
    });

    it('se rinde después de 2 reintentos (3 intentos en total)', async () => {
      const { http, backend } = setupHttp();
      const response = firstValueFrom(http.get(`${TEST_API}/tasks`)).catch((error: unknown) => error);
      for (let attempt = 0; attempt < 3; attempt++) {
        const request = await vi.waitFor(() => backend.expectOne(`${TEST_API}/tasks`));
        request.error(new ProgressEvent('error'), { status: 0 });
      }
      expect(toApiError(await response).kind).toBe('offline');
      backend.verify();
    });

    it('NO reintenta errores que fallarían igual (401)', async () => {
      const { http, backend } = setupHttp();
      const response = firstValueFrom(http.get(`${TEST_API}/tasks`)).catch((error: unknown) => error);
      backend.expectOne(`${TEST_API}/tasks`).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(toApiError(await response).kind).toBe('unauthorized');
      await new Promise((resolve) => setTimeout(resolve, 10));
      backend.verify(); // no hubo un segundo intento
    });

    it('NO reintenta métodos que no son idempotentes (POST)', async () => {
      const { http, backend } = setupHttp();
      const response = firstValueFrom(http.post(`${TEST_API}/tasks`, {})).catch((error: unknown) => error);
      backend.expectOne(`${TEST_API}/tasks`).flush({}, { status: 503, statusText: 'Service Unavailable' });
      expect(toApiError(await response).kind).toBe('server');
      await new Promise((resolve) => setTimeout(resolve, 10));
      backend.verify();
    });

    it('corta la petición si el servidor no responde a tiempo (timeout)', async () => {
      const { http, backend } = setupHttp({ timeoutMs: 20, retries: 0 });
      const response = firstValueFrom(http.get(`${TEST_API}/tasks`)).catch((error: unknown) => error);
      backend.expectOne(`${TEST_API}/tasks`); // nunca responde
      const error = toApiError(await response);
      expect(error.kind).toBe('timeout');
      expect(error.message).toBe('El servidor tardó demasiado en responder.');
    });
  });
});
