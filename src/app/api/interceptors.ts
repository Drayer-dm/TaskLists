import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { retry, throwError, timeout, timer, TimeoutError } from 'rxjs';

import { AuthService } from '../services/auth.service';

import { API_CONFIG } from './api.config';

/*
 * Interceptores HTTP (patrón Chain of Responsibility): cada petición pasa por
 * ellos antes de salir, así ningún servicio repite esta lógica.
 */

/**
 * Agrega las credenciales SÓLO a las peticiones hacia nuestra API.
 * Las APIs de terceros (DummyJSON, Open-Meteo) nunca reciben la llave del usuario.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const auth = inject(AuthService);
  const user = auth.user();
  const key = auth.syncKey();
  if (!request.url.startsWith(config.baseUrl) || !user || !key) {
    return next(request);
  }
  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${key}`, 'X-TaskList-User': user },
    }),
  );
};

/** Métodos que se pueden repetir sin efectos duplicados (idempotentes) */
const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/** Fallas temporales en las que vale la pena reintentar */
export function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 0 || error.status === 429 || (error.status >= 502 && error.status <= 504))
  );
}

/**
 * Resiliencia para TODAS las peticiones:
 * - timeout: si el servidor no responde a tiempo, se corta (la app no queda colgada).
 * - retry con backoff exponencial (500 ms, 1 s...): sólo en fallas temporales y
 *   sólo en métodos idempotentes. Un 401 o un 400 no se reintentan: fallarían igual.
 */
export const resilienceInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const response$ = next(request).pipe(timeout(config.timeoutMs));
  if (!IDEMPOTENT.has(request.method)) {
    return response$;
  }
  return response$.pipe(
    retry({
      count: config.retries,
      delay: (error: unknown, attempt: number) =>
        isRetryable(error) ? timer(config.retryDelayMs * 2 ** (attempt - 1)) : throwError(() => error),
    }),
  );
};
