import { Component, inject } from '@angular/core';
import {
  IonApp,
  IonRouterOutlet,
  // Menú lateral: componentes de Ionic + organismo propio con los enlaces
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenu,
  IonMenuToggle,
  IonSplitPane,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular';
import { informationCircleOutline, listOutline, logOutOutline, shieldCheckmarkOutline } from 'ionicons/icons';

import { AuthService } from './services/auth.service';
import { SyncService } from './services/sync.service';
import { TaskService } from './services/task.service';
import { SectionLabelComponent } from './ui/atoms';
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
    IonMenuToggle,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonIcon,
    SideMenuComponent,
    SectionLabelComponent,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly taskService = inject(TaskService);
  // Se crea al abrir la app: así sincroniza aunque se esté en otra página
  private readonly sync = inject(SyncService);
  private readonly navCtrl = inject(NavController);

  /** Opciones del menú. El ícono va como dato: no necesita addIcons(). */
  readonly links: MenuLink[] = [
    { label: 'Tareas', url: '/home', icon: listOutline },
    { label: 'Permisos y privacidad', url: '/permisos', icon: shieldCheckmarkOutline },
    { label: 'Acerca de', url: '/about', icon: informationCircleOutline },
  ];

  protected readonly logoutIcon = logOutOutline;

  constructor() {
    void this.auth.restore();
  }

  /** Cierra la sesión y vuelve al login sin dejar las tareas del usuario en pantalla */
  async logout(): Promise<void> {
    await this.auth.logout();
    this.taskService.clear();
    this.sync.reset();
    // navigateRoot: borra el historial, el botón "atrás" no vuelve a las tareas
    await this.navCtrl.navigateRoot('/login');
  }
}
