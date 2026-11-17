import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { Concept } from '../../molecules';
import { ConceptCardComponent, SectionHeadingComponent } from '../../molecules';

/**
 * ORGANISMO · Sección informativa = encabezado con total + introducción +
 * lista de tarjetas de concepto. Reutiliza la molécula section-heading
 * (la misma que "TAREAS 3" en Home) con otro contenido.
 */
@Component({
  selector: 'app-info-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConceptCardComponent, SectionHeadingComponent],
  template: `
    <app-section-heading [label]="label()" [count]="concepts().length" />
    @if (intro()) {
      <p class="intro">{{ intro() }}</p>
    }
    <ol>
      @for (concept of concepts(); track concept.name) {
        <li><app-concept-card [concept]="concept" /></li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
    }
    .intro {
      margin: 0 0 var(--space-2);
      font-size: 1rem;
      line-height: 1.6;
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class InfoSectionComponent {
  readonly label = input.required<string>();
  readonly intro = input('');
  readonly concepts = input.required<readonly Concept[]>();
}
