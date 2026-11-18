import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { ARCHITECTURE, PATTERNS } from './about.content';
import { AboutPage } from './about.page';

describe('AboutPage', () => {
  let fixture: ComponentFixture<AboutPage>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(AboutPage);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Una tarjeta por cada concepto de arquitectura y por cada patrón
  it('muestra todas las tarjetas de arquitectura y patrones', () => {
    const cards = element.querySelectorAll('app-concept-card');
    expect(cards.length).toBe(ARCHITECTURE.length + PATTERNS.length);
  });

  // El código de ejemplo se muestra como texto: no se interpreta como plantilla
  it('muestra el código de ejemplo tal cual (con @if y llaves)', () => {
    const code = Array.from(element.querySelectorAll('app-code-block code'))
      .map((c) => c.textContent)
      .join('\n');
    expect(code).toContain('@if (tasks().length) {');
    expect(code).toContain('{{ task.title }}');
  });
});
