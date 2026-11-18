import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { NetworkPlugin } from '@capacitor/network';
import { Network } from '@capacitor/network';

/** Los 2 métodos del plugin de red que usa la app */
export type NetworkApi = Pick<NetworkPlugin, 'getStatus' | 'addListener'>;

export const NETWORK = new InjectionToken<NetworkApi>('Network', {
  providedIn: 'root',
  factory: () => ({
    getStatus: () => Network.getStatus(),
    addListener: (eventName, listener) => Network.addListener(eventName, listener),
  }),
});

/*
 * Estado de la conexión (Wi-Fi / datos móviles) con el plugin Network de Capacitor.
 * Sirve para no intentar sincronizar sin internet y para sincronizar
 * apenas vuelve la conexión.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly network = inject(NETWORK);
  private readonly onlineSignal = signal(true);
  private readonly reconnectHandlers: (() => void)[] = [];

  readonly online = this.onlineSignal.asReadonly();

  constructor() {
    this.network
      .getStatus()
      .then((status) => this.onlineSignal.set(status.connected))
      .catch(() => undefined);
    void this.network
      .addListener('networkStatusChange', (status) => {
        const wasOnline = this.onlineSignal();
        this.onlineSignal.set(status.connected);
        if (!wasOnline && status.connected) {
          this.reconnectHandlers.forEach((handler) => handler());
        }
      })
      .catch(() => undefined);
  }

  /** Avisa cuando vuelve la conexión */
  onReconnect(handler: () => void): void {
    this.reconnectHandlers.push(handler);
  }
}
