import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CameraService } from '../services/camera.service';
import { LocationService } from '../services/location.service';
import type { AppPermissionState } from '../services/permissions';

import { PermissionsPage } from './permissions.page';

describe('PermissionsPage', () => {
  function setup(location: AppPermissionState, camera: AppPermissionState) {
    const locationService = {
      checkPermission: vi.fn(async () => location),
      requestPermission: vi.fn(async (): Promise<AppPermissionState> => 'granted'),
    };
    const cameraService = {
      checkPermission: vi.fn(async () => camera),
      requestPermission: vi.fn(async (): Promise<AppPermissionState> => 'granted'),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LocationService, useValue: locationService },
        { provide: CameraService, useValue: cameraService },
      ],
    });
    const fixture = TestBed.createComponent(PermissionsPage);
    return { fixture, page: fixture.componentInstance, locationService, cameraService };
  }

  function row(element: HTMLElement, kind: string): HTMLElement {
    return element.querySelector(`[data-kind="${kind}"]`)!;
  }

  it('muestra el estado de cada permiso y para qué se usa', async () => {
    const { fixture, page } = setup('granted', 'prompt');
    await page.refresh();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(row(element, 'location').textContent).toContain('Concedido');
    expect(row(element, 'location').textContent).toContain('Guardar dónde se creó cada tarea');
    expect(row(element, 'camera').textContent).toContain('Sin decidir');
  });

  it('permite pedir un permiso que aún no se decide', async () => {
    const { fixture, page, cameraService } = setup('granted', 'prompt');
    await page.refresh();
    fixture.detectChanges();
    const button: HTMLElement = row(fixture.nativeElement, 'camera').querySelector('ion-button')!;
    expect(button.getAttribute('aria-label')).toBe('Permitir Cámara');

    await page.request('camera');
    fixture.detectChanges();
    expect(cameraService.requestPermission).toHaveBeenCalled();
    expect(row(fixture.nativeElement, 'camera').textContent).toContain('Concedido');
  });

  it('si está bloqueado, explica cómo activarlo en Ajustes (no muestra "Permitir")', async () => {
    const { fixture, page } = setup('denied', 'granted');
    await page.refresh();
    fixture.detectChanges();
    const location = row(fixture.nativeElement, 'location');
    expect(location.textContent).toContain('Ajustes › Apps › TaskList › Permisos');
    expect(location.querySelector('ion-button')).toBeNull();
  });

  it('lista las prácticas de privacidad de la app', () => {
    const { fixture } = setup('granted', 'granted');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).querySelector('.practices')!.textContent;
    expect(text).toContain('nunca se envían al servidor');
  });
});
