// Angular: componente, directivas comunes y [(ngModel)] del formulario
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
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
  // Botón ☰ que abre el menú lateral
  IonButtons,
  IonMenuButton,
  // Ventana emergente (ion-alert) para editar una tarea
  AlertController,
} from '@ionic/angular';
// Íconos: se registran con addIcons() en el constructor
import { addIcons } from 'ionicons';
import { trashOutline, addOutline, createOutline } from 'ionicons/icons';

// Servicio que guarda las tareas en el dispositivo (patrón repositorio)
import { TaskService } from '../services/task.service';
// Modelo de la tarea: Task es sólo un tipo (import type), TASK_LIMITS es un valor
import type { Task } from '../task.model';
import { TASK_LIMITS } from '../task.model';
// Piezas propias (atomic design): sólo lo que Ionic no trae
import { SectionLabelComponent, TimestampComponent } from '../ui/atoms';
import { EmptyStateComponent, SectionHeadingComponent } from '../ui/molecules';
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
    EmptyStateComponent,
    SectionLabelComponent,
    TimestampComponent,
  ],
})
export class HomePage {
  private readonly taskService = inject(TaskService);
  readonly tasks = this.taskService.tasks;

  //Variables para el formulario
  newTitle: string = '';
  newDescription: string = '';

  // Límites de largo: los usa el ion-input (maxlength + contador) y addTask()
  readonly limits = TASK_LIMITS;

  // inject(): pide servicios a Angular (reemplaza a los parámetros del constructor)
  private readonly alertCtrl = inject(AlertController);
  private readonly cdr = inject(ChangeDetectorRef);

  // Una clase tiene UN solo constructor: aquí se registran los 3 íconos
  constructor() {
    addIcons({ trashOutline, addOutline, createOutline });
    void this.taskService.load();
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
    if (!this.canAdd) {
      return;
    }
    const added = await this.taskService.add(this.newTitle, this.newDescription);
    if (added) {
      this.newTitle = '';
      this.newDescription = '';
      this.cdr.markForCheck();
    }
  }

  async deleteTask(id: number): Promise<void> {
    await this.taskService.remove(id);
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
}
