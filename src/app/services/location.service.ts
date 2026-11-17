import { inject, Injectable, InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { GeolocationPlugin, PermissionStatus } from '@capacitor/geolocation';
import { Geolocation } from '@capacitor/geolocation';

import type { TaskLocation } from '../task.model';

/** Los 3 métodos del plugin de GPS que usa la app */
export type GeolocationApi = Pick<GeolocationPlugin, 'getCurrentPosition' | 'checkPermissions' | 'requestPermissions'>;

//Toquen del GPS
export const GEOLOCATION = new InjectionToken<GeolocationApi>('Geolocation', {
  providedIn: 'root',
  factory: () => ({
    getCurrentPosition: (options) => Geolocation.getCurrentPosition(options),
    checkPermissions: () => Geolocation.checkPermissions(),
    requestPermissions: () => Geolocation.requestPermissions(),
  }),
});

/** Espera al GPS máximo 10 s y acepta una posición de hasta 1 minuto atrás (más rápido) */
const POSITION_OPTIONS = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 };

function isGranted(status: PermissionStatus): boolean {
  return status.location === 'granted' || status.coarseLocation === 'granted';
}

// ⬇️ FALTA: la clase LocationService (desde "/* Servicio de ubicación" hasta el final)
