import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { authInterceptor, resilienceInterceptor } from './app/api/interceptors';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

// Punto de entrada: arranca Angular con AppComponent (sin NgModule, todo standalone).
// No se usa zone.js: Angular detecta los cambios por los eventos del template y los signals.
bootstrapApplication(AppComponent, {
  providers: [
    // Ionic guarda las páginas visitadas para animar la navegación como una app nativa
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    // Rutas + precarga de páginas en segundo plano
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // Cliente HTTP (fetch) + interceptores: credenciales sólo a nuestra API, timeout y reintentos
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, resilienceInterceptor])),
  ],
});
