import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { closeOutline } from 'ionicons/icons';

/**
 * MOLÉCULA · Miniatura de una foto (4:3) + botón para quitarla.
 * La usa el formulario (foto de la tarea nueva) y cada tarea de la lista.
 * No borra nada por su cuenta: sólo avisa con (remove) y la página decide.
 */
@Component({
  selector: 'app-photo-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon],
  template: `
    <img [src]="src()" [alt]="alt()" loading="lazy" decoding="async" />
    <ion-button fill="clear" color="medium" size="small" [attr.aria-label]="removeLabel()" (click)="remove.emit()">
      <ion-icon slot="icon-only" [icon]="closeIcon" aria-hidden="true" />
    </ion-button>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      max-width: 260px;
      margin: var(--space-3) 0 0;
    }
    img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border: var(--border-thin);
      border-radius: var(--radius-card);
    }
    ion-button {
      position: absolute;
      top: var(--space-1);
      right: var(--space-1);
      margin: 0;
      --background: var(--color-bg);
      --border-radius: var(--radius-pill);
    }
  `,
})
export class PhotoThumbComponent {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly removeLabel = input('Quitar foto');
  readonly remove = output();

  protected readonly closeIcon = closeOutline;
}
