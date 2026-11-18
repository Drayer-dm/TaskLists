// TaskList API · servidor mínimo de sincronización (Node.js 20+, sin dependencias).
//
//   npm run api            → http://localhost:3000/api
//
//   GET  /api/health       → { ok: true }
//   GET  /api/tasks        → { tasks, deleted, version }        (requiere credenciales)
//   PUT  /api/tasks        → { version }  body: { tasks, deleted } + If-Match: "<versión>"
//
// Credenciales: Authorization: Bearer <llave> + X-TaskList-User: <usuario>.
// La llave la deriva la app desde la contraseña (PBKDF2); aquí sólo se guarda su
// SHA-256. El primer contacto de un usuario lo registra (trust on first use).
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DB = fileURLToPath(new URL('./data/db.json', import.meta.url));
const DEFAULT_ORIGINS = [
  'http://localhost:4200', // ng serve
  'http://localhost:8100', // ionic serve
  'https://localhost', // Capacitor Android
  'http://localhost',
  'capacitor://localhost', // Capacitor iOS
];

const LIMITS = { title: 60, description: 200, weather: 40, tasks: 500, deleted: 1000, body: 256 * 1024 };
const USERNAME = /^[a-z0-9._-]{3,20}$/;
const KEY = /^[A-Za-z0-9+/]{43}=$/; // 32 bytes en base64

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const sha256 = (text) => createHash('sha256').update(text).digest();
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isDate = (value) => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

/** Valida una tarea y devuelve sólo los campos conocidos (las fotos y campos extra se descartan) */
export function sanitizeTask(task) {
  if (typeof task !== 'object' || task === null || Array.isArray(task)) return null;
  const { id, title, description, createdAt, updatedAt, location, weather, externalId } = task;
  if (!isNumber(id) || typeof title !== 'string' || typeof description !== 'string') return null;
  if (!title.trim() || title.length > LIMITS.title || description.length > LIMITS.description) return null;
  if (!isDate(createdAt) || (updatedAt !== undefined && !isDate(updatedAt))) return null;

  const clean = { id, title, description, createdAt, updatedAt: updatedAt ?? createdAt };
  if (location !== undefined) {
    const { latitude, longitude, accuracy } = location ?? {};
    const valid =
      isNumber(latitude) && isNumber(longitude) && isNumber(accuracy) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && accuracy >= 0;
    if (!valid) return null;
    clean.location = { latitude, longitude, accuracy };
  }
  if (weather !== undefined) {
    const { temperature, code, description: text } = weather ?? {};
    if (!isNumber(temperature) || !Number.isInteger(code) || typeof text !== 'string' || text.length > LIMITS.weather) return null;
    clean.weather = { temperature, code, description: text };
  }
  if (externalId !== undefined) {
    if (!isNumber(externalId)) return null;
    clean.externalId = externalId;
  }
  return clean;
}

/** Crea el servidor (sin escuchar). Las pruebas lo levantan en un puerto libre con su propia base de datos. */
export function createApiServer({
  dbPath = process.env.TASKLIST_DB ?? DEFAULT_DB,
  origins = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(',')).split(','),
  rateLimit = { windowMs: 60_000, max: Number(process.env.RATE_LIMIT_MAX ?? 120) },
  log = (line) => console.log(line),
} = {}) {
  const allowedOrigins = new Set(origins);
  const hits = new Map();
  let db = null;
  let writing = Promise.resolve();

  async function database() {
    if (!db) {
      try {
        const saved = JSON.parse(await readFile(dbPath, 'utf8'));
        db = { users: saved.users ?? {}, data: saved.data ?? {} };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        db = { users: {}, data: {} };
      }
    }
    return db;
  }

  /** Escritura atómica: archivo temporal + rename (un corte de luz no deja el JSON a medias) */
  function persist() {
    writing = writing.then(async () => {
      await mkdir(dirname(resolve(dbPath)), { recursive: true });
      const tmp = `${dbPath}.tmp`;
      await writeFile(tmp, JSON.stringify(db, null, 2));
      await rename(tmp, dbPath);
    });
    return writing;
  }

  function checkRateLimit(request) {
    const ip = request.socket.remoteAddress ?? 'desconocida';
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.start > rateLimit.windowMs) {
      hits.set(ip, { start: now, count: 1 });
      return;
    }
    entry.count++;
    if (entry.count > rateLimit.max) {
      const retryAfter = Math.ceil((entry.start + rateLimit.windowMs - now) / 1000);
      throw new HttpError(429, 'Demasiadas solicitudes. Intenta en un momento.', { retryAfter });
    }
  }

  async function authenticate(request) {
    const user = request.headers['x-tasklist-user'];
    const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? '');
    if (typeof user !== 'string' || !USERNAME.test(user) || !match || !KEY.test(match[1])) {
      throw new HttpError(401, 'Credenciales faltantes o inválidas.');
    }
    const keyHash = sha256(match[1]);
    const store = await database();
    const existing = store.users[user];
    if (!existing) {
      // Primer contacto: se registra el usuario con el hash de su llave
      store.users[user] = { keyHash: keyHash.toString('hex'), createdAt: new Date().toISOString() };
      store.data[user] = { tasks: [], deleted: [], version: 0, updatedAt: null };
      await persist();
    } else if (!timingSafeEqual(Buffer.from(existing.keyHash, 'hex'), keyHash)) {
      throw new HttpError(401, 'Credenciales faltantes o inválidas.');
    }
    return user;
  }

  async function readJson(request) {
    if (!(request.headers['content-type'] ?? '').startsWith('application/json')) {
      throw new HttpError(415, 'El cuerpo debe ser JSON.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > LIMITS.body) throw new HttpError(413, 'El cuerpo es demasiado grande.');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'JSON inválido.');
    }
  }

  async function putTasks(request, user) {
    const store = await database();
    const current = store.data[user];
    const ifMatch = request.headers['if-match'];
    if (!ifMatch) {
      throw new HttpError(428, 'Falta el encabezado If-Match con la versión leída.');
    }
    // Control de concurrencia optimista: si otro dispositivo escribió antes, 412
    if (ifMatch.replaceAll('"', '') !== String(current.version)) {
      throw new HttpError(412, 'Los datos cambiaron: vuelve a leer antes de escribir.', { version: current.version });
    }
    const body = await readJson(request);
    if (typeof body !== 'object' || body === null || !Array.isArray(body.tasks) || body.tasks.length > LIMITS.tasks) {
      throw new HttpError(422, `Se espera { tasks: [...] } con máximo ${LIMITS.tasks} tareas.`);
    }
    const tasks = [];
    const ids = new Set();
    for (const [index, raw] of body.tasks.entries()) {
      const task = sanitizeTask(raw);
      if (!task || ids.has(task.id)) {
        throw new HttpError(422, `La tarea en la posición ${index} no es válida.`);
      }
      ids.add(task.id);
      tasks.push(task);
    }
    const sentDeleted = Array.isArray(body.deleted) ? body.deleted.filter(isNumber) : [];
    const deleted = [...new Set([...current.deleted, ...sentDeleted])].filter((id) => !ids.has(id)).slice(-LIMITS.deleted);

    store.data[user] = { tasks, deleted, version: current.version + 1, updatedAt: new Date().toISOString() };
    await persist();
    return { version: store.data[user].version };
  }

  async function route(request, response) {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname === '/api/health' && request.method === 'GET') {
      return [200, { ok: true }];
    }
    if (pathname !== '/api/tasks') {
      throw new HttpError(404, 'No encontrado.');
    }
    if (request.method !== 'GET' && request.method !== 'PUT') {
      throw new HttpError(405, 'Método no permitido.');
    }
    const user = await authenticate(request);
    if (request.method === 'GET') {
      const { tasks, deleted, version } = (await database()).data[user];
      response.setHeader('ETag', `"${version}"`);
      return [200, { tasks, deleted, version }];
    }
    return [200, await putTasks(request, user)];
  }

  return createServer(async (request, response) => {
    const started = Date.now();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }
    // CORS: sólo los orígenes de la app (no "*")
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, X-TaskList-User');
      response.setHeader('Access-Control-Expose-Headers', 'ETag');
      response.setHeader('Access-Control-Max-Age', '600');
    }

    let status = 500;
    let payload = { error: 'Error interno del servidor.' };
    try {
      if (request.method === 'OPTIONS') {
        status = 204;
        payload = null;
      } else {
        checkRateLimit(request);
        [status, payload] = await route(request, response);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        status = error.status;
        payload = { error: error.message };
        if (error.extra.version !== undefined) payload.version = error.extra.version;
        if (error.extra.retryAfter !== undefined) response.setHeader('Retry-After', String(error.extra.retryAfter));
      } else {
        // El detalle del error queda en el log del servidor, nunca en la respuesta
        log(`Error inesperado: ${error?.stack ?? error}`);
      }
    }
    response.statusCode = status;
    response.end(payload === null ? undefined : JSON.stringify(payload));
    // Log sin datos sensibles: ni llaves ni contenido de las tareas
    log(`${request.method} ${request.url} → ${status} (${Date.now() - started} ms)`);
  });
}

// Ejecutado directamente (npm run api): escucha en el puerto 3000
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApiServer().listen(port, () => {
    console.log(`TaskList API escuchando en http://localhost:${port}/api`);
  });
}
