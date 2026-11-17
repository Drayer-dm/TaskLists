import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * TEMPLATE · Página de lectura: cabecera + una sola columna de texto.
 * Huecos: pageHeader y pageMain. La columna se limita a ~760px porque las
 * líneas de texto muy largas cuestan de leer en PC.
 * Usa los mismos tokens de ancho y margen que board-template, así ambas
 * páginas quedan alineadas con la barra superior.
 */
@Component({
  selector: 'app-page-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header><ng-content select="[pageHeader]" /></header>
    <div class="main"><ng-content select="[pageMain]" /></div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
      max-width: var(--layout-max);
      margin: 0 auto;
      padding: var(--space-5) calc(var(--layout-gutter) + var(--ion-safe-area-right, 0px))
        calc(var(--space-6) + var(--ion-safe-area-bottom, 0px))
        calc(var(--layout-gutter) + var(--ion-safe-area-left, 0px));
    }
    .main {
      display: grid;
      gap: var(--space-6);
      max-width: 760px;
      min-width: 0;
    }
  `,
})
export class PageTemplateComponent {}
