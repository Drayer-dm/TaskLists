import { expect, test } from '@playwright/test';

// Prueba e2e: abre la app real en un navegador (Pixel 7) y la usa como un usuario.

test('la raíz redirige a /home y muestra la lista de tareas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('ion-title').first()).toContainText('TaskList');
  // Las dos tareas de ejemplo
  await expect(page.locator('ion-item.task')).toHaveCount(2);
});

test('agrega y elimina una tarea', async ({ page }) => {
  await page.goto('/home');

  await page.locator('ion-input').nth(0).locator('input').fill('Comprar pan');
  await page.locator('ion-input').nth(1).locator('input').fill('En la panadería de la esquina');
  await page.getByRole('button', { name: 'Agregar tarea' }).click();

  const nueva = page.locator('ion-item.task', { hasText: 'Comprar pan' });
  await expect(nueva).toBeVisible();
  await expect(page.locator('ion-item.task')).toHaveCount(3);

  await page.getByRole('button', { name: 'Eliminar tarea Comprar pan' }).click();
  await expect(nueva).toHaveCount(0);
});

test('edita una tarea desde la ventana "Editar tarea"', async ({ page }) => {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Editar tarea Ejemplo' }).click();

  const alert = page.locator('ion-alert.task-alert');
  await expect(alert).toBeVisible();
  const title = alert.getByLabel('Título');
  const description = alert.getByLabel('Descripción');
  // Abre con los datos actuales de la tarea
  await expect(title).toHaveValue('Ejemplo');

  // Campo vacío: la ventana no se cierra y muestra el aviso
  await title.fill('   ');
  await alert.getByRole('button', { name: 'Guardar' }).click();
  await expect(alert).toContainText('no pueden quedar vacíos');

  await title.fill('Ejemplo editado');
  await description.fill('Descripción editada');
  await alert.getByRole('button', { name: 'Guardar' }).click();
  await expect(alert).toHaveCount(0);

  const fila = page.locator('ion-item.task').first();
  await expect(fila).toContainText('Ejemplo editado');
  await expect(fila).toContainText('Descripción editada');
});
