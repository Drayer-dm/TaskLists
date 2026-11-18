import type { Routes } from '@angular/router';

import { authGuard, guestGuard } from './auth.guards';

// Rutas de la app. canActivate (guards): las tareas y los permisos piden sesión iniciada.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    // loadComponent: la página se descarga recién cuando se visita (carga perezosa)
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'permisos',
    canActivate: [authGuard],
    loadComponent: () => import('./permissions/permissions.page').then((m) => m.PermissionsPage),
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.page').then((m) => m.AboutPage),
  },
  {
    // Al abrir la raíz ("/") se redirige a /home (y el guard a /login si no hay sesión)
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    // Cualquier otra URL (mal escrita o que no existe) también vuelve a /home
    path: '**',
    redirectTo: 'home',
  },
];
