import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * TEMPLATE · Esqueleto de la pantalla, sin datos ni lógica.
 * Define 3 "huecos" con <ng-content select>; la página decide qué va en cada uno
 * marcando el elemento con el atributo: boardHeader, boardSide, boardMain.
 *
 *  celular / tablet (1 columna)     PC ≥ 900px (2 columnas)
 *  ┌──────────────┐                 ┌─────────────────────────┐
 *  │ header       │                 │ header                  │
 *  │ side (form)  │                 │ side (fijo) │ main      │
 *  │ main (lista) │                 │             │ (lista)   │
 *  └──────────────┘                 └─────────────────────────┘
 */
@Component({
  selector: 'app-board-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-template.component.html',
  styleUrl: './board-template.component.scss',
})
export class BoardTemplateComponent {}
