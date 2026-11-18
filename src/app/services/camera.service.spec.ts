import { TestBed } from '@angular/core/testing';
import type { MediaResult, PermissionStatus } from '@capacitor/camera';
import { MediaType } from '@capacitor/camera';
import type { PermissionState } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

import type { CameraApi } from './camera.service';
import { CAMERA, CameraService, IMAGE_COMPRESSOR, PHOTO_MAX_LENGTH } from './camera.service';
import { PermissionRationaleService } from './permissions';

// Pruebas de la cámara con un plugin FALSO (igual que el GPS): se prueba la
// lógica de permisos, la validación y la reducción de la foto sin una cámara real.

const COMPRESSED = 'data:image/jpeg;base64,/9j/COMPRIMIDA';

function status(camera: PermissionState): PermissionStatus {
  return { camera, photos: 'granted' };
}

/** Cámara falsa: "saca" una foto con la ruta indicada */
function fakeCamera(permission: PermissionState = 'granted') {
  return {
    takePhoto: vi.fn(
      async () => ({ type: MediaType.Photo, webPath: 'blob:foto-original', saved: false }) as MediaResult,
    ),
    checkPermissions: vi.fn(async () => status(permission)),
    requestPermissions: vi.fn(async () => status('granted')),
  } satisfies CameraApi;
}

function setup(camera: CameraApi, { native = false, accepts = true, compressed = COMPRESSED } = {}) {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(native);
  const compress = vi.fn(async () => compressed);
  const rationale = { explain: vi.fn(async () => accepts) };
  TestBed.configureTestingModule({
    providers: [
      { provide: CAMERA, useValue: camera },
      { provide: IMAGE_COMPRESSOR, useValue: compress },
      { provide: PermissionRationaleService, useValue: rationale },
    ],
  });
  return { service: TestBed.inject(CameraService), compress, rationale };
}

describe('CameraService', () => {
  beforeEach(() => {
    // jsdom no implementa revokeObjectURL
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toma la foto y la devuelve reducida (JPEG en data URL)', async () => {
    const camera = fakeCamera();
    const { service, compress } = setup(camera);

    expect(await service.takePhoto()).toEqual({ status: 'ok', dataUrl: COMPRESSED });
    expect(compress).toHaveBeenCalledWith('blob:foto-original');
  });

  it('pide la foto reducida, con orientación corregida y sin guardarla en la galería', async () => {
    const camera = fakeCamera();
    await setup(camera).service.takePhoto();
    expect(camera.takePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 70, targetWidth: 1280, correctOrientation: true, saveToGallery: false }),
    );
  });

  it('libera la memoria del archivo temporal del navegador', async () => {
    await setup(fakeCamera()).service.takePhoto();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto-original');
  });

  it('si el usuario cierra la cámara sin sacar foto, devuelve "cancelled" (no es un error)', async () => {
    const camera = fakeCamera();
    camera.takePhoto.mockRejectedValue(new Error('User cancelled photos app'));
    expect(await setup(camera).service.takePhoto()).toEqual({ status: 'cancelled' });
  });

  it('si la cámara falla devuelve un error con mensaje, sin romper la app', async () => {
    const camera = fakeCamera();
    camera.takePhoto.mockRejectedValue(new Error('Camera unavailable'));
    expect(await setup(camera).service.takePhoto()).toEqual({
      status: 'error',
      message: 'No se pudo abrir la cámara.',
    });
  });

  it('rechaza archivos que no son imágenes', async () => {
    const { service } = setup(fakeCamera(), { compressed: 'data:text/html;base64,PHNjcmlwdD4=' });
    expect((await service.takePhoto()).status).toBe('error');
  });

  it('rechaza imágenes demasiado grandes', async () => {
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(PHOTO_MAX_LENGTH);
    const { service } = setup(fakeCamera(), { compressed: huge });
    expect((await service.takePhoto()).status).toBe('error');
  });

  it('si la imagen no se puede leer, devuelve error', async () => {
    const { service, compress } = setup(fakeCamera());
    compress.mockRejectedValue(new Error('No se pudo leer la imagen'));
    expect((await service.takePhoto()).status).toBe('error');
  });

  it('en el navegador no pide permiso de cámara (la foto llega por el selector de archivos)', async () => {
    const camera = fakeCamera('prompt');
    const { service, rationale } = setup(camera);
    expect(await service.checkPermission()).toBe('not-needed');
    expect((await service.takePhoto()).status).toBe('ok');
    expect(rationale.explain).not.toHaveBeenCalled();
    expect(camera.requestPermissions).not.toHaveBeenCalled();
  });

  describe('permisos en Android', () => {
    it('con permiso concedido abre la cámara directo', async () => {
      const camera = fakeCamera('granted');
      const { service, rationale } = setup(camera, { native: true });
      expect((await service.takePhoto()).status).toBe('ok');
      expect(rationale.explain).not.toHaveBeenCalled();
    });

    it('la primera vez explica para qué es y pide sólo el permiso de cámara', async () => {
      const camera = fakeCamera('prompt');
      const { service, rationale } = setup(camera, { native: true });
      expect((await service.takePhoto()).status).toBe('ok');
      expect(rationale.explain).toHaveBeenCalledWith('camera');
      expect(camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] });
    });

    it('si dice "Ahora no" en la explicación, no abre la cámara y lo trata como cancelado', async () => {
      const camera = fakeCamera('prompt');
      const { service } = setup(camera, { native: true, accepts: false });
      expect(await service.takePhoto()).toEqual({ status: 'cancelled' });
      expect(camera.requestPermissions).not.toHaveBeenCalled();
      expect(camera.takePhoto).not.toHaveBeenCalled();
    });

    it('si rechaza el permiso del sistema devuelve "denied" y no abre la cámara', async () => {
      const camera = fakeCamera('prompt');
      camera.requestPermissions.mockResolvedValue(status('denied'));
      expect(await setup(camera, { native: true }).service.takePhoto()).toEqual({ status: 'denied' });
      expect(camera.takePhoto).not.toHaveBeenCalled();
    });

    it('si el permiso ya estaba bloqueado, no insiste', async () => {
      const camera = fakeCamera('denied');
      const { service, rationale } = setup(camera, { native: true });
      expect(await service.takePhoto()).toEqual({ status: 'denied' });
      expect(rationale.explain).not.toHaveBeenCalled();
      expect(camera.requestPermissions).not.toHaveBeenCalled();
    });

    it('si el sistema bloquea la cámara al abrirla, devuelve "denied"', async () => {
      const camera = fakeCamera('granted');
      camera.takePhoto.mockRejectedValue(new Error('User denied access to camera'));
      expect(await setup(camera, { native: true }).service.takePhoto()).toEqual({ status: 'denied' });
    });
  });
});
