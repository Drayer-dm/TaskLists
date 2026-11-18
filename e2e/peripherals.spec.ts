import { addTask, expect, locationPermissionNotDecided, register, taskRow, test } from './fixtures';

// Periféricos en un navegador real: GPS simulado por Playwright (Santiago) y
// cámara a través del selector de archivos (en el celular abre la cámara).

const PHOTO = 'e2e/fixtures/foto.jpg';

test.describe('GPS', () => {
  test('guarda y muestra la ubicación (GPS) donde se crea la tarea', async ({ page }) => {
    await register(page);
    await addTask(page, 'Tarea con GPS', 'Creada en Santiago');

    const fila = taskRow(page, 'Tarea con GPS');
    await expect(fila.locator('app-location')).toContainText('-33.43780, -70.65050 · ±12 m');
    await expect(fila.locator('app-location a')).toHaveAttribute(
      'href',
      'https://www.google.com/maps?q=-33.4378,-70.6505',
    );

    // Al recargar (como cerrar y abrir la app) la tarea y su ubicación siguen ahí
    await page.reload();
    await expect(fila.locator('app-location')).toContainText('-33.43780, -70.65050');
  });

  test('con la ubicación, agrega el clima del lugar (API Open-Meteo)', async ({ page }) => {
    await register(page);
    await addTask(page, 'Tarea con clima', 'Usa GPS + API');
    await expect(taskRow(page, 'Tarea con clima').locator('app-weather')).toContainText('18 °C · Nublado');
  });

  test.describe('permiso de ubicación sin decidir', () => {
    test.use({ permissions: [] });

    test('explica el permiso; si el usuario dice "Ahora no", crea la tarea sin ubicación y no insiste', async ({
      page,
    }) => {
      await locationPermissionNotDecided(page);
      await register(page);
      await addTask(page, 'Tarea sin GPS', 'Permiso rechazado');

      // Explicación previa, en palabras de la app, antes de la ventana del navegador/sistema
      const rationale = page.locator('ion-alert.task-alert');
      await expect(rationale).toContainText('Permiso de ubicación');
      await expect(rationale).toContainText('nunca en segundo plano');
      await rationale.getByRole('button', { name: 'Ahora no' }).click();

      const fila = taskRow(page, 'Tarea sin GPS');
      await expect(fila).toBeVisible();
      await expect(fila.locator('app-location')).toHaveCount(0);

      // Segunda tarea: no se vuelve a preguntar en la misma sesión
      await addTask(page, 'Otra sin GPS', 'Sin insistir');
      await expect(taskRow(page, 'Otra sin GPS')).toBeVisible();
      await expect(page.locator('ion-alert.task-alert')).toHaveCount(0);
    });
  });

  test.describe('permiso de ubicación bloqueado', () => {
    test.use({ permissions: [] });

    test('crea la tarea sin ubicación y explica cómo activarlo (una sola vez)', async ({ page }) => {
      await register(page);
      await addTask(page, 'Tarea bloqueada', 'Sin permiso');

      const fila = taskRow(page, 'Tarea bloqueada');
      await expect(fila).toBeVisible();
      await expect(fila.locator('app-location')).toHaveCount(0);
      await expect(page.locator('ion-toast')).toContainText('El permiso de ubicación está bloqueado');
    });
  });
});

test.describe('Cámara', () => {
  test('toma una foto, la adjunta a la tarea nueva y sigue ahí al recargar', async ({ page }) => {
    await register(page);

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Tomar foto' }).click();
    await (await chooser).setFiles(PHOTO);

    // Vista previa en el formulario
    const preview = page.locator('app-home section[boardSide] app-photo-thumb img');
    await expect(preview).toBeVisible();

    await addTask(page, 'Tarea con foto', 'Foto de la cordillera');
    const photo = taskRow(page, 'Tarea con foto').locator('app-photo-thumb img');
    await expect(photo).toHaveAttribute('alt', 'Foto de la tarea Tarea con foto');
    // Se guardó reducida como JPEG (data URL), no el archivo original
    await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    const width = await photo.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(width).toBeLessThanOrEqual(800);
    await expect(preview).toHaveCount(0);

    await page.reload();
    await expect(taskRow(page, 'Tarea con foto').locator('app-photo-thumb img')).toBeVisible();
  });

  test('adjunta y quita la foto de una tarea existente', async ({ page }) => {
    await register(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Adjuntar foto a la tarea Ejemplo' }).click();
    await (await chooser).setFiles(PHOTO);

    const fila = taskRow(page, 'Esta es una tarjeta de Ejemplo!');
    await expect(fila.locator('app-photo-thumb img')).toBeVisible();
    await expect(page.locator('ion-toast')).toContainText('Foto adjuntada');

    await page.getByRole('button', { name: 'Quitar foto de la tarea Ejemplo' }).click();
    await expect(fila.locator('app-photo-thumb')).toHaveCount(0);
  });

  test('rechaza un archivo que no es una imagen', async ({ page }) => {
    await register(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Tomar foto' }).click();
    await (
      await chooser
    ).setFiles({ name: 'virus.txt', mimeType: 'text/plain', buffer: Buffer.from('no soy una foto') });
    await expect(page.locator('ion-toast')).toContainText('no es una imagen válida');
    await expect(page.locator('app-home section[boardSide] app-photo-thumb')).toHaveCount(0);
  });
});

test.describe('Página de permisos', () => {
  test('muestra el estado de cada permiso y para qué se usa', async ({ page }) => {
    await register(page);
    await page.goto('/permisos');
    const location = page.locator('[data-kind="location"]');
    await expect(location).toContainText('Concedido');
    await expect(location).toContainText('Guardar dónde se creó cada tarea');
    await expect(page.locator('[data-kind="camera"]')).toContainText('No requerido aquí');
  });

  test.describe('sin permiso de ubicación', () => {
    test.use({ permissions: [] });

    test('si está bloqueado, explica cómo activarlo en Ajustes', async ({ page }) => {
      await register(page);
      await page.goto('/permisos');
      const location = page.locator('[data-kind="location"]');
      await expect(location).toContainText('Bloqueado');
      await expect(location).toContainText('Ajustes › Apps › TaskList › Permisos');
    });

    test('ofrece el botón "Permitir" cuando el permiso aún no se decide', async ({ page }) => {
      await locationPermissionNotDecided(page);
      await register(page);
      await page.goto('/permisos');
      await expect(page.locator('[data-kind="location"]')).toContainText('Sin decidir');
      await expect(page.getByRole('button', { name: 'Permitir Ubicación' })).toBeVisible();
    });
  });
});
