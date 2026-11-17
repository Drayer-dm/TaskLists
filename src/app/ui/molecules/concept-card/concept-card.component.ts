import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CodeBlockComponent, SectionLabelComponent } from '../../atoms';

/** Un concepto o patrón explicado: nombre, qué es, dónde está y un ejemplo. */
export interface Concept {
  name: string;
  description: string;
  /** Archivo(s) del proyecto donde se ve aplicado */
  location: string;
  /** Fragmento de código real del proyecto */
  code: string;
}

/**
 * MOLÉCULA · Tarjeta de concepto = título + explicación + archivo + código.
 * Une los átomos section-label y code-block. Se usa en la página "Acerca de".
 */
@Component({
  selector: 'app-concept-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlockComponent, SectionLabelComponent],
  template: `
    <h3>{{ concept().name }}</h3>
    <p class="description">{{ concept().description }}</p>
    <p class="location">
      <app-section-label>En el proyecto</app-section-label>
      <code>{{ concept().location }}</code>
    </p>
    <app-code-block [code]="concept().code" [label]="'Ejemplo: ' + concept().name" />
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5) 0;
      border-bottom: var(--border-thin);
    }
    h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 500;
      letter-spacing: 0.01em;
    }
    p {
      margin: 0;
    }
    .description {
      color: var(--color-ink-soft);
      font-size: 0.95rem;
      line-height: 1.6;
    }
    .location {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-2);
    }
    .location code {
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }
  `,
})
export class ConceptCardComponent {
  readonly concept = input.required<Concept>();
}
