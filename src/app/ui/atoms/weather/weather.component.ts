import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { TaskWeather } from '../../../task.model';

/**
 * ÁTOMO · Clima al crear la tarea ("18 °C · Nublado").
 * Dato adicional que llega de la API de Open-Meteo.
 */
@Component({
  selector: 'app-weather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sr-only">Clima al crearla: </span>
    {{ value().temperature }} °C · {{ value().description }}
  `,
  styles: `
    :host {
      display: block;
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
export class WeatherComponent {
  readonly value = input.required<TaskWeather>();
}
