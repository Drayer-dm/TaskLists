import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SectionLabelComponent } from '../../atoms';

/** Formato "martes, 27 de octubre". Intl evita tener que registrar el locale "es" en Angular. */
const DATE_FORMAT = new Intl.DateTimeFormat('es', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * ORGANISMO · Cabecera de la página: etiqueta + texto grande.
 * El texto grande es `heading` si se entrega (p. ej. en "Acerca de") o, si no,
 * la fecha de hoy (en Home). El título de la app está en <ion-title>.
 * Se llama heading y no title: un input "title" quedaría también como
 * atributo HTML y el navegador mostraría un tooltip.
 */
@Component({
  selector: 'app-board-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionLabelComponent],
  templateUrl: './board-header.component.html',
  styleUrl: './board-header.component.scss',
})
export class BoardHeaderComponent {
  readonly eyebrow = input('');
  readonly heading = input('');

  /** Se calcula al crear el componente (cada vez que se abre la página) */
  protected readonly today = DATE_FORMAT.format(new Date());
}
