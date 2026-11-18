import { inject, Injectable } from '@angular/core';
import type { PermissionState } from '@capacitor/core';
import { AlertController } from '@ionic/angular';

/** Periféricos que necesitan permiso del usuario */
export type PermissionKind = 'camera' | 'location';

/**
 * Estado de un permiso, igual en Android, iOS y navegador:
 * - granted: concedido · denied: rechazado (no se vuelve a insistir)
 * - prompt: aún no se pregunta · unknown: el navegador no deja consultarlo
 * - not-needed: en esta plataforma no hace falta (cámara en el navegador)
 */
export type AppPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown' | 'not-needed';

/** Estados de Capacitor → los nuestros ('prompt-with-rationale' es otro "aún no decide") */
export function toAppState(state: PermissionState | 'limited' | undefined): AppPermissionState {
  switch (state) {
    case 'granted':
    case 'limited': // iOS: acceso parcial a la galería
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'unknown';
  }
}

/** Textos de cada permiso: para qué se usa y qué hacer si se rechazó. */
export const PERMISSION_INFO: Record<
  PermissionKind,
  { name: string; purpose: string; rationale: string; deniedHelp: string }
> = {
  camera: {
    name: 'Cámara',
    purpose: 'Adjuntar una foto a una tarea. Sólo se abre cuando tocas "Tomar foto".',
    rationale:
      'TaskList usa la cámara sólo cuando tocas "Tomar foto", para adjuntar una imagen a la tarea. ' +
      'Las fotos se guardan en este dispositivo y nunca se envían al servidor.',
    deniedHelp:
      'El permiso de cámara está bloqueado. Para adjuntar fotos, actívalo en Ajustes › Apps › TaskList › Permisos.',
  },
  location: {
    name: 'Ubicación',
    purpose: 'Guardar dónde se creó cada tarea y consultar el clima de ese lugar. Sólo al crear una tarea.',
    rationale:
      'TaskList guarda el lugar donde creas cada tarea para mostrarlo en el mapa y consultar el clima. ' +
      'Sólo se usa en ese momento, nunca en segundo plano. Si no lo permites, la tarea se crea igual, sin ubicación.',
    deniedHelp:
      'El permiso de ubicación está bloqueado: las tareas se crean sin ubicación. ' +
      'Para activarlo ve a Ajustes › Apps › TaskList › Permisos (en el navegador: configuración del sitio).',
  },
};

/**
 * Explicación previa al permiso (buena práctica de Android e iOS).
 * Antes de que aparezca la ventana del sistema, la app cuenta en sus palabras
 * para qué usará el periférico. Si el usuario dice "Ahora no", no se muestra la
 * ventana del sistema: así no queda "denegado para siempre" por sorpresa.
 */
@Injectable({ providedIn: 'root' })
export class PermissionRationaleService {
  private readonly alertCtrl = inject(AlertController);

  /** true = el usuario quiere continuar y ver la ventana de permiso del sistema */
  async explain(kind: PermissionKind): Promise<boolean> {
    const info = PERMISSION_INFO[kind];
    const alert = await this.alertCtrl.create({
      header: `Permiso de ${info.name.toLowerCase()}`,
      message: info.rationale,
      cssClass: 'task-alert',
      buttons: [
        { text: 'Ahora no', role: 'cancel' },
        { text: 'Continuar', role: 'confirm', cssClass: 'alert-button-confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }
}
