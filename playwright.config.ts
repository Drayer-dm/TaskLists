import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:4200';
/** API propia de sincronización (la misma URL que usa environment.ts) */
const apiURL = 'http://localhost:3000/api';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // GPS simulado: el navegador de prueba "está" en la Plaza de Armas de Santiago
    // y el permiso de ubicación ya viene aceptado
    geolocation: { latitude: -33.4378, longitude: -70.6505, accuracy: 12 },
    permissions: ['geolocation'],
    // Opcional: usar el Chromium del sistema (CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e)
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      command: 'npm start -- --port 4200',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // La API real, con su propia base de datos de pruebas
      command: 'node api/server.mjs',
      url: `${apiURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { TASKLIST_DB: 'api/data/e2e-db.json', RATE_LIMIT_MAX: '10000' },
    },
  ],
});
