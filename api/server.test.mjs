// Pruebas de la API (node:test, incluido en Node): levantan el servidor real en
// un puerto libre con una base de datos temporal y le hacen peticiones HTTP.
//   npm run test:api
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createApiServer, sanitizeTask } from './server.mjs';

const APP_ORIGIN = 'http://localhost:4200';
const newKey = () => randomBytes(32).toString('base64');

let dir;
let dbPath;
let server;
let baseUrl;

async function start(options = {}) {
  const instance = createApiServer({ dbPath, log: () => undefined, ...options });
  await new Promise((done) => instance.listen(0, done));
  return { instance, url: `http://localhost:${instance.address().port}/api` };
}

function auth(user, key) {
  return { Authorization: `Bearer ${key}`, 'X-TaskList-User': user };
}

function task(id, extra = {}) {
  const date = new Date('2026-11-18T12:00:00.000Z').toISOString();
  return { id, title: `Tarea ${id}`, description: 'desc', createdAt: date, updatedAt: date, ...extra };
}

async function put(user, key, body, version, url = baseUrl) {
  return fetch(`${url}/tasks`, {
    method: 'PUT',
    headers: { ...auth(user, key), 'Content-Type': 'application/json', 'If-Match': `"${version}"` },
    body: JSON.stringify(body),
  });
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tasklist-api-'));
  dbPath = join(dir, 'db.json');
  ({ instance: server, url: baseUrl } = await start());
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('TaskList API', () => {
  it('GET /api/health responde ok', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it('rechaza (401) las peticiones sin credenciales o con formato inválido', async () => {
    assert.equal((await fetch(`${baseUrl}/tasks`)).status, 401);
    const badKey = await fetch(`${baseUrl}/tasks`, { headers: auth('ana', 'no-es-una-llave') });
    assert.equal(badKey.status, 401);
    const badUser = await fetch(`${baseUrl}/tasks`, { headers: auth('<script>', newKey()) });
    assert.equal(badUser.status, 401);
  });

  it('registra al usuario en el primer contacto y parte con la lista vacía (versión 0)', async () => {
    const response = await fetch(`${baseUrl}/tasks`, { headers: auth('nuevo', newKey()) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('etag'), '"0"');
    assert.deepEqual(await response.json(), { tasks: [], deleted: [], version: 0 });
  });

  it('guarda las tareas (PUT) y las devuelve (GET) con la versión nueva', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('ana', key) });
    const saved = await put('ana', key, { tasks: [task(1), task(2)], deleted: [] }, 0);
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { version: 1 });

    const body = await (await fetch(`${baseUrl}/tasks`, { headers: auth('ana', key) })).json();
    assert.equal(body.version, 1);
    assert.deepEqual(
      body.tasks.map((t) => t.title),
      ['Tarea 1', 'Tarea 2'],
    );
  });

  it('rechaza (401) una llave distinta para un usuario ya registrado', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('pedro', key) });
    const response = await fetch(`${baseUrl}/tasks`, { headers: auth('pedro', newKey()) });
    assert.equal(response.status, 401);
  });

  it('cada usuario ve sólo sus tareas', async () => {
    const keyA = newKey();
    const keyB = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('usuario-a', keyA) });
    await put('usuario-a', keyA, { tasks: [task(10)] }, 0);
    const body = await (await fetch(`${baseUrl}/tasks`, { headers: auth('usuario-b', keyB) })).json();
    assert.deepEqual(body.tasks, []);
  });

  it('control de concurrencia: 428 sin If-Match y 412 si la versión es vieja', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('concurrente', key) });
    const noHeader = await fetch(`${baseUrl}/tasks`, {
      method: 'PUT',
      headers: { ...auth('concurrente', key), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: [] }),
    });
    assert.equal(noHeader.status, 428);

    assert.equal((await put('concurrente', key, { tasks: [task(1)] }, 0)).status, 200);
    const stale = await put('concurrente', key, { tasks: [task(2)] }, 0);
    assert.equal(stale.status, 412);
    assert.equal((await stale.json()).version, 1);
  });

  it('valida cada tarea: 422 con datos inválidos', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('validador', key) });
    const invalid = [
      task(1, { title: '' }),
      task(1, { title: 'x'.repeat(61) }),
      task(1, { createdAt: 'ayer' }),
      task(1, { location: { latitude: 120, longitude: 0, accuracy: 5 } }),
      { ...task(1), id: 'uno' },
    ];
    for (const bad of invalid) {
      assert.equal((await put('validador', key, { tasks: [bad] }, 0)).status, 422, JSON.stringify(bad));
    }
    assert.equal((await put('validador', key, { tasks: [task(1), task(1)] }, 0)).status, 422, 'ids repetidos');
    assert.equal((await put('validador', key, { nada: true }, 0)).status, 422);
  });

  it('descarta campos desconocidos y fotos (no se guardan en el servidor)', () => {
    const clean = sanitizeTask(task(1, { photo: 'data:image/jpeg;base64,AAAA', admin: true }));
    assert.equal(clean.photo, undefined);
    assert.equal(clean.admin, undefined);
    assert.equal(clean.title, 'Tarea 1');
  });

  it('recuerda los ids borrados para informarlos a los otros dispositivos', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('borrador', key) });
    await put('borrador', key, { tasks: [task(1), task(2)] }, 0);
    await put('borrador', key, { tasks: [task(2)], deleted: [1] }, 1);
    const body = await (await fetch(`${baseUrl}/tasks`, { headers: auth('borrador', key) })).json();
    assert.deepEqual(body.deleted, [1]);
    assert.deepEqual(
      body.tasks.map((t) => t.id),
      [2],
    );
  });

  it('413 si el cuerpo es demasiado grande y 415 si no es JSON', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('grande', key) });
    const big = await put('grande', key, { tasks: [], relleno: 'x'.repeat(300 * 1024) }, 0);
    assert.equal(big.status, 413);
    const text = await fetch(`${baseUrl}/tasks`, {
      method: 'PUT',
      headers: { ...auth('grande', key), 'Content-Type': 'text/plain', 'If-Match': '"0"' },
      body: 'hola',
    });
    assert.equal(text.status, 415);
  });

  it('CORS: sólo responde al origen de la app y contesta el preflight', async () => {
    const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: APP_ORIGIN } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), APP_ORIGIN);
    const other = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://sitio-malicioso.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(`${baseUrl}/tasks`, { method: 'OPTIONS', headers: { Origin: APP_ORIGIN } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  });

  it('envía encabezados de seguridad y no expone detalles internos', async () => {
    const response = await fetch(`${baseUrl}/no-existe`);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'No encontrado.' });
  });

  it('limita las solicitudes por IP (429 + Retry-After)', async () => {
    const { instance, url } = await start({ rateLimit: { windowMs: 60_000, max: 3 } });
    try {
      const statuses = [];
      for (let i = 0; i < 4; i++) {
        statuses.push((await fetch(`${url}/health`)).status);
      }
      assert.deepEqual(statuses, [200, 200, 200, 429]);
    } finally {
      instance.close();
    }
  });

  it('los datos quedan guardados en disco (sobreviven a un reinicio del servidor)', async () => {
    const key = newKey();
    await fetch(`${baseUrl}/tasks`, { headers: auth('persistente', key) });
    await put('persistente', key, { tasks: [task(7)] }, 0);
    const saved = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(saved.data.persistente.tasks[0].id, 7);
    // La llave nunca se guarda: sólo su hash SHA-256
    assert.notEqual(saved.users.persistente.keyHash, key);

    const { instance, url } = await start();
    try {
      const body = await (await fetch(`${url}/tasks`, { headers: auth('persistente', key) })).json();
      assert.equal(body.tasks[0].id, 7);
    } finally {
      instance.close();
    }
  });
});
