import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { fakeAuth } from '../testing/test-helpers';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), fakeAuth('ana').provider],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // El menú lateral ofrece navegar a las páginas.
  // Se revisa el enlace (href) de cada opción: el texto de <ion-label> no es
  // confiable en el entorno de pruebas porque Ionic lo reubica internamente.
  it('muestra el menú con enlaces a /home, /permisos y /about', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    // sin zone.js: esperar a que Angular termine de pintar el menú (componente OnPush)
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-side-menu ion-item')).map(
      (item) => item.getAttribute('href'),
    );
    expect(links).toEqual(['/home', '/permisos', '/about']);
  });

  it('muestra el usuario con sesión y el botón para cerrarla', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const footer: HTMLElement = fixture.nativeElement.querySelector('.account');
    expect(footer.textContent).toContain('ana');
    expect(footer.textContent).toContain('Cerrar sesión');
  });
});
