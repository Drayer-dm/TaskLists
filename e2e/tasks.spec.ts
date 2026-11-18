import { addTask, expect, register, taskRow, test } from './fixtures';

// Lista de tareas (CRUD) con almacenamiento local

test.beforeEach(async ({ page }) => {
  await register(page);
});

test('agrega y elimina una tarea', async ({ page }) => {
  await addTask(page, 'Comprar pan', 'En la panadería de la esquina');

  const nueva = taskRow(page, 'Comprar pan');
  await expect(nueva).toBeVisible();
  await expect(page.locator('app-home ion-item.task')).toHaveCount(3);

  await page.getByRole('button', { name: 'Eliminar tarea Comprar pan' }).click();
  await expect(nueva).toHaveCount(0);
});

test('las tareas siguen ahí al recargar (almacenamiento local)', async ({ page }) => {
  await addTask(page, 'Persistente', 'Sobrevive a la recarga');
  await expect(taskRow(page, 'Persistente')).toBeVisible();
  await page.reload();
  await expect(taskRow(page, 'Persistente')).toBeVisible();
});

test('edita una tarea desde la ventana "Editar tarea"', async ({ page }) => {
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

  const fila = page.locator('app-home ion-item.task').first();
  await expect(fila).toContainText('Ejemplo editado');
  await expect(fila).toContainText('Descripción editada');
});
