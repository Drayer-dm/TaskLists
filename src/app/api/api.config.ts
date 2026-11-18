import { InjectionToken } from '@angular/core';

import { environment } from '../../environments/environment';

/** Ajustes de la comunicación con servicios web. En las pruebas se cambian por valores rápidos. */
export interface ApiConfig {
  /** URL base de la API propia de sincronización */
  baseUrl: string;
  /** Tiempo máximo de espera de una respuesta */
  timeoutMs: number;
  /** Reintentos ante fallas temporales (sin red, 429, 502-504, timeout) */
  retries: number;
  /** Espera antes del 1er reintento; se duplica en cada uno (backoff exponencial) */
  retryDelayMs: number;
  /** Espera tras el último cambio antes de sincronizar (agrupa varios cambios en un envío) */
  syncDebounceMs: number;
  /** Cada cuánto se traen cambios de otros dispositivos (0 = nunca) */
  pollMs: number;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('ApiConfig', {
  providedIn: 'root',
  factory: () => ({
    baseUrl: environment.apiUrl,
    timeoutMs: 8_000,
    retries: 2,
    retryDelayMs: 500,
    syncDebounceMs: 1_500,
    pollMs: 30_000,
  }),
});
