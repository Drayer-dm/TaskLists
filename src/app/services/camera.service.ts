import { inject, Injectable, InjectionToken } from '@angular/core';
import type { CameraPlugin, MediaResult, TakePhotoOptions } from '@capacitor/camera';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

import { isImageDataUrl } from '../task.model';

import type { AppPermissionState } from './permissions';
import { PermissionRationaleService, toAppState } from './permissions';

/** Los 3 métodos del plugin de cámara que usa la app */
export type CameraApi = Pick<CameraPlugin, 'takePhoto' | 'checkPermissions' | 'requestPermissions'>;

/** Token de la cámara: el plugin real en la app, uno falso en las pruebas (igual que el GPS) */
export const CAMERA = new InjectionToken<CameraApi>('Camera', {
  providedIn: 'root',
  factory: () => ({
    takePhoto: (options) => Camera.takePhoto(options),
    checkPermissions: () => Camera.checkPermissions(),
    requestPermissions: (permissions) => Camera.requestPermissions(permissions),
  }),
});

/** Convierte la foto (ruta o data URL) en un JPEG chico. En las pruebas se reemplaza. */
export type ImageCompressor = (src: string) => Promise<string>;

/** Lado mayor de la foto guardada y calidad JPEG: ~60-150 KB por foto en vez de varios MB */
export const PHOTO_MAX_SIDE = 800;
export const PHOTO_QUALITY = 0.7;
/** Tope de seguridad del data URL guardado (~1,5 MB) */
export const PHOTO_MAX_LENGTH = 2_000_000;

/**
 * Reduce la imagen con un <canvas>: lado mayor PHOTO_MAX_SIDE y JPEG al 70 %.
 * En Android/iOS el plugin ya la achica (targetWidth/Height); en el navegador
 * llega el archivo original, por eso se hace aquí para todas las plataformas.
 */
export function compressImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas no disponible'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
    };
    image.onerror = () => reject(new Error('No se pudo leer la imagen'));
    image.src = src;
  });
}

export const IMAGE_COMPRESSOR = new InjectionToken<ImageCompressor>('ImageCompressor', {
  providedIn: 'root',
  factory: () => compressImage,
});

/** Opciones de la cámara: foto ya reducida, sin guardarla en la galería del usuario */
const PHOTO_OPTIONS: TakePhotoOptions = {
  quality: 70,
  targetWidth: 1280,
  targetHeight: 1280,
  correctOrientation: true,
  saveToGallery: false,
  // Navegador: usa <input type="file" capture>; en el celular abre la cámara directo
  webUseInput: true,
};

/** Resultado de "Tomar foto": nunca lanza error, la página decide qué mensaje mostrar */
export type PhotoResult =
  | { status: 'ok'; dataUrl: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/*
 * Servicio de cámara: es el único que habla con la cámara.
 * Pide el permiso sólo al tocar "Tomar foto" (en contexto), explica antes para
 * qué se usa, valida lo que devuelve y reduce la foto antes de guardarla.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly camera = inject(CAMERA);
  private readonly compress = inject(IMAGE_COMPRESSOR);
  private readonly rationale = inject(PermissionRationaleService);

  async takePhoto(): Promise<PhotoResult> {
    const permission = await this.ensurePermission();
    if (permission !== 'ok') {
      return { status: permission };
    }
    let result: MediaResult;
    try {
      result = await this.camera.takePhoto(PHOTO_OPTIONS);
    } catch (error) {
      const message = errorMessage(error);
      // El usuario cerró la cámara sin sacar la foto: no es un error
      if (/cancel/i.test(message)) {
        return { status: 'cancelled' };
      }
      if (/permission|denied/i.test(message)) {
        return { status: 'denied' };
      }
      return { status: 'error', message: 'No se pudo abrir la cámara.' };
    }

    const source = result.webPath ?? (result.thumbnail ? `data:image/jpeg;base64,${result.thumbnail}` : null);
    if (!source) {
      return { status: 'error', message: 'La cámara no devolvió una imagen.' };
    }
    try {
      const dataUrl = await this.compress(source);
      // Validación final: debe ser una imagen y no puede ser enorme
      if (!isImageDataUrl(dataUrl) || dataUrl.length > PHOTO_MAX_LENGTH) {
        return { status: 'error', message: 'El archivo elegido no es una imagen válida.' };
      }
      return { status: 'ok', dataUrl };
    } catch {
      return { status: 'error', message: 'El archivo elegido no es una imagen válida.' };
    } finally {
      // Libera la memoria del archivo temporal del navegador
      if (result.webPath?.startsWith('blob:')) {
        URL.revokeObjectURL(result.webPath);
      }
    }
  }

  /** Estado del permiso de cámara, sin preguntar nada */
  async checkPermission(): Promise<AppPermissionState> {
    // En el navegador la foto llega por el selector de archivos: no pide permiso de cámara
    if (!Capacitor.isNativePlatform()) {
      return 'not-needed';
    }
    try {
      return toAppState((await this.camera.checkPermissions()).camera);
    } catch {
      return 'unknown';
    }
  }

  /** Muestra la ventana del sistema "¿Permitir que TaskList tome fotos?" */
  async requestPermission(): Promise<AppPermissionState> {
    if (!Capacitor.isNativePlatform()) {
      return 'not-needed';
    }
    try {
      return toAppState((await this.camera.requestPermissions({ permissions: ['camera'] })).camera);
    } catch {
      return 'unknown';
    }
  }

  /** ¿Se puede abrir la cámara? 'cancelled' = el usuario eligió "Ahora no" en la explicación */
  private async ensurePermission(): Promise<'ok' | 'denied' | 'cancelled'> {
    const state = await this.checkPermission();
    if (state === 'granted' || state === 'not-needed' || state === 'unknown') {
      // unknown: el propio plugin pregunta al abrir la cámara
      return 'ok';
    }
    if (state === 'denied') {
      return 'denied';
    }
    // prompt: primero la explicación de la app, después la ventana del sistema
    if (!(await this.rationale.explain('camera'))) {
      return 'cancelled';
    }
    return (await this.requestPermission()) === 'granted' ? 'ok' : 'denied';
  }
}
