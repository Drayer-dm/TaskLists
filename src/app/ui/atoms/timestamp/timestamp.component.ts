import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * ÁTOMO · Fecha y hora ("27/10/2026 · 16:58").
 * - Formato numérico día/mes/año: se lee igual en español sin registrar el
 *   locale "es" en Angular (los nombres de meses sí lo necesitarían).
 * - <time datetime="..."> deja la fecha exacta legible para el navegador.
 * - `label` se lee sólo con lector de pantalla ("Creada el ..."), así a la
 *   vista queda limpio y al oído se entiende qué fecha es.
 */
@Component({
  selector: 'app-timestamp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (label()) {
      <span class="sr-only">{{ label() }} </span>
    }
    <time [attr.datetime]="iso()">{{ value() | date: 'dd/MM/yyyy · HH:mm' }}</time>
  `,
  styles: `
    :host {
      display: inline-block;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      color: var(--color-muted);
      font-variant-numeric: tabular-nums;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class TimestampComponent {
  readonly value = input.required<Date>();
  readonly label = input('');

  protected readonly iso = computed(() => this.value().toISOString());
}
