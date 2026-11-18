import { TestBed } from '@angular/core/testing';
import type { PermissionState } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import type { PermissionStatus, Position } from '@capacitor/geolocation';

import type { GeolocationApi } from './location.service';
import { GEOLOCATION, LocationService } from './location.service';
import { PermissionRationaleService } from './permissions';

// Pruebas del GPS con un plugin FALSO: no hace falta un celular, GPS ni permisos
// reales, y cada prueba controla exactamente qué responde el "dispositivo".

/** Posición de prueba: Plaza de Armas de Santiago, precisión de 12 metros */
const SANTIAGO = { latitude: -33.4378, longitude: -70.6505, accuracy: 12 };

function status(location: PermissionState, coarseLocation = location): PermissionStatus {
  return { location, coarseLocation };
}

/** GPS falso: responde SANTIAGO y el permiso indicado */
function fakeGps(permission: PermissionState = 'granted') {
  return {
    getCurrentPosition: vi.fn(async () => ({ timestamp: Date.now(), coords: SANTIAGO }) as Position),
    checkPermissions: vi.fn(async () => status(permission)),
    requestPermissions: vi.fn(async () => status('granted')),
  } satisfies GeolocationApi;
}

/**
 * Crea el servicio con el GPS falso.
 * native = true simula Android; accepts = lo que responde el usuario a la explicación previa.
 */
function setup(gps: GeolocationApi, native = false, accepts = true) {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(native);
  const rationale = { explain: vi.fn(async () => accepts) };
  TestBed.configureTestingModule({
    providers: [
      { provide: GEOLOCATION, useValue: gps },
      { provide: PermissionRationaleService, useValue: rationale },
    ],
  });
  return { service: TestBed.inject(LocationService), rationale };
}

describe('LocationService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve la latitud, longitud y precisión que entrega el GPS', async () => {
    const { service } = setup(fakeGps());
    expect(await service.getCurrentLocation()).toEqual(SANTIAGO);
  });

  it('pide alta precisión y un tiempo máximo de espera de 10 s', async () => {
    const gps = fakeGps();
    await setup(gps).service.getCurrentLocation();
    expect(gps.getCurrentPosition).toHaveBeenCalledWith(
      expect.objectContaining({ enableHighAccuracy: true, timeout: 10_000 }),
    );
  });

  it('si el GPS falla (apagado, sin señal o tarda mucho) devuelve null sin romper la app', async () => {
    const gps = fakeGps();
    gps.getCurrentPosition.mockRejectedValue(new Error('Location unavailable'));
    expect(await setup(gps).service.getCurrentLocation()).toBeNull();
  });

  it('valida la precisión de los datos: coordenadas dentro de rango y precisión en metros', async () => {
    const location = await setup(fakeGps()).service.getCurrentLocation();
    expect(Math.abs(location!.latitude)).toBeLessThanOrEqual(90);
    expect(Math.abs(location!.longitude)).toBeLessThanOrEqual(180);
    expect(location!.accuracy).toBeGreaterThanOrEqual(0);
  });

  describe('permisos en Android', () => {
    it('si el permiso ya estaba dado, no lo vuelve a pedir', async () => {
      const gps = fakeGps('granted');
      const { service, rationale } = setup(gps, true);
      expect(await service.getCurrentLocation()).toEqual(SANTIAGO);
      expect(gps.requestPermissions).not.toHaveBeenCalled();
      expect(rationale.explain).not.toHaveBeenCalled();
    });

    it('la primera vez explica para qué es, pide el permiso y, si acepta, obtiene la ubicación', async () => {
      const gps = fakeGps('prompt');
      const { service, rationale } = setup(gps, true);
      expect(await service.getCurrentLocation()).toEqual(SANTIAGO);
      expect(rationale.explain).toHaveBeenCalledWith('location');
      expect(gps.requestPermissions).toHaveBeenCalledTimes(1);
    });

    it('si el usuario dice "Ahora no" en la explicación, no muestra la ventana del sistema ni insiste', async () => {
      const gps = fakeGps('prompt');
      const { service, rationale } = setup(gps, true, false);
      expect(await service.getCurrentLocation()).toBeNull();
      expect(await service.getCurrentLocation()).toBeNull();
      expect(rationale.explain).toHaveBeenCalledTimes(1);
      expect(gps.requestPermissions).not.toHaveBeenCalled();
      expect(gps.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('si el usuario rechaza el permiso devuelve null y no usa el GPS', async () => {
      const gps = fakeGps('prompt');
      gps.requestPermissions.mockResolvedValue(status('denied'));
      expect(await setup(gps, true).service.getCurrentLocation()).toBeNull();
      expect(gps.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('si ya lo había rechazado antes, no le vuelve a insistir', async () => {
      const gps = fakeGps('denied');
      expect(await setup(gps, true).service.getCurrentLocation()).toBeNull();
      expect(gps.requestPermissions).not.toHaveBeenCalled();
      expect(gps.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('acepta la ubicación aproximada (Android 12+ deja elegir sólo esa)', async () => {
      const gps = fakeGps();
      gps.checkPermissions.mockResolvedValue(status('denied', 'granted'));
      expect(await setup(gps, true).service.getCurrentLocation()).toEqual(SANTIAGO);
    });

    it('trata "prompt-with-rationale" como "aún no decide" y vuelve a explicar', async () => {
      const gps = fakeGps('prompt-with-rationale');
      const { service, rationale } = setup(gps, true);
      expect(await service.getCurrentLocation()).toEqual(SANTIAGO);
      expect(rationale.explain).toHaveBeenCalled();
    });
  });

  describe('estado del permiso (página de permisos)', () => {
    it('informa el estado sin preguntarle nada al usuario', async () => {
      const gps = fakeGps('denied');
      expect(await setup(gps, true).service.checkPermission()).toBe('denied');
      expect(gps.requestPermissions).not.toHaveBeenCalled();
    });

    it('en un navegador sin Permissions API el estado es "unknown"', async () => {
      const gps = fakeGps();
      gps.checkPermissions.mockRejectedValue(new Error('Permissions API not available'));
      expect(await setup(gps).service.checkPermission()).toBe('unknown');
    });

    it('en el navegador, pedir el permiso = pedir la posición (el navegador muestra su ventana)', async () => {
      const gps = fakeGps('prompt');
      expect(await setup(gps).service.requestPermission()).toBe('granted');
      expect(gps.getCurrentPosition).toHaveBeenCalled();
      expect(gps.requestPermissions).not.toHaveBeenCalled();
    });
  });
});
