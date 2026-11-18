import { addTask, expect, login, logout, PASSWORD, register, taskRow, test, uniqueUser } from './fixtures';

// Autenticación básica multiusuario: cada cuenta protege y separa sus tareas.

test('sin sesión, la app manda al login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);
});

test('crea una cuenta y entra a su lista (con las tareas de ejemplo)', async ({ page }) => {
  const user = await register(page);
  await expect(page.locator('ion-title').first()).toContainText('TaskList');
  await expect(page.locator('app-home ion-item.task')).toHaveCount(2);
  // El menú muestra quién tiene la sesión
  await expect(page.locator('.account')).toContainText(user);
});

test('cerrar sesión vuelve al login y protege las tareas', async ({ page }) => {
  await register(page);
  await logout(page);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);
});

test('con contraseña incorrecta muestra un mensaje genérico', async ({ page }) => {
  const user = await register(page);
  await logout(page);
  await login(page, user, 'otra-clave-123');
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.');
  await expect(page).toHaveURL(/\/login$/);
});

test('valida la contraseña al crear la cuenta', async ({ page }) => {
  await page.goto('/login');
  await page.locator('ion-segment-button[value="register"]').click();
  await page.locator('ion-input[name="username"] input').fill(uniqueUser());
  await page.locator('ion-input[name="password"] input').fill('corta');
  await page.locator('ion-input[name="confirm"] input').fill('corta');
  await page.locator('ion-button.submit').click();
  await expect(page.getByRole('alert')).toContainText('al menos 8 caracteres');
});

test('cada usuario ve sólo sus propias tareas', async ({ page }) => {
  const ana = await register(page);
  await addTask(page, 'Tarea privada de Ana', 'Nadie más la ve');
  await expect(taskRow(page, 'Tarea privada de Ana')).toBeVisible();
  await logout(page);

  await register(page);
  await expect(page.locator('app-home ion-item.task')).toHaveCount(2);
  await expect(taskRow(page, 'Tarea privada de Ana')).toHaveCount(0);
  await logout(page);

  await login(page, ana, PASSWORD);
  await expect(taskRow(page, 'Tarea privada de Ana')).toBeVisible();
});
