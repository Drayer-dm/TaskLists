import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ChipComponent, SectionLabelComponent } from '../../atoms';

/**
 * MOLÉCULA · Encabezado de sección = etiqueta + total opcional ("TAREAS  3").
 * Renderiza un <h2> real para que los lectores de pantalla puedan saltar
 * entre secciones. Si `count` es null, sólo muestra la etiqueta.
 */
@Component({
  selector: 'app-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, SectionLabelComponent],
  template: `
    <h2>
      <app-section-label>{{ label() }}</app-section-label>
      @if (count() !== null) {
        <app-chip>{{ count() }}</app-chip>
      }
    </h2>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--space-4);
    }
    h2 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: 28px;
      margin: 0;
    }
  `,
})
export class SectionHeadingComponent {
  readonly label = input.required<string>();
  readonly count = input<number | null>(null);
}
