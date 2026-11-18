import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { TaskLocation, TaskWeather } from '../task.model';

/** API pública del clima (HTTPS, sin llave): https://open-meteo.com/en/docs */
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
/** Una consulta sirve 10 minutos para el mismo lugar (menos peticiones, respuesta inmediata) */
export const WEATHER_CACHE_MS = 10 * 60_000;

/** Códigos WMO del estado del tiempo (rangos desde-hasta) → texto en español */
const WEATHER_TEXT: readonly [number, number, string][] = [
  [0, 0, 'Despejado'],
  [1, 1, 'Mayormente despejado'],
  [2, 2, 'Parcialmente nublado'],
  [3, 3, 'Nublado'],
  [45, 48, 'Niebla'],
  [51, 57, 'Llovizna'],
  [61, 67, 'Lluvia'],
  [71, 77, 'Nieve'],
  [80, 82, 'Chubascos'],
  [85, 86, 'Chubascos de nieve'],
  [95, 99, 'Tormenta'],
];

export function describeWeather(code: number): string {
  return WEATHER_TEXT.find(([from, to]) => code >= from && code <= to)?.[2] ?? 'Sin datos';
}

/** 2 decimales ≈ 1 km: al tercero sólo se le envía la zona, no la ubicación exacta */
function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseWeather(body: unknown): TaskWeather | null {
  const current = (body as { current?: Record<string, unknown> } | null)?.current;
  const temperature = current?.['temperature_2m'];
  const code = current?.['weather_code'];
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || !Number.isInteger(code)) {
    return null;
  }
  return { temperature: Math.round(temperature), code: code as number, description: describeWeather(code as number) };
}

/*
 * Dato adicional para cada tarea: el clima del lugar donde se creó.
 * Nunca lanza error: si la API falla, la tarea queda sin clima.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, { at: number; weather: TaskWeather }>();

  async getCurrent(location: TaskLocation): Promise<TaskWeather | null> {
    const latitude = roundCoord(location.latitude);
    const longitude = roundCoord(location.longitude);
    const key = `${latitude},${longitude}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < WEATHER_CACHE_MS) {
      return cached.weather;
    }
    try {
      const params = new HttpParams()
        .set('latitude', latitude)
        .set('longitude', longitude)
        .set('current', 'temperature_2m,weather_code');
      const weather = parseWeather(await firstValueFrom(this.http.get<unknown>(WEATHER_URL, { params })));
      if (weather) {
        this.cache.set(key, { at: Date.now(), weather });
      }
      return weather;
    } catch {
      return null;
    }
  }
}
