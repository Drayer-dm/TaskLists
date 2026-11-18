import type { Locator, Page } from '@playwright/test';

import { API_URL, addTask, CORS, expect, register, syncKey, taskRow, test, uniqueUser } from './fixtures';

// Integración con servicios web: importación desde DummyJSON (simulada), y
// sincronización con la API propia REAL (node api/server.mjs).

const syncStatus = (page: Page): Locator => page.locator('app-sync-status [role="status"]');

test.describe('Importar desde API externa (DummyJSON)', () => {
  test('importa 5 tareas, las marca como "API" y no las duplica', async ({ page }) => {
    await register(page);
    await page.getByRole('button', { name: 'Importar tareas' }).click();

    await expect(page.locator('ion-toast')).toContainText('Se importaron 5 tareas');
    await expect(page.locator('app-home ion-item.task')).toHaveCount(7);
    const imported = taskRow(page, 'Memorize a poem');
    await expect(imported.locator('app-chip.source')).toHaveText('API');
    await expect(imported).toContainText('Importada desde DummyJSON');

    // La segunda importación trae las siguientes (paginación), sin repetir
    await page.getByRole('button', { name: 'Importar tareas' }).click();
    await expect(page.locator('app-home ion-item.task')).toHaveCount(12);
  });

  test('nunca envía las credenciales del usuario a la API de terceros', async ({ page }) => {
    await register(page);
    const request = page.waitForRequest((req) => req.url().startsWith('https://dummyjson.com/todos'));
    await page.getByRole('button', { name: 'Importar tareas' }).click();
    const headers = (await request).headers();
    expect(headers['authorization']).toBeUndefined();
    expect(headers['x-tasklist-user']).toBeUndefined();
  });

  test('si la API falla, avisa y la lista no cambia', async ({ page }) => {
    await page.route('https://dummyjson.com/todos**', (route) =>
      route.fulfill({ status: 500, headers: CORS, json: { message: 'error' } }),
    );
    await register(page);
    await page.getByRole('button', { name: 'Importar tareas' }).click();
    await expect(page.locator('ion-toast')).toContainText('No se pudo importar: Error del servidor (500).');
    await expect(page.locator('app-home ion-item.task')).toHaveCount(2);
  });

  test('descarta datos con forma inesperada', async ({ page }) => {
    await page.route('https://dummyjson.com/todos**', (route) =>
      route.fulfill({
        headers: CORS,
        json: {
          todos: [
            { id: 'x', todo: 42 },
            { id: 300, todo: 'Válida', completed: false },
          ],
        },
      }),
    );
    await register(page);
    await page.getByRole('button', { name: 'Importar tareas' }).click();
    await expect(page.locator('ion-toast')).toContainText('Se importaron 1 tareas');
    await expect(page.locator('app-home ion-item.task')).toHaveCount(3);
  });
});

test.describe('Sincronización con la API propia', () => {
  test('al entrar sincroniza y cada cambio se guarda en el servidor', async ({ page, request }) => {
    const user = await register(page);
    await expect(syncStatus(page)).toContainText('Sincronizado');

    await addTask(page, 'Guardada en la nube', 'Sincronización automática');
    await expect(syncStatus(page)).toContainText('Sincronizado');

    // Se consulta la API directamente: la tarea quedó guardada de forma remota
    await expect(async () => {
      const response = await request.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${syncKey(user)}`, 'X-TaskList-User': user },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.tasks.map((task: { title: string }) => task.title)).toContain('Guardada en la nube');
    }).toPass();
  });

  test('la API rechaza credenciales incorrectas (401)', async ({ request }) => {
    const user = uniqueUser();
    await request.get(`${API_URL}/tasks`, {
      headers: { Authorization: `Bearer ${syncKey(user)}`, 'X-TaskList-User': user },
    });
    const response = await request.get(`${API_URL}/tasks`, {
      headers: { Authorization: `Bearer ${syncKey(user, 'otra-clave')}`, 'X-TaskList-User': user },
    });
    expect(response.status()).toBe(401);
  });

  test('otro dispositivo con la misma cuenta recibe las tareas', async ({ page, browser }) => {
    const user = await register(page);
    await addTask(page, 'Creada en el celular 1', 'Debe llegar al celular 2');
    await expect(syncStatus(page)).toContainText('Sincronizado');
    await expect(async () => {
      await page.getByRole('button', { name: 'Sincronizar' }).click();
      await expect(syncStatus(page)).toContainText('Sincronizado', { timeout: 2_000 });
    }).toPass();

    // "Celular 2": otro navegador, sin datos locales. La cuenta se crea con el mismo usuario y clave
    const other = await browser.newContext({
      geolocation: { latitude: -33.4378, longitude: -70.6505 },
      permissions: ['geolocation'],
    });
    const page2 = await other.newPage();
    await register(page2, user);
    await expect(taskRow(page2, 'Creada en el celular 1')).toBeVisible();
    await other.close();
  });

  test('sin internet guarda localmente y sincroniza al volver la conexión', async ({ page, context }) => {
    await register(page);
    await expect(syncStatus(page)).toContainText('Sincronizado');

    await context.setOffline(true);
    await addTask(page, 'Creada sin internet', 'Offline-first');
    await expect(taskRow(page, 'Creada sin internet')).toBeVisible();
    await expect(syncStatus(page)).toContainText('Sin conexión');

    await context.setOffline(false);
    await expect(syncStatus(page)).toContainText('Sincronizado');
  });

  test('si el servidor falla, lo muestra y se recupera al reintentar', async ({ page }) => {
    await register(page);
    await expect(syncStatus(page)).toContainText('Sincronizado');

    // El servidor "se cae": responde 500 (el preflight CORS se contesta normal)
    await page.route(`${API_URL}/tasks`, (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': 'http://localhost:4200',
              'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
              'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, X-TaskList-User',
            },
          })
        : route.fulfill({
            status: 500,
            headers: { 'Access-Control-Allow-Origin': 'http://localhost:4200' },
            json: { error: 'Error interno del servidor.' },
          }),
    );
    await page.getByRole('button', { name: 'Sincronizar' }).click();
    await expect(syncStatus(page)).toContainText('Error del servidor (500).');
    // La tarea local no se pierde
    await expect(page.locator('app-home ion-item.task')).toHaveCount(2);

    await page.unroute(`${API_URL}/tasks`);
    await page.getByRole('button', { name: 'Sincronizar' }).click();
    await expect(syncStatus(page)).toContainText('Sincronizado');
  });
});
