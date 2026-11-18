import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TaskLocation } from '../../../task.model';

/**
 * ÁTOMO · Ubicación ("-33.43780, -70.65050 · ±12 m").
 * - 5 decimales ≈ 1 metro: suficiente para marcar el punto en un mapa.
 * - Es un enlace: al tocarlo abre el punto en Google Maps.
 * - `label` se lee sólo con lector de pantalla ("Creada en ..."), igual que en timestamp.
 */
@Component({
  selector: 'app-location',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [href]="mapUrl()" target="_blank" rel="noopener noreferrer">
      @if (label()) {
        <span class="sr-only">{{ label() }} </span>
      }
      {{ coords() }} · ±{{ accuracy() }} m
    </a>
  `,
  styles: `
    :host {
      display: block;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      font-variant-numeric: tabular-nums;
    }
    a {
      color: var(--color-muted);
      text-decoration: none;
    }
    a:hover,
    a:focus-visible {
      text-decoration: underline;
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
export class LocationComponent {
  readonly value = input.required<TaskLocation>();
  readonly label = input('');

  protected readonly coords = computed(
    () => `${this.value().latitude.toFixed(5)}, ${this.value().longitude.toFixed(5)}`,
  );
  protected readonly accuracy = computed(() => Math.round(this.value().accuracy));
  protected readonly mapUrl = computed(
    () => `https://www.google.com/maps?q=${this.value().latitude},${this.value().longitude}`,
  );
}
