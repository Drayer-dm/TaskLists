import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { checkmarkDoneOutline } from 'ionicons/icons';

/**
 * MOLÉCULA · Estado vacío = ícono + mensaje + ayuda.
 * Evita una pantalla en blanco cuando no hay tareas y dice qué hacer.
 * Los inputs se llaman message/hint y no "title": un input "title" también
 * queda como atributo HTML y el navegador mostraría un tooltip.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <ion-icon [icon]="icon" aria-hidden="true" />
    <p class="message">{{ message() }}</p>
    @if (hint()) {
      <p class="hint">{{ hint() }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      padding: var(--space-6) var(--space-4);
      border: 1px dashed var(--color-line);
      border-radius: var(--radius-card);
      text-align: center;
    }
    ion-icon {
      font-size: 1.75rem;
      color: var(--color-muted);
    }
    p {
      margin: 0;
    }
    .message {
      font-size: 1rem;
      font-weight: 500;
    }
    .hint {
      font-size: 0.875rem;
      color: var(--color-muted);
    }
  `,
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
  readonly hint = input('');

  /** El ícono se pasa como dato: no necesita addIcons() y sólo se empaqueta éste */
  protected readonly icon = checkmarkDoneOutline;
}
