# TaskList · EVA U2

App de tareas hecha con **Ionic 9 + Angular 22 (standalone, sin zone.js) + Capacitor 8**.
Evaluación de la Unidad 2 de *Desarrollo de aplicaciones móviles*: amplía la TaskList de la
Unidad 1 con periféricos, permisos, almacenamiento local, login multiusuario e integración con APIs.

## Qué hace

| Requisito de la pauta | Dónde está |
|---|---|
| Cámara: tomar una foto y adjuntarla a una tarea | `services/camera.service.ts`, botón "Tomar foto" y 📷 en cada tarea |
| GPS: guardar dónde se crea cada tarea | `services/location.service.ts`, átomo `ui/atoms/location` |
| Permisos de usuario (explicación previa, rechazo, bloqueo) | `services/permissions.ts`, página `/permisos` |
| Almacenamiento local (sin internet) | `services/task.service.ts` con `@capacitor/preferences` |
| Autenticación básica multiusuario | `services/auth.service.ts`, página `/login`, `auth.guards.ts` |
| Sincronizar con un servicio web (almacenamiento remoto) | `services/sync.service.ts` + `api/task-api.service.ts` + servidor `api/server.mjs` |
| Importar tareas desde una API externa | `api/todo-import.service.ts` (DummyJSON) |
| Datos adicionales por tarea desde una API | `api/weather.service.ts` (clima de Open-Meteo) |
| Pruebas de periféricos y de APIs | `*.spec.ts` (Vitest), `api/server.test.mjs` (node:test), `e2e/` (Playwright) |

## Cómo ejecutarlo

```bash
npm install
npm run api      # terminal 1: API de sincronización en http://localhost:3000/api
npm start        # terminal 2: la app en http://localhost:4200
```

La app funciona aunque la API no esté levantada (offline-first): la barra de sincronización
muestra "Sin conexión con el servidor" y envía los cambios cuando vuelve.

En Android: `npm run build && npx cap sync android` y abrir `android/` en Android Studio.
En el emulador la API del PC es `http://10.0.2.2:3000/api` (cambiar `apiUrl` en `src/environments/`);
en producción la API debe publicarse con HTTPS.

## Pruebas

```bash
npm run lint        # ESLint + Prettier + tipos de e2e
npm run test:unit   # Vitest: servicios, páginas, interceptores, APIs simuladas
npm run test:api    # node:test: el servidor real (seguridad, validación, concurrencia)
npm run test:e2e    # Playwright: la app completa en un Chrome móvil (levanta app + API solas)
```

Si Playwright no tiene su navegador descargado: `npx playwright install chromium`
(o usar el del sistema: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`).

## Estructura

```
src/app/
  api/          clientes HTTP: API propia, DummyJSON, Open-Meteo + interceptores
  services/     tareas, login, cámara, GPS, permisos, red y sincronización
  home/ login/ permissions/ about/   páginas
  ui/           atomic design (ver ui/README.md)
api/            servidor de sincronización (Node, sin dependencias) y sus pruebas
e2e/            pruebas end-to-end con Playwright
```

## Seguridad y privacidad (resumen)

- Contraseñas: sólo se guarda su hash PBKDF2-SHA256 (100.000 iteraciones, sal aleatoria). Mensaje de
  error genérico y bloqueo de 30 s tras 5 intentos fallidos.
- API: la contraseña nunca se envía; viaja una llave derivada (PBKDF2, otra sal) como `Bearer`, y el
  servidor guarda sólo su SHA-256. Las credenciales se agregan **sólo** a peticiones hacia nuestra API.
- Servidor: validación estricta de cada tarea, límite de tamaño (256 KB), CORS con lista blanca,
  límite de peticiones por IP, encabezados de seguridad y control de concurrencia con `If-Match`.
- Fotos: se guardan reducidas y sólo en el dispositivo (nunca se envían). Al servicio del clima se le
  envía la zona aproximada (2 decimales ≈ 1 km).
- Todo dato externo (almacenamiento o API) se valida antes de usarse; el texto se muestra con `{{ }}`.
