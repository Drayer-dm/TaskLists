import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon, IonItem, IonLabel, IonList, IonMenuToggle } from '@ionic/angular';

import { SectionLabelComponent } from '../../atoms';

/** Una opción del menú: texto, ruta y dato del ícono (de 'ionicons/icons'). */
export interface MenuLink {
  label: string;
  url: string;
  icon: string;
}

/**
 * ORGANISMO · Contenido del menú lateral (la lista de enlaces).
 * - Va dentro del <ion-menu> de AppComponent; las opciones llegan por input.
 * - routerLink navega sin recargar la página; routerLinkActive marca la página
 *   actual (clase "active" + aria-current="page" para lectores de pantalla).
 * - ion-menu-toggle cierra el menú al tocar una opción en el celular.
 *   autoHide=false: en PC, con el menú fijo, las opciones siguen visibles.
 */
@Component({
  selector: 'app-side-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonItem, IonLabel, IonList, IonMenuToggle, RouterLink, RouterLinkActive, SectionLabelComponent],
  template: `
    <app-section-label class="heading">Navegación</app-section-label>
    <ion-list lines="none">
      @for (link of links(); track link.url) {
        <ion-menu-toggle [autoHide]="false">
          <ion-item
            button
            [detail]="false"
            [routerLink]="link.url"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            <ion-icon slot="start" [icon]="link.icon" aria-hidden="true" />
            <ion-label>{{ link.label }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
      }
    </ion-list>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--space-5) var(--space-3);
    }
    .heading {
      padding: 0 var(--space-4) var(--space-3);
    }
    ion-list {
      padding: 0;
      background: transparent;
    }
    ion-item {
      --background: transparent;
      --background-hover: var(--color-tint);
      --background-hover-opacity: 1;
      --border-radius: var(--radius-pill);
      --padding-start: var(--space-4);
      --min-height: 48px;
      margin-bottom: var(--space-1);
      font-size: 0.95rem;
    }
    ion-icon {
      margin-inline-end: var(--space-4);
      color: var(--color-muted);
    }
    /* página actual: fondo suave y texto/ícono en tinta */
    ion-item.active {
      --background: var(--color-tint);
      font-weight: 500;
    }
    ion-item.active ion-icon {
      color: var(--color-ink);
    }
  `,
})
export class SideMenuComponent {
  readonly links = input.required<readonly MenuLink[]>();
}
