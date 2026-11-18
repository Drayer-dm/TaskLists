import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { ApiConfig } from '../app/api/api.config';
import { API_CONFIG } from '../app/api/api.config';
import { authInterceptor, resilienceInterceptor } from '../app/api/interceptors';

import { fakeAuth } from './test-helpers';

/** URL de la API en las pruebas (no sale a internet: HttpTestingController responde) */
export const TEST_API = 'http://api.test/api';

/**
 * Configura HttpClient con los interceptores reales y un backend falso
 * (HttpTestingController), donde cada prueba decide qué responde el "servidor".
 * Esperas cortas para que las pruebas de reintentos y timeout sean rápidas.
 */
export function setupHttp(
  config: Partial<ApiConfig> = {},
  user: string | null = 'ana',
): { http: HttpClient; backend: HttpTestingController; auth: ReturnType<typeof fakeAuth> } {
  const auth = fakeAuth(user);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor, resilienceInterceptor])),
      provideHttpClientTesting(),
      auth.provider,
      {
        provide: API_CONFIG,
        useValue: {
          baseUrl: TEST_API,
          timeoutMs: 1_000,
          retries: 2,
          retryDelayMs: 1,
          syncDebounceMs: 0,
          pollMs: 0,
          ...config,
        } satisfies ApiConfig,
      },
    ],
  });
  return { http: TestBed.inject(HttpClient), backend: TestBed.inject(HttpTestingController), auth };
}
