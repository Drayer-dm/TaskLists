import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonButtons, IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular';

import { ChipComponent } from '../ui/atoms';
import { BoardHeaderComponent, InfoSectionComponent } from '../ui/organisms';
import { PageTemplateComponent } from '../ui/templates';

import { ARCHITECTURE, ARCHITECTURE_INTRO, LEAD, PATTERNS, PATTERNS_INTRO, STACK } from './about.content';

/**
 * PÁGINA · Acerca de: explica la arquitectura de Angular/Ionic y los patrones
 * de diseño, con ejemplos del propio código.
 * Reutiliza piezas de Home (board-header, section-heading, chip) con otro
 * contenido: así se ve en la práctica la ventaja de atomic design.
 * El texto vive en about.content.ts; aquí sólo se conecta con la vista.
 */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    PageTemplateComponent,
    BoardHeaderComponent,
    InfoSectionComponent,
    ChipComponent,
  ],
  templateUrl: 'about.page.html',
  styleUrl: 'about.page.scss',
})
export class AboutPage {
  protected readonly lead = LEAD;
  protected readonly stack = STACK;
  protected readonly architectureIntro = ARCHITECTURE_INTRO;
  protected readonly architecture = ARCHITECTURE;
  protected readonly patternsIntro = PATTERNS_INTRO;
  protected readonly patterns = PATTERNS;
}
