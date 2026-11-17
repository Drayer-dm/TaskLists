import type { Routes } from '@angular/router';

// Rutas de la app: Home (la lista de tareas) y Acerca de (arquitectura y patrones).
export const routes: Routes = [
  {
    path: 'home',
    // loadComponent: la página se descarga recién cuando se visita (carga perezosa)
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.page').then((m) => m.AboutPage),
  },
  {
    // Al abrir la raíz ("/") se redirige a /home
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
