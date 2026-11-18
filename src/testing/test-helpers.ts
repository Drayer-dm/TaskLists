import type { Provider, WritableSignal } from '@angular/core';
import { signal } from '@angular/core';

import { WeatherService } from '../app/api/weather.service';
import { AuthService } from '../app/services/auth.service';
import { LocationService } from '../app/services/location.service';
import type { TaskLocation, TaskWeather } from '../app/task.model';

/*
 * Dobles de prueba (fakes) compartidos por las pruebas unitarias.
 * Reemplazan a los servicios que hablan con el hardware o con internet, así
 * cada prueba controla exactamente qué "responde" el dispositivo.
 */

/** Plaza de Armas de Santiago, precisión de 12 metros */
export const SANTIAGO: TaskLocation = { latitude: -33.4378, longitude: -70.6505, accuracy: 12 };
export const CLOUDY: TaskWeather = { temperature: 18, code: 3, description: 'Nublado' };
/** Foto mínima válida (JPEG en data URL) */
export const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

/** Sesión falsa: `user` se puede cambiar en la prueba para simular otro usuario */
export function fakeAuth(user: string | null = 'ana'): { provider: Provider; user: WritableSignal<string | null> } {
  const userSignal = signal<string | null>(user);
  return {
    user: userSignal,
    provider: {
      provide: AuthService,
      useValue: {
        user: userSignal,
        syncKey: signal('llave-de-prueba'),
        restore: async () => undefined,
        logout: async () => userSignal.set(null),
      },
    },
  };
}

/** GPS falso: responde `location` (null = sin permiso o sin señal) */
export function fakeLocation(location: TaskLocation | null = SANTIAGO): Provider {
  return {
    provide: LocationService,
    useValue: {
      getCurrentLocation: async () => location,
      checkPermission: async () => (location ? 'granted' : 'denied'),
      requestPermission: async () => 'granted',
    },
  };
}

/** API del clima falsa */
export function fakeWeather(weather: TaskWeather | null = CLOUDY): Provider {
  return { provide: WeatherService, useValue: { getCurrent: async () => weather } };
}
