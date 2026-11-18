import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  cloudOutline,
  cloudUploadOutline,
} from 'ionicons/icons';

import type { SyncState } from '../../../services/sync.service';

/**
 * MOLÉCULA · Estado de la sincronización (ícono + mensaje + hora de la última).
 * role="status": el lector de pantalla anuncia los cambios sin interrumpir.
 */
@Component({
  selector: 'app-sync-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IonIcon, IonSpinner],
  template: `
    <p role="status" [class]="state().status">
      @if (state().status === 'syncing') {
        <ion-spinner name="crescent" aria-hidden="true" />
      } @else {
        <ion-icon [icon]="icon()" aria-hidden="true" />
      }
      <span>{{ state().message }}</span>
      @if (state().lastSync; as lastSync) {
        <time [attr.datetime]="lastSync.toISOString()">· {{ lastSync | date: 'HH:mm' }}</time>
      }
    </p>
  `,
  styles: `
    p {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: 0.8rem;
      color: var(--color-muted);
    }
    ion-icon,
    ion-spinner {
      flex: none;
      width: 18px;
      height: 18px;
    }
    .synced ion-icon {
      color: var(--color-ink);
    }
    .error {
      color: var(--color-ink);
    }
    time {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class SyncStatusComponent {
  readonly state = input.required<SyncState>();

  protected readonly icon = computed(() => {
    switch (this.state().status) {
      case 'synced':
        return checkmarkCircleOutline;
      case 'pending':
        return cloudUploadOutline;
      case 'offline':
        return cloudOfflineOutline;
      case 'error':
        return alertCircleOutline;
      default:
        return cloudOutline;
    }
  });
}
