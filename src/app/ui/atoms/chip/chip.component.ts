import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * ÁTOMO · Chip / píldora con borde (p. ej. el total de tareas).
 * Sólo decorativo/informativo: no es clicable, por eso no es un <button>.
 */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      padding: 2px var(--space-3);
      border: 1px solid var(--color-ink-soft);
      border-radius: var(--radius-pill);
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      color: var(--color-ink-soft);
      white-space: nowrap;
    }
  `,
})
export class ChipComponent {}
