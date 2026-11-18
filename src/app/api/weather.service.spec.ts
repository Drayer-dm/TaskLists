import { TestBed } from '@angular/core/testing';

import { setupHttp } from '../../testing/http-testing';
import { SANTIAGO } from '../../testing/test-helpers';

import { describeWeather, WEATHER_URL, WeatherService } from './weather.service';

// Dato adicional por tarea: clima desde la API pública Open-Meteo (respuesta simulada)
describe('WeatherService', () => {
  function setup() {
    const { backend } = setupHttp();
    return { service: TestBed.inject(WeatherService), backend };
  }

  const response = { current: { temperature_2m: 18.4, weather_code: 3 } };

  it('pide el clima actual y lo convierte (temperatura redondeada + descripción en español)', async () => {
    const { service, backend } = setup();
    const result = service.getCurrent(SANTIAGO);
    const request = backend.expectOne((req) => req.url === WEATHER_URL);
    expect(request.request.params.get('current')).toBe('temperature_2m,weather_code');
    request.flush(response);
    expect(await result).toEqual({ temperature: 18, code: 3, description: 'Nublado' });
  });

  it('privacidad: envía sólo la zona aproximada (2 decimales), no la ubicación exacta', async () => {
    const { service, backend } = setup();
    const result = service.getCurrent(SANTIAGO);
    const request = backend.expectOne((req) => req.url === WEATHER_URL);
    expect(request.request.params.get('latitude')).toBe('-33.44');
    expect(request.request.params.get('longitude')).toBe('-70.65');
    request.flush(response);
    await result;
  });

  it('optimización: no repite la consulta para la misma zona durante 10 minutos (caché)', async () => {
    const { service, backend } = setup();
    const first = service.getCurrent(SANTIAGO);
    backend.expectOne((req) => req.url === WEATHER_URL).flush(response);
    await first;

    expect(await service.getCurrent({ ...SANTIAGO, latitude: -33.4381 })).toEqual(await first);
    backend.expectNone((req) => req.url === WEATHER_URL);
  });

  it('si la API falla devuelve null (la tarea queda sin clima, sin error)', async () => {
    const { service, backend } = setup();
    const result = service.getCurrent(SANTIAGO);
    backend.expectOne((req) => req.url === WEATHER_URL).flush({}, { status: 400, statusText: 'Bad Request' });
    expect(await result).toBeNull();
  });

  it('si la respuesta viene incompleta devuelve null', async () => {
    const { service, backend } = setup();
    const result = service.getCurrent(SANTIAGO);
    backend.expectOne((req) => req.url === WEATHER_URL).flush({ current: { temperature_2m: 'calor' } });
    expect(await result).toBeNull();
  });

  it.each([
    [0, 'Despejado'],
    [2, 'Parcialmente nublado'],
    [45, 'Niebla'],
    [63, 'Lluvia'],
    [81, 'Chubascos'],
    [95, 'Tormenta'],
    [1234, 'Sin datos'],
  ])('código WMO %i → "%s"', (code, text) => {
    expect(describeWeather(code)).toBe(text);
  });
});
