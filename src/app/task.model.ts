export interface Task {
  id: number;
  title: string;
  description: string;
  /** Fecha y hora en que se creó la tarea (hora local del dispositivo). */
  createdAt: Date;
  /** Última modificación: al sincronizar, gana la versión más nueva de cada tarea. */
  updatedAt: Date;
  /** Dónde se creó (GPS). No existe si no hubo permiso o el GPS no respondió. */
  location?: TaskLocation;
  /** Foto de la cámara (JPEG reducido, como data URL). Sólo se guarda en el dispositivo. */
  photo?: string;
  /** Clima del lugar al crear la tarea (dato adicional desde la API de Open-Meteo). */
  weather?: TaskWeather;
  /** Id en la API externa si la tarea fue importada (evita importarla dos veces). */
  externalId?: number;
}

/** Largos máximos. Los usan el ion-input (maxlength) y addTask() (validación final),
    así ambos lados aplican exactamente el mismo límite. */
export const TASK_LIMITS = {
  title: 60,
  description: 200,
} as const;

// Datos que entrega el GPS
export interface TaskLocation {
  latitude: number;
  longitude: number;
  /** Radio de error en metros */
  accuracy: number;
}

export interface TaskWeather {
  /** Temperatura en °C */
  temperature: number;
  /** Código WMO del estado del tiempo (0 = despejado, 3 = nublado, 61 = lluvia...) */
  code: number;
  description: string;
}

/** Datos mínimos para crear una tarea nueva (p. ej. una importada desde la API). */
export interface TaskDraft {
  title: string;
  description: string;
  externalId?: number;
}

/** Tarea en formato JSON: así se guarda en el dispositivo y así viaja a la API (fechas como texto). */
export type StoredTask = Omit<Task, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt?: string;
};

/** Task → JSON. La foto se puede dejar fuera (no se envía al servidor). */
export function toStoredTask(task: Task, includePhoto = true): StoredTask {
  const { photo, ...rest } = task;
  const stored: StoredTask = {
    ...rest,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
  if (includePhoto && photo) {
    stored.photo = photo;
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Validación de datos que vienen "de afuera" (almacenamiento o API).
// Nunca se confía en ellos: un dato con forma incorrecta se descarta en vez de
// romper la app o colarse en la lista.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLocation(value: unknown): TaskLocation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { latitude, longitude, accuracy } = value;
  const valid =
    isFiniteNumber(latitude) &&
    isFiniteNumber(longitude) &&
    isFiniteNumber(accuracy) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    accuracy >= 0;
  return valid ? { latitude, longitude, accuracy } : undefined;
}

function parseWeather(value: unknown): TaskWeather | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { temperature, code, description } = value;
  const valid =
    isFiniteNumber(temperature) &&
    Number.isInteger(code) &&
    typeof description === 'string' &&
    description.length <= 40;
  return valid ? { temperature, code: code as number, description } : undefined;
}

/** Sólo se aceptan imágenes en data URL (nunca una URL remota ni otro tipo de archivo) */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(value);
}

/**
 * JSON desconocido → Task, o null si no tiene la forma correcta.
 * Valida tipos, rangos (latitud, longitud) y largos máximos.
 */
export function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, title, description } = value;
  const createdAt = parseDate(value['createdAt']);
  if (
    !isFiniteNumber(id) ||
    typeof title !== 'string' ||
    typeof description !== 'string' ||
    !title.trim() ||
    title.length > TASK_LIMITS.title ||
    description.length > TASK_LIMITS.description ||
    !createdAt
  ) {
    return null;
  }
  const task: Task = {
    id,
    title,
    description,
    createdAt,
    // Tareas guardadas antes de existir updatedAt: se usa la fecha de creación
    updatedAt: parseDate(value['updatedAt']) ?? createdAt,
  };
  const location = parseLocation(value['location']);
  if (location) {
    task.location = location;
  }
  const weather = parseWeather(value['weather']);
  if (weather) {
    task.weather = weather;
  }
  if (isImageDataUrl(value['photo'])) {
    task.photo = value['photo'];
  }
  if (isFiniteNumber(value['externalId'])) {
    task.externalId = value['externalId'];
  }
  return task;
}

/** Lista JSON → tareas válidas (las inválidas se descartan). */
export function parseTasks(value: unknown): Task[] {
  return Array.isArray(value) ? value.map(parseTask).filter((task): task is Task => task !== null) : [];
}
