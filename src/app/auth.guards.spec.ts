import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideRouter, UrlTree } from '@angular/router';

import { fakeAuth } from '../testing/test-helpers';

import { authGuard, guestGuard } from './auth.guards';

// Guards de rutas: deciden si una página se puede abrir según haya sesión o no
describe('guards de autenticación', () => {
  function run(guard: typeof authGuard, user: string | null) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), fakeAuth(user).provider] });
    return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  }

  it('authGuard deja pasar con sesión', async () => {
    expect(await run(authGuard, 'ana')).toBe(true);
  });

  it('authGuard manda a /login sin sesión', async () => {
    const result = await run(authGuard, null);
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });

  it('guestGuard manda a /home si ya hay sesión', async () => {
    expect(String(await run(guestGuard, 'ana'))).toBe('/home');
  });

  it('guestGuard deja ver el login sin sesión', async () => {
    expect(await run(guestGuard, null)).toBe(true);
  });
});
