import type { Concept } from '../ui/molecules';

/*
 * Contenido de la página "Acerca de".
 * Se guarda como datos (y no escrito directo en el HTML) por dos razones:
 * 1. Los ejemplos de código tienen llaves y @if: dentro de una plantilla de
 *    Angular se interpretarían como código; como texto con {{ }} se muestran tal cual.
 * 2. La página sólo recorre estas listas: agregar un concepto = agregar un objeto.
 * Los fragmentos de código están copiados del propio proyecto.
 */

/** Tecnologías principales (se muestran como chips) */
export const STACK = [
  'Angular 22',
  'Ionic 9',
  'Capacitor 8',
  'TypeScript 6',
  'Vitest 5',
  'Playwright',
  'Node.js (API)',
] as const;

export const LEAD =
  'TaskList es una app de tareas hecha con Angular 22, el framework que organiza la app en ' +
  'componentes, rutas y servicios, e Ionic 9, que aporta componentes con aspecto de app móvil. ' +
  'Con Capacitor usa la cámara y el GPS del teléfono, guarda las tareas en el dispositivo, tiene ' +
  'cuentas de usuario y se sincroniza con una API. Aquí se explica cómo está construida, ' +
  'con ejemplos del propio código.';

export const ARCHITECTURE_INTRO =
  'Angular arma la app como un árbol de componentes. Estos son los conceptos clave del ' +
  'framework y dónde se usan en TaskList.';

export const ARCHITECTURE: readonly Concept[] = [
  {
    name: 'Arquitectura general',
    description:
      'main.ts arranca AppComponent, que contiene el menú lateral y el <ion-router-outlet>. ' +
      'Según la URL, el router muestra una página, y cada página se arma con los componentes de ui/.',
    location: 'src/main.ts · src/app/app.component.html',
    code: `main.ts
 └─ bootstrapApplication(AppComponent, providers)
     └─ AppComponent        ion-app + ion-split-pane
         ├─ ion-menu        → SideMenuComponent + cerrar sesión
         └─ ion-router-outlet   la URL elige la página (guards: ¿hay sesión?)
             ├─ /login     → LoginPage        (cuentas)
             ├─ /home      → HomePage         (tareas, foto, GPS, sync)
             ├─ /permisos  → PermissionsPage  (permisos y privacidad)
             └─ /about     → AboutPage        (esta página)
services/  TaskService · AuthService · LocationService · CameraService
           SyncService · NetworkService
api/       TaskApiService · TodoImportService · WeatherService · interceptores`,
  },
  {
    name: 'Componente standalone',
    description:
      'Es la pieza básica de Angular: una clase de TypeScript con el decorador @Component que une ' +
      'una plantilla HTML, estilos y lógica. "Standalone" significa que declara sus propias ' +
      'dependencias en imports, sin necesitar un NgModule.',
    location: 'src/app/home/home.page.ts',
    code: `@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone:true,
  imports: [CommonModule, FormsModule, IonItem, IonInput, IonList, ...],
})
export class HomePage {
  private readonly taskService = inject(TaskService);
  readonly tasks = this.taskService.tasks;   // signal
  addTask() { ... }
  deleteTask(id: number) { ... }
}`,
  },
  {
    name: 'Plantillas y data binding',
    description:
      'La plantilla conecta lo que se ve con la clase. Hay cuatro formas: interpolación {{ }} ' +
      '(mostrar un valor), propiedad [ ] (pasar un valor), evento ( ) (reaccionar a una acción) ' +
      'y doble vía [( )] (leer y escribir a la vez, como en un formulario).',
    location: 'src/app/home/home.page.html',
    code: `<strong>{{ task.title }}</strong>         <!-- interpolación -->

<ion-button [disabled]="!canAdd"          <!-- propiedad -->
            (click)="addTask()">          <!-- evento -->

<ion-input [(ngModel)]="newTitle">        <!-- doble vía -->`,
  },
  {
    name: 'Control de flujo: @if y @for',
    description:
      'Bloques de la plantilla para mostrar u ocultar y para repetir elementos. "track task.id" le ' +
      'dice a Angular cómo reconocer cada tarea, así al borrar una no redibuja toda la lista.',
    location: 'src/app/home/home.page.html',
    code: `@if (tasks().length) {
  <ion-list class="task-list">
    @for (task of tasks(); track task.id; let i = $index) {
      <ion-item class="task"> ... </ion-item>
    }
  </ion-list>
} @else {
  <app-empty-state message="No hay tareas" />
}`,
  },
  {
    name: 'Enrutamiento y navegación',
    description:
      'El Router asocia cada URL con una página. loadComponent descarga la página recién cuando se ' +
      'visita. El menú lateral navega con routerLink (sin recargar) y routerLinkActive marca la página actual.',
    location: 'src/app/app.routes.ts · ui/organisms/side-menu',
    code: `// app.routes.ts
{ path: 'home',  loadComponent: () => import('./home/home.page').then((m) => m.HomePage) },
{ path: 'about', loadComponent: () => import('./about/about.page').then((m) => m.AboutPage) },
{ path: '',   redirectTo: 'home', pathMatch: 'full' },
{ path: '**', redirectTo: 'home' },

<!-- side-menu: cada opción del menú -->
<ion-item button [routerLink]="link.url"
          routerLinkActive="active" ariaCurrentWhenActive="page">`,
  },
  {
    name: 'Providers e inyección de dependencias',
    description:
      'Angular crea los servicios y se los entrega a quien los necesita: el componente no los ' +
      'construye por su cuenta. En main.ts se registran los de toda la app: Ionic, el Router y la ' +
      'estrategia de reutilización de páginas.',
    location: 'src/main.ts',
    code: `bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
  ],
});`,
  },
  {
    name: 'Signals y detección de cambios',
    description:
      'La app no usa zone.js. Angular actualiza la vista después de cada evento de la plantilla ' +
      'y cuando cambia un signal. Los componentes de ui/ reciben datos con input() y calculan con ' +
      'computed(). Con OnPush, Angular no los revisa si sus datos no cambiaron.',
    location: 'src/app/ui/atoms/timestamp/timestamp.component.ts',
    code: `@Component({
  selector: 'app-timestamp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  ...
})
export class TimestampComponent {
  readonly value = input.required<Date>();
  protected readonly iso = computed(() => this.value().toISOString());
}`,
  },
  {
    name: 'Pipes',
    description:
      'Transforman un valor sólo para mostrarlo, sin cambiar el dato original. DatePipe convierte ' +
      'la fecha de creación de cada tarea al formato día/mes/año y hora.',
    location: 'src/app/ui/atoms/timestamp/timestamp.component.ts',
    code: `<time [attr.datetime]="iso()">
  {{ value() | date: 'dd/MM/yyyy · HH:mm' }}
</time>
<!-- se ve así:  27/10/2026 · 13:59 -->`,
  },
  {
    name: 'Periféricos con Capacitor (cámara y GPS)',
    description:
      'Los plugins @capacitor/camera y @capacitor/geolocation hablan con el hardware. Cada uno se ' +
      'entrega con un InjectionToken: la app usa el plugin real y las pruebas uno falso. Los permisos se ' +
      'piden al usar la función, con una explicación previa, y si se rechazan la app sigue funcionando.',
    location: 'src/app/services/camera.service.ts · location.service.ts',
    code: `export const CAMERA = new InjectionToken<CameraApi>('Camera', {
  providedIn: 'root',
  factory: () => ({ takePhoto: (o) => Camera.takePhoto(o), ... }),
});

// en la prueba: la cámara "saca" la foto que se quiera
{ provide: CAMERA, useValue: fakeCamera('granted') }`,
  },
  {
    name: 'HttpClient e interceptores',
    description:
      'HttpClient hace las peticiones a las APIs. Los interceptores agregan, en un solo lugar, la llave ' +
      'del usuario (sólo hacia nuestra API, nunca a terceros), un tiempo máximo de espera y reintentos ' +
      'con espera creciente ante fallas temporales.',
    location: 'src/main.ts · src/app/api/interceptors.ts',
    code: `provideHttpClient(withFetch(), withInterceptors([authInterceptor, resilienceInterceptor]))

next(request).pipe(
  timeout(8_000),
  retry({ count: 2, delay: (e, n) => isRetryable(e) ? timer(500 * 2 ** (n - 1)) : throwError(() => e) }),
);`,
  },
  {
    name: 'Ionic y Capacitor',
    description:
      'Ionic aporta componentes móviles (ion-list, ion-item, ion-menu...). Son Web Components con ' +
      'shadow DOM, por eso se personalizan con variables CSS y no con CSS normal. Capacitor copia la ' +
      'carpeta www (el resultado de ng build) dentro de una app nativa Android o iOS.',
    location: 'src/app/home/home.page.scss · capacitor.config.ts',
    code: `// home.page.scss: cada tarea como una fila con línea fina
.task {
  --background: transparent;
  --border-width: 0 0 1px;
  --border-color: var(--color-line);
}

// capacitor.config.ts
webDir: 'www'`,
  },
];

export const PATTERNS_INTRO =
  'Soluciones reutilizables que Angular e Ionic traen incorporadas, o que el proyecto aplica ' +
  'sobre ellos, con el lugar exacto donde se ven.';

export const PATTERNS: readonly Concept[] = [
  {
    name: 'Atomic design (composición)',
    description:
      'La interfaz se arma de lo pequeño a lo grande: átomos → moléculas → organismos → templates → ' +
      'páginas. Cada nivel sólo usa piezas de los anteriores, así una pieza se reutiliza en vez de ' +
      'repetirse. Ejemplo: section-heading es "TAREAS 3" en Home y "PATRONES DE DISEÑO 8" aquí.',
    location: 'src/app/ui/',
    code: `atoms/       section-label · chip · timestamp · code-block
molecules/   section-heading = section-label + chip
             concept-card    = section-label + code-block
             empty-state
organisms/   info-section    = section-heading + concept-card × N
             board-header · side-menu
templates/   board-template (Home) · page-template (Acerca de)
pages        HomePage · AboutPage   ← aquí viven los datos`,
  },
  {
    name: 'Contenedor / presentacional',
    description:
      'La página (contenedor) tiene los datos y la lógica. Los componentes de ui/ (presentacionales) ' +
      'sólo reciben datos con input() y los muestran. Así los datos fluyen en un solo sentido, de ' +
      'arriba hacia abajo, y las piezas visuales se pueden reutilizar y probar por separado.',
    location: 'home.page.ts → ui/atoms/timestamp',
    code: `// HomePage (contenedor): datos + lógica
readonly tasks = this.taskService.tasks;
addTask() { ... this.taskService.add(this.newTitle, this.newDescription); }

<!-- home.page.html: la página le pasa el dato -->
<app-timestamp [value]="task.createdAt" label="Creada el" />

// TimestampComponent (presentacional): sólo recibe y muestra
readonly value = input.required<Date>();`,
  },
  {
    name: 'Proyección de contenido (slots)',
    description:
      'Un template define huecos con <ng-content select> y la página decide qué poner en cada uno. ' +
      'El mismo molde sirve para contenidos distintos: board-template ordena Home en 1 o 2 columnas ' +
      'sin saber que adentro hay un formulario y una lista.',
    location: 'ui/templates/board-template · home.page.html',
    code: `<!-- board-template.component.html (el molde) -->
<section class="side"><ng-content select="[boardSide]" /></section>
<section class="main"><ng-content select="[boardMain]" /></section>

<!-- home.page.html (lo que va en cada hueco) -->
<section boardSide> ...formulario... </section>
<section boardMain> ...lista de tareas... </section>`,
  },
  {
    name: 'Inyección de dependencias + Strategy',
    description:
      'Strategy permite cambiar un algoritmo sin tocar a quien lo usa. El Router pregunta a una ' +
      'RouteReuseStrategy si debe reutilizar una página; con inyección de dependencias se le entrega ' +
      'la versión de Ionic, que guarda las páginas para animar la navegación como en una app nativa.',
    location: 'src/main.ts',
    code: `providers: [
  // "cuando alguien pida RouteReuseStrategy, entrégale IonicRouteStrategy"
  { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
]`,
  },
  {
    name: 'Observer (reactividad)',
    description:
      'Un valor avisa a quienes dependen de él cuando cambia. [(ngModel)] escucha cada tecla con el ' +
      'evento ngModelChange, y computed() se vuelve a calcular solo cuando cambia el signal que usa.',
    location: 'home.page.html · ui/atoms/timestamp',
    code: `<!-- [(ngModel)] es la forma corta de: -->
<ion-input [ngModel]="newTitle" (ngModelChange)="newTitle = $event">

// computed() "observa" a value() y se recalcula cuando cambia
protected readonly iso = computed(() => this.value().toISOString());`,
  },
  {
    name: 'Decorator',
    description:
      'Agrega comportamiento a una clase sin modificarla. @Component convierte una clase común de ' +
      'TypeScript en un componente de Angular, indicándole su selector, plantilla y dependencias.',
    location: 'todos los componentes (*.component.ts, *.page.ts)',
    code: `@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
})
export class ChipComponent {}`,
  },
  {
    name: 'Carga perezosa (lazy loading)',
    description:
      'Cada página se descarga recién cuando se visita, así la app inicial pesa menos y abre más ' +
      'rápido. Al compilar se ve como archivos separados en "Lazy chunk files".',
    location: 'src/app/app.routes.ts',
    code: `loadComponent: () => import('./about/about.page').then((m) => m.AboutPage)

// resultado de ng build:
// Lazy chunk files | Names
// chunk-....js     | home-page
// chunk-....js     | about-page`,
  },
  {
    name: 'Tokens de diseño (theming)',
    description:
      'Colores, espacios y anchos se definen una sola vez como variables CSS con un rol ' +
      '(--color-ink = texto principal) y todos los componentes las usan. El modo oscuro sólo ' +
      'cambia el valor de los roles; ningún componente se toca.',
    location: 'src/theme/variables.scss',
    code: `:root {
  --color-ink: var(--palette-black);
}
@media (prefers-color-scheme: dark) {
  :root { --color-ink: var(--palette-paper); }
}

/* en cualquier componente */
color: var(--color-ink);`,
  },
  {
    name: 'Repository',
    description:
      'TaskService es el único que sabe dónde y cómo se guardan las tareas (Preferences, una lista por ' +
      'usuario). La página sólo pide add(), update() o remove(): cambiar el almacenamiento no la afecta.',
    location: 'src/app/services/task.service.ts',
    code: `@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly store = signal<Task[]>([]);
  readonly tasks = this.store.asReadonly();
  async add(title, description, photo?) { ... GPS ... guardar ... }
}`,
  },
  {
    name: 'Chain of Responsibility (interceptores)',
    description:
      'Cada petición HTTP pasa por una cadena de interceptores; cada uno hace una sola cosa y le entrega ' +
      'la petición al siguiente: primero las credenciales, después timeout y reintentos.',
    location: 'src/app/api/interceptors.ts',
    code: `withInterceptors([authInterceptor, resilienceInterceptor])
//  petición → authInterceptor → resilienceInterceptor → servidor`,
  },
  {
    name: 'Offline-first + sincronización',
    description:
      'Todo se guarda primero en el dispositivo. SyncService observa los cambios (effect sobre un ' +
      'signal), espera 1,5 s para agruparlos y sincroniza en dos sentidos: trae, mezcla (gana la ' +
      'edición más reciente) y envía con control de versión (If-Match).',
    location: 'src/app/services/sync.service.ts · merge-tasks.ts',
    code: `effect(() => {
  if (this.taskService.changes() > 0) untracked(() => this.markPending());
});
const remote = await this.api.getTasks();
await this.taskService.applyRemote(remote.tasks, remote.deleted);
await this.api.putTasks(tasks, deleted, remote.version);`,
  },
];
