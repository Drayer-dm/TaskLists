import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { ApiError, toApiError } from '../api/api-error';
import { API_CONFIG } from '../api/api.config';
import { TaskApiService } from '../api/task-api.service';

import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { TaskService } from './task.service';

/**
 * - idle: aún no se sincroniza · syncing: enviando · synced: todo al día
 * - pending: hay cambios por enviar · offline: sin conexión · error: el servidor falló
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  /** Última sincronización exitosa */
  lastSync: Date | null;
  message: string;
}

const INITIAL: SyncState = { status: 'idle', lastSync: null, message: 'Aún no se sincroniza' };

/*
 * Sincronización "casi en tiempo real" de las tareas con la API propia.
 * - Funciona sin internet (offline-first): todo se guarda primero en el dispositivo.
 * - Cada cambio programa un envío 1,5 s después (debounce): 5 cambios seguidos = 1 envío.
 * - Al volver la conexión envía lo pendiente; cada 30 s trae cambios de otros dispositivos.
 * - Sincroniza en dos sentidos: trae, mezcla (mergeTasks) y envía, con control
 *   de versión (If-Match) para no pisar cambios de otro dispositivo.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(TaskApiService);
  private readonly taskService = inject(TaskService);
  private readonly auth = inject(AuthService);
  private readonly network = inject(NetworkService);
  private readonly config = inject(API_CONFIG);

  private readonly stateSignal = signal<SyncState>(INITIAL);
  readonly state = this.stateSignal.asReadonly();

  private timer?: ReturnType<typeof setTimeout>;
  private running: Promise<boolean> | null = null;
  private runAgain = false;

  constructor() {
    // Patrón Observer: cada cambio local (agregar, editar, borrar, importar) programa un envío
    effect(() => {
      if (this.taskService.changes() > 0) {
        untracked(() => this.markPending());
      }
    });
    // Volvió internet: se envía lo pendiente
    this.network.onReconnect(() => {
      if (this.auth.user()) {
        void this.sync();
      }
    });
    // Trae cada cierto tiempo los cambios de otros dispositivos (sólo con la app a la vista)
    if (this.config.pollMs > 0) {
      const interval = setInterval(() => this.poll(), this.config.pollMs);
      inject(DestroyRef).onDestroy(() => clearInterval(interval));
    }
  }

  /** Sincroniza ahora. Si ya hay una en curso, se encadena otra al terminar. */
  sync(): Promise<boolean> {
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.runAgain) {
        this.runAgain = false;
        void this.sync();
      }
    });
    return this.running;
  }

  /** Al cerrar sesión: cancela lo programado y vuelve al estado inicial */
  reset(): void {
    clearTimeout(this.timer);
    this.runAgain = false;
    this.stateSignal.set(INITIAL);
  }

  private markPending(): void {
    if (!this.auth.user()) {
      return;
    }
    this.stateSignal.update((state) => ({
      ...state,
      status: this.network.online() ? 'pending' : 'offline',
      message: this.network.online() ? 'Cambios por sincronizar' : 'Sin conexión: se sincronizará al volver',
    }));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), this.config.syncDebounceMs);
  }

  private poll(): void {
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    if (this.auth.user() && this.network.online() && visible && !this.running) {
      void this.sync();
    }
  }

  private async run(): Promise<boolean> {
    clearTimeout(this.timer);
    const user = this.auth.user();
    if (!user) {
      return false;
    }
    if (!this.network.online()) {
      this.setStatus('offline', 'Sin conexión: se sincronizará al volver');
      return false;
    }
    this.setStatus('syncing', 'Sincronizando…');
    try {
      await this.taskService.load();
      // 2 intentos: si otro dispositivo escribió entre la lectura y el envío (412), se vuelve a mezclar
      for (let attempt = 1; ; attempt++) {
        const remote = await this.api.getTasks();
        await this.taskService.applyRemote(remote.tasks, remote.deleted);
        const { tasks, deleted } = this.taskService.snapshot();
        try {
          await this.api.putTasks(tasks, deleted, remote.version);
        } catch (error) {
          if (error instanceof ApiError && error.kind === 'conflict' && attempt < 2) {
            continue;
          }
          throw error;
        }
        await this.taskService.acknowledgeDeleted(deleted);
        if (this.auth.user() === user) {
          this.stateSignal.set({ status: 'synced', lastSync: new Date(), message: 'Sincronizado' });
        }
        return true;
      }
    } catch (error) {
      const apiError = toApiError(error);
      if (this.auth.user() === user) {
        this.setStatus(apiError.kind === 'offline' ? 'offline' : 'error', apiError.message);
      }
      return false;
    }
  }

  private setStatus(status: SyncStatus, message: string): void {
    this.stateSignal.update((state) => ({ ...state, status, message }));
  }
}
