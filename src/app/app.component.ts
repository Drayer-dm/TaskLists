import { Component } from '@angular/core';
import {
  IonApp,
  IonRouterOutlet,
  // Menú lateral: componentes de Ionic + organismo propio con los enlaces
  IonContent,
  IonHeader,
  IonMenu,
  IonSplitPane,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { informationCircleOutline, listOutline } from 'ionicons/icons';

import type { MenuLink } from './ui/organisms';
import { SideMenuComponent } from './ui/organisms';

// Componente raíz: <ion-app> es el contenedor de Ionic, <ion-menu> el menú
// lateral y <ion-router-outlet> muestra la página de la ruta actual.
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [
    IonApp,
    IonRouterOutlet,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    SideMenuComponent,
  ],
})
export class AppComponent {
  /** Opciones del menú. El ícono va como dato: no necesita addIcons(). */
  readonly links: MenuLink[] = [
    { label: 'Tareas', url: '/home', icon: listOutline },
    { label: 'Acerca de', url: '/about', icon: informationCircleOutline },
  ];

  constructor() {}
}
