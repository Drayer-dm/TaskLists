import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * ÁTOMO · Etiqueta de sección ("NUEVA TAREA", "TAREAS"...).
 * Mayúsculas con letras muy espaciadas: el rasgo más reconocible del estilo.
 * Es un <span> y no un <h2> a propósito: el nivel de encabezado lo decide
 * quien lo usa (envolviéndolo en un <h2> si es un título de verdad).
 */
@Component({
  selector: 'app-section-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: var(--tracking-label);
      text-transform: uppercase;
      color: var(--color-ink-soft);
    }
  `,
})
export class SectionLabelComponent {}
