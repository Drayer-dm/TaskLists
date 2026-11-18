import { inject, Injectable, InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { GeolocationPlugin, PermissionStatus } from '@capacitor/geolocation';
import { Geolocation } from '@capacitor/geolocation';

import type { TaskLocation } from '../task.model';

import type { AppPermissionState } from './permissions';
import { PermissionRationaleService, toAppState } from './permissions';

/** Los 3 métodos del plugin de GPS que usa la app */
export type GeolocationApi = Pick<GeolocationPlugin, 'getCurrentPosition' | 'checkPermissions' | 'requestPermissions'>;

/**
 * Token del GPS. En la app entrega el plugin real de Capacitor; en las pruebas se
 * cambia por uno falso, así se prueba sin GPS ni permisos de verdad.
 * El plugin se envuelve en un objeto normal porque responde a cualquier nombre de
 * método: Angular le pregunta por ngOnDestroy() al cerrarse y daría error.
 */
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

/** Permiso dado: preciso (location) o sólo aproximado (coarseLocation, Android 12+) */
function toState(status: PermissionStatus): AppPermissionState {
  if (status.location === 'granted' || status.coarseLocation === 'granted') {
    return 'granted';
  }
  return toAppState(status.location);
}

/*
 * Servicio de ubicación: es el único que habla con el GPS.
 * Nunca lanza error: si no hay permiso o el GPS falla devuelve null, y la tarea
 * se crea igual, sólo que sin ubicación.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly geolocation = inject(GEOLOCATION);
  private readonly rationale = inject(PermissionRationaleService);

  /** El usuario dijo "Ahora no" en la explicación: no se le vuelve a preguntar en esta sesión */
  private declined = false;

  async getCurrentLocation(): Promise<TaskLocation | null> {
    try {
      if (!(await this.ensurePermission())) {
        return null;
      }
      const { coords } = await this.geolocation.getCurrentPosition(POSITION_OPTIONS);
      return { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
    } catch {
      // GPS apagado, sin señal, se pasó del tiempo o el navegador lo rechazó
      return null;
    }
  }

  /** Estado actual del permiso, sin preguntarle nada al usuario */
  async checkPermission(): Promise<AppPermissionState> {
    try {
      return toState(await this.geolocation.checkPermissions());
    } catch {
      // Navegadores sin Permissions API: no se puede saber hasta pedir la posición
      return 'unknown';
    }
  }

  /** Muestra la ventana del sistema "¿Permitir que TaskList acceda a la ubicación?" */
  async requestPermission(): Promise<AppPermissionState> {
    this.declined = false;
    try {
      if (!Capacitor.isNativePlatform()) {
        // En el navegador no existe requestPermissions(): el navegador pregunta al pedir la posición
        await this.geolocation.getCurrentPosition(POSITION_OPTIONS);
        return 'granted';
      }
      return toState(await this.geolocation.requestPermissions());
    } catch {
      return this.checkPermission();
    }
  }

  /** ¿Se puede usar el GPS? Pregunta sólo si hace falta y nunca insiste */
  private async ensurePermission(): Promise<boolean> {
    const state = await this.checkPermission();
    if (state === 'granted') {
      return true;
    }
    // "denied" = el usuario ya dijo que no: no se le vuelve a insistir
    if (state === 'denied' || this.declined) {
      return false;
    }
    if (state === 'unknown') {
      // Navegador sin Permissions API: él mismo pregunta al pedir la posición
      return !Capacitor.isNativePlatform();
    }
    // "prompt": primero se explica para qué se usa; si acepta, pregunta el sistema
    if (!(await this.rationale.explain('location'))) {
      this.declined = true;
      return false;
    }
    if (!Capacitor.isNativePlatform()) {
      return true; // el navegador muestra su ventana al pedir la posición
    }
    return (await this.requestPermission()) === 'granted';
  }
}
