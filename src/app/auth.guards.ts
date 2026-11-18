import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { AuthService } from './services/auth.service';

// Ojo: inject() sólo funciona ANTES del primer await (después ya no hay contexto de inyección)

/** Protege las páginas con tareas: sin sesión, manda a /login */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.user() ? true : router.parseUrl('/login');
};

/** /login sólo tiene sentido sin sesión: con sesión, manda a /home */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();
  return auth.user() ? router.parseUrl('/home') : true;
};
