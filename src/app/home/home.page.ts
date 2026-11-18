// Angular: componente, directivas comunes y [(ngModel)] del formulario
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
// Componentes de Ionic que usa la página (cada uno se importa por separado: standalone)
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonItemSliding,
  // Ruedita de carga del botón mientras se obtiene la ubicación
  IonSpinner,
  // Botón ☰ que abre el menú lateral
  IonButtons,
  IonMenuButton,
  // Ventana emergente (ion-alert) para editar una tarea y avisos (ion-toast)
  AlertController,
  ToastController,
} from '@ionic/angular';
// Íconos: se registran con addIcons() en el constructor
import { addIcons } from 'ionicons';
import {
  trashOutline,
  addOutline,
  createOutline,
  cameraOutline,
  syncOutline,
  cloudDownloadOutline,
} from 'ionicons/icons';

import { toApiError } from '../api/api-error';
import { TodoImportService } from '../api/todo-import.service';
// Servicios: tareas (patrón repositorio), cámara, ubicación y sincronización
import type { PhotoResult } from '../services/camera.service';
import { CameraService } from '../services/camera.service';
import { LocationService } from '../services/location.service';
import { PERMISSION_INFO } from '../services/permissions';
import { SyncService } from '../services/sync.service';
import { TaskService } from '../services/task.service';
// Modelo de la tarea: Task es sólo un tipo (import type), TASK_LIMITS es un valor
import type { Task } from '../task.model';
import { TASK_LIMITS } from '../task.model';
// Piezas propias (atomic design): sólo lo que Ionic no trae
import {
  ChipComponent,
  LocationComponent,
  SectionLabelComponent,
  TimestampComponent,
  WeatherComponent,
} from '../ui/atoms';
import {
  EmptyStateComponent,
  PhotoThumbComponent,
  SectionHeadingComponent,
  SyncStatusComponent,
} from '../ui/molecules';
import { BoardHeaderComponent } from '../ui/organisms';
import { BoardTemplateComponent } from '../ui/templates';
/**
 * PÁGINA · Home (último nivel de atomic design: aquí viven los datos).
 * La lista y el formulario usan directamente los componentes de Ionic que pide
 * la pauta (ion-header, ion-list, ion-item, ion-input, ion-button): en atomic
 * design, Ionic hace de átomos y moléculas. Su estilo minimalista sale del tema
 * (variables.scss + global.scss) y de home.page.scss.
 */
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonInput,
    IonLabel,
    IonItemSliding,
    IonSpinner,
    IonIcon,
    IonButton,
    IonList,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonMenuButton,
    // piezas propias
    BoardTemplateComponent,
    BoardHeaderComponent,
    SectionHeadingComponent,
    SyncStatusComponent,
    PhotoThumbComponent,
    EmptyStateComponent,
    SectionLabelComponent,
    TimestampComponent,
    LocationComponent,
    WeatherComponent,
    ChipComponent,
  ],
})
export class HomePage {
  private readonly taskService = inject(TaskService);
  private readonly cameraService = inject(CameraService);
  private readonly locationService = inject(LocationService);
  private readonly syncService = inject(SyncService);
  private readonly importService = inject(TodoImportService);
  readonly tasks = this.taskService.tasks;
  readonly syncState = this.syncService.state;

  // Variables para el formulario
  newTitle: string = '';
  newDescription: string = '';
  /** Foto tomada para la tarea nueva (se adjunta al presionar Agregar) */
  readonly draftPhoto = signal<string | null>(null);

  // Límites de largo: los usa el ion-input (maxlength + contador) y addTask()
  readonly limits = TASK_LIMITS;

  // true mientras se guarda una tarea: el GPS puede tardar unos segundos
  readonly adding = signal(false);
  // true mientras la cámara está abierta / se importan tareas
  readonly takingPhoto = signal(false);
  readonly importing = signal(false);

  // inject(): pide servicios a Angular (reemplaza a los parámetros del constructor)
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  /** El aviso "ubicación bloqueada" se muestra una sola vez por sesión */
  private locationHintShown = false;

  // Una clase tiene UN solo constructor: aquí se registran los íconos
  constructor() {
    addIcons({
      trashOutline,
      addOutline,
      createOutline,
      cameraOutline,
      syncOutline,
      cloudDownloadOutline,
    });
  }

  /** Ionic lo llama cada vez que se entra a la página (también después de iniciar sesión) */
  async ionViewWillEnter(): Promise<void> {
    await this.taskService.load();
    // Trae los cambios de otros dispositivos y envía los pendientes
    void this.syncService.sync();
  }

  /** Habilita el botón sólo con texto real en ambos campos (no sólo espacios) */
  get canAdd(): boolean {
    return this.newTitle.trim() !== '' && this.newDescription.trim() !== '';
  }

  /** 0 → "01": numera la lista para que se lea ordenada */
  taskNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  async addTask(): Promise<void> {
    // if para validar los campos del formulario (y evita guardar dos veces con doble clic)
    if (!this.canAdd || this.adding()) {
      return;
    }
    this.adding.set(true);
    try {
      // El servicio limpia los textos, pone id, fecha, ubicación (GPS) y foto, y lo guarda
      const added = await this.taskService.add(this.newTitle, this.newDescription, this.draftPhoto() ?? undefined);
      if (added) {
        // aca se limpia el forms
        this.newTitle = '';
        this.newDescription = '';
        this.draftPhoto.set(null);
        // Después de un await, Angular (sin zone.js) no se entera solo: se le avisa
        this.cdr.markForCheck();
        await this.explainMissingLocation();
      }
    } catch {
      await this.toast('No se pudo guardar la tarea en el dispositivo.');
    } finally {
      // finally: se ejecuta siempre, aunque algo falle, así el botón no queda bloqueado
      this.adding.set(false);
    }
  }

  async deleteTask(id: number): Promise<void> {
    await this.taskService.remove(id);
  }

  /** Cámara: foto para la tarea nueva */
  async takeDraftPhoto(): Promise<void> {
    const photo = await this.capturePhoto();
    if (photo) {
      this.draftPhoto.set(photo);
    }
  }

  /** Cámara: adjunta (o cambia) la foto de una tarea existente */
  async attachPhoto(task: Task): Promise<void> {
    const photo = await this.capturePhoto();
    if (photo) {
      await this.taskService.setPhoto(task.id, photo);
      await this.toast('Foto adjuntada.');
    }
  }

  async removePhoto(task: Task): Promise<void> {
    await this.taskService.setPhoto(task.id, null);
  }

  /** API externa: importa las siguientes 5 tareas de DummyJSON */
  async importTasks(): Promise<void> {
    if (this.importing()) {
      return;
    }
    this.importing.set(true);
    try {
      const drafts = await this.importService.fetchDrafts(this.taskService.lastImportedId());
      const count = await this.taskService.importDrafts(drafts);
      await this.toast(count ? `Se importaron ${count} tareas desde la API.` : 'No había tareas nuevas para importar.');
    } catch (error) {
      await this.toast(`No se pudo importar: ${toApiError(error).message}`);
    } finally {
      this.importing.set(false);
    }
  }

  /** Sincroniza ahora con el servidor (además de la sincronización automática) */
  async syncNow(): Promise<void> {
    await this.syncService.sync();
  }

  /** Abre la ventana "Editar tarea" (ion-alert) con el título y la descripción actuales */
  async editTask(task: Task): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Editar tarea',
      cssClass: 'task-alert', // estilo minimalista: global.scss
      inputs: [
        {
          name: 'title', // con este nombre llega en data.title
          type: 'text',
          value: task.title,
          placeholder: 'Título de la tarea',
          attributes: { maxlength: TASK_LIMITS.title, 'aria-label': 'Título' },
        },
        {
          name: 'description', // con este nombre llega en data.description
          type: 'textarea',
          value: task.description,
          placeholder: 'Descripción',
          attributes: { maxlength: TASK_LIMITS.description, 'aria-label': 'Descripción' },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          cssClass: 'alert-button-confirm',
          handler: async (data: { title?: string; description?: string }) => {
            const saved = await this.saveEdit(task.id, data.title ?? '', data.description ?? '');
            if (!saved) {
              // return false: la ventana NO se cierra, así el usuario corrige el campo vacío
              alert.message = 'El título y la descripción no pueden quedar vacíos.';
            }
            return saved;
          },
        },
      ],
    });
    await alert.present(); // sin esto la ventana se crea pero nunca aparece
  }

  /** Guarda lo editado. Devuelve false (y no cambia nada) si algún campo queda vacío. */
  saveEdit(id: number, title: string, description: string): Promise<boolean> {
    // El servicio valida (ningún campo vacío) y guarda. Como tasks es un signal,
    // Angular redibuja la lista solo.
    return this.taskService.update(id, title, description);
  }

  /** Abre la cámara y traduce el resultado en un aviso para el usuario */
  private async capturePhoto(): Promise<string | null> {
    if (this.takingPhoto()) {
      return null;
    }
    this.takingPhoto.set(true);
    let result: PhotoResult;
    try {
      result = await this.cameraService.takePhoto();
    } finally {
      this.takingPhoto.set(false);
    }
    switch (result.status) {
      case 'ok':
        return result.dataUrl;
      case 'denied':
        await this.toast(PERMISSION_INFO.camera.deniedHelp);
        return null;
      case 'error':
        await this.toast(result.message);
        return null;
      default:
        return null; // cancelada por el usuario: no hace falta avisar
    }
  }

  /** Si la tarea quedó sin ubicación porque el permiso está bloqueado, se explica cómo activarlo (1 vez) */
  private async explainMissingLocation(): Promise<void> {
    if (this.locationHintShown || this.tasks().at(-1)?.location) {
      return;
    }
    if ((await this.locationService.checkPermission()) === 'denied') {
      this.locationHintShown = true;
      await this.toast(PERMISSION_INFO.location.deniedHelp);
    }
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      position: 'bottom',
      cssClass: 'task-toast',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
