import { Component, inject, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { cameraOutline, locationOutline } from 'ionicons/icons';

import { CameraService } from '../services/camera.service';
import { LocationService } from '../services/location.service';
import type { AppPermissionState, PermissionKind } from '../services/permissions';
import { PERMISSION_INFO } from '../services/permissions';
import { ChipComponent } from '../ui/atoms';
import { SectionHeadingComponent } from '../ui/molecules';
import { BoardHeaderComponent } from '../ui/organisms';
import { PageTemplateComponent } from '../ui/templates';

/** Texto de cada estado del permiso */
const STATE_LABEL: Record<AppPermissionState, string> = {
  granted: 'Concedido',
  denied: 'Bloqueado',
  prompt: 'Sin decidir',
  unknown: 'Se pregunta al usarlo',
  'not-needed': 'No requerido aquí',
};

/** Prácticas de privacidad y seguridad que aplica la app (se muestran al usuario) */
const PRIVACY_PRACTICES = [
  'Los permisos se piden sólo al usar la función (al crear una tarea o al tocar "Tomar foto"), con una explicación previa.',
  'Si rechazas un permiso, la app sigue funcionando: la tarea se crea sin ubicación o sin foto.',
  'Las fotos se guardan sólo en este dispositivo, reducidas, y nunca se envían al servidor.',
  'Al servicio del clima sólo se le envía la zona aproximada (2 decimales ≈ 1 km), no tu ubicación exacta.',
  'Tu contraseña no se guarda ni se envía: se guarda su hash PBKDF2 y al servidor viaja una llave derivada.',
  'Cada cuenta ve sólo sus tareas; al cerrar sesión se borra la sesión del dispositivo.',
];

/**
 * PÁGINA · Permisos y privacidad.
 * Muestra el estado de cada permiso, para qué se usa y permite pedirlo.
 * Si está bloqueado, explica cómo activarlo (la app no puede volver a preguntar).
 */
@Component({
  selector: 'app-permissions',
  templateUrl: 'permissions.page.html',
  styleUrl: 'permissions.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    PageTemplateComponent,
    BoardHeaderComponent,
    SectionHeadingComponent,
    ChipComponent,
  ],
})
export class PermissionsPage {
  private readonly camera = inject(CameraService);
  private readonly location = inject(LocationService);

  readonly kinds: readonly PermissionKind[] = ['location', 'camera'];
  readonly info = PERMISSION_INFO;
  readonly practices = PRIVACY_PRACTICES;
  readonly icons: Record<PermissionKind, string> = { location: locationOutline, camera: cameraOutline };
  readonly states = signal<Record<PermissionKind, AppPermissionState>>({ location: 'unknown', camera: 'unknown' });
  readonly requesting = signal<PermissionKind | null>(null);

  /** Ionic lo llama cada vez que se entra a la página: el usuario pudo cambiar el permiso en Ajustes */
  ionViewWillEnter(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const [location, camera] = await Promise.all([this.location.checkPermission(), this.camera.checkPermission()]);
    this.states.set({ location, camera });
  }

  async request(kind: PermissionKind): Promise<void> {
    this.requesting.set(kind);
    try {
      const state = kind === 'camera' ? await this.camera.requestPermission() : await this.location.requestPermission();
      this.states.update((states) => ({ ...states, [kind]: state }));
    } finally {
      this.requesting.set(null);
    }
  }

  label(state: AppPermissionState): string {
    return STATE_LABEL[state];
  }

  canRequest(state: AppPermissionState): boolean {
    return state === 'prompt' || state === 'unknown';
  }
}
