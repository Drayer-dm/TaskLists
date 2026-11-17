import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // El menú lateral ofrece navegar a las dos páginas.
  // Se revisa el enlace (href) de cada opción: el texto de <ion-label> no es
  // confiable en el entorno de pruebas porque Ionic lo reubica internamente.
  it('muestra el menú con enlaces a /home y /about', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    // sin zone.js: esperar a que Angular termine de pintar el menú (componente OnPush)
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-side-menu ion-item')).map(
      (item) => item.getAttribute('href'),
    );
    expect(links).toEqual(['/home', '/about']);
  });
});
