import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular';

import { AuthService, PASSWORD_MIN_LENGTH } from '../services/auth.service';
import { SectionLabelComponent } from '../ui/atoms';
import { BoardHeaderComponent } from '../ui/organisms';
import { PageTemplateComponent } from '../ui/templates';

type Mode = 'login' | 'register';

/**
 * PÁGINA · Inicio de sesión y registro (autenticación básica multiusuario).
 * Cada cuenta tiene su propia lista de tareas en el dispositivo.
 */
@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrl: 'login.page.scss',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonSpinner,
    PageTemplateComponent,
    BoardHeaderComponent,
    SectionLabelComponent,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly mode = signal<Mode>('login');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly passwordMin = PASSWORD_MIN_LENGTH;

  // Campos del formulario
  username = '';
  password = '';
  confirm = '';

  setMode(value: unknown): void {
    this.mode.set(value === 'register' ? 'register' : 'login');
    this.error.set('');
  }

  async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (!this.username.trim() || !this.password) {
      this.error.set('Completa el usuario y la contraseña.');
      return;
    }
    if (this.mode() === 'register' && this.password !== this.confirm) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result =
        this.mode() === 'register'
          ? await this.auth.register(this.username, this.password)
          : await this.auth.login(this.username, this.password);
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      // La contraseña no se queda en memoria más de lo necesario
      this.password = '';
      this.confirm = '';
      this.cdr.markForCheck();
      await this.navCtrl.navigateRoot('/home');
    } finally {
      this.busy.set(false);
    }
  }
}
