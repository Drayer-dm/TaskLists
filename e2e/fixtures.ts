import type { Locator, Page } from '@playwright/test';
import { expect, test as base } from '@playwright/test';
import { pbkdf2Sync } from 'node:crypto';

/*
 * Base común de las pruebas e2e.
 * - Las APIs de terceros (DummyJSON y Open-Meteo) se simulan con context.route:
 *   las pruebas no dependen de internet y siempre reciben lo mismo.
 *   (Una prueba puede reemplazarlas con page.route para simular fallas.)
 * - La API propia SÍ es real: playwright.config.ts la levanta con `node api/server.mjs`.
 */

export const PASSWORD = 'clave-segura-123';

/** API propia de sincronización (la misma URL que usa environment.ts) */
export const API_URL = 'http://localhost:3000/api';

/** Respuesta CORS: el navegador exige este encabezado en respuestas de otro dominio */
export const CORS = { 'Access-Control-Allow-Origin': '*' };

const SAMPLE_TODOS = [
  'Do something nice for someone you care about',
  'Memorize a poem',
  'Watch a classic movie',
  'Contribute code to an open source project',
  'Solve a Rubik’s cube',
];

export const test = base.extend<{ externalApis: void }>({
  externalApis: [
    async ({ context }, use) => {
      await context.route('https://api.open-meteo.com/**', (route) =>
        route.fulfill({ headers: CORS, json: { current: { temperature_2m: 18.4, weather_code: 3 } } }),
      );
      await context.route('https://dummyjson.com/todos**', (route) => {
        const skip = Number(new URL(route.request().url()).searchParams.get('skip') ?? 0);
        const todos = SAMPLE_TODOS.map((todo, i) => ({ id: skip + i + 1, todo, completed: i % 2 === 0 }));
        return route.fulfill({ headers: CORS, json: { todos, total: 254, skip, limit: 5 } });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Simula un navegador donde el usuario AÚN NO decide el permiso de ubicación
 * (Chromium en modo de pruebas lo informa como "denied" si no se concedió).
 */
export async function locationPermissionNotDecided(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor: PermissionDescriptor) =>
      descriptor.name === 'geolocation'
        ? Promise.resolve({ name: 'geolocation', state: 'prompt', onchange: null } as unknown as PermissionStatus)
        : original(descriptor);
  });
}

/** Usuario único por prueba (las pruebas corren en paralelo contra la misma API) */
export function uniqueUser(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Llave que la app deriva de la contraseña (PBKDF2), para consultar la API desde la prueba */
export function syncKey(username: string, password = PASSWORD): string {
  return pbkdf2Sync(password, `tasklist-sync:${username}`, 100_000, 32, 'sha256').toString('base64');
}

/** Crea la cuenta desde la pantalla de login y espera la lista de tareas */
export async function register(page: Page, username = uniqueUser(), password = PASSWORD): Promise<string> {
  await page.goto('/login');
  await page.locator('ion-segment-button[value="register"]').click();
  await page.locator('ion-input[name="username"] input').fill(username);
  await page.locator('ion-input[name="password"] input').fill(password);
  await page.locator('ion-input[name="confirm"] input').fill(password);
  await page.locator('ion-button.submit').click();
  await expect(page).toHaveURL(/\/home$/);
  return username;
}

/** Inicia sesión con una cuenta existente */
export async function login(page: Page, username: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.locator('ion-input[name="username"] input').fill(username);
  await page.locator('ion-input[name="password"] input').fill(password);
  await page.locator('ion-button.submit').click();
}

/** Escribe y agrega una tarea desde el formulario de Home */
export async function addTask(page: Page, title: string, description: string): Promise<void> {
  const inputs = page.locator('app-home ion-input');
  await inputs.nth(0).locator('input').fill(title);
  await inputs.nth(1).locator('input').fill(description);
  await page.getByRole('button', { name: 'Agregar tarea' }).click();
}

/** Fila de una tarea en la lista */
export function taskRow(page: Page, title: string): Locator {
  return page.locator('app-home ion-item.task', { hasText: title });
}

/** Abre el menú lateral (en celular está escondido) y cierra la sesión */
export async function logout(page: Page): Promise<void> {
  await page.locator('app-home ion-menu-button').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
}
