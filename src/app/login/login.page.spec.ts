import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavController } from '@ionic/angular';

import { AUTH_CONFIG, AuthService } from '../services/auth.service';

import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let navigateRoot: ReturnType<typeof vi.fn>;

  function create() {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance, auth: TestBed.inject(AuthService) };
  }

  beforeEach(() => {
    localStorage.clear();
    navigateRoot = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AUTH_CONFIG, useValue: { iterations: 1_000 } },
        { provide: NavController, useValue: { navigateRoot } },
      ],
    });
  });

  it('crea la cuenta, abre la sesión y va a la lista de tareas', async () => {
    const { page, auth } = create();
    page.setMode('register');
    page.username = 'drayer';
    page.password = 'clave-segura';
    page.confirm = 'clave-segura';

    await page.submit();

    expect(auth.user()).toBe('drayer');
    expect(navigateRoot).toHaveBeenCalledWith('/home');
    // La contraseña no queda en memoria
    expect(page.password).toBe('');
  });

  it('avisa si las contraseñas no coinciden', async () => {
    const { page, fixture } = create();
    page.setMode('register');
    page.username = 'drayer';
    page.password = 'clave-segura';
    page.confirm = 'otra-clave';

    await page.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('no coinciden');
    expect(navigateRoot).not.toHaveBeenCalled();
  });

  it('muestra el error genérico si la contraseña es incorrecta', async () => {
    const { page, auth } = create();
    await auth.register('drayer', 'clave-segura');
    await auth.logout();

    page.username = 'drayer';
    page.password = 'incorrecta';
    await page.submit();

    expect(page.error()).toBe('Usuario o contraseña incorrectos.');
    expect(auth.user()).toBeNull();
  });

  it('pide completar los campos vacíos', async () => {
    const { page } = create();
    await page.submit();
    expect(page.error()).toBe('Completa el usuario y la contraseña.');
  });
});
