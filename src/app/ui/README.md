# UI · Atomic Design

> Cómo ejecutar el proyecto, la pauta y la revisión de seguridad: ver el [README principal](../../../README.md).

Cada nivel sólo puede usar piezas de los niveles **anteriores**:

| Nivel | Qué es | Tiene estado / lógica de negocio | Piezas |
|---|---|---|---|
| `atoms/` | La pieza más pequeña con estilo propio | No | `section-label`, `chip`, `timestamp` (fecha y hora), `location` (ubicación GPS con enlace al mapa), `weather` (clima), `code-block` |
| `molecules/` | Varios átomos que juntos hacen **una** cosa | No | `section-heading` (etiqueta + total), `empty-state`, `concept-card` (concepto + código), `photo-thumb` (foto + quitar), `sync-status` (estado de la sincronización) |
| `organisms/` | Secciones completas y reconocibles | No | `board-header` (etiqueta + fecha o título), `side-menu` (enlaces del menú), `info-section` (sección de conceptos) |
| `templates/` | El esqueleto / layout de una pantalla, **sin datos** | No | `board-template` (Home: 1 o 2 columnas), `page-template` (Acerca de: columna de lectura) |
| páginas (`src/app/home`, `login`, `permissions`, `about`) | Template + organismos + **datos reales** | Sí: aquí viven los datos | `HomePage`, `LoginPage`, `PermissionsPage`, `AboutPage` |

## Dónde entra Ionic

La pauta pide `ion-header`, `ion-content`, `ion-list`, `ion-item`, `ion-input` y `ion-button`.
Esos componentes **se usan directo en la página** y cumplen el papel de átomos y moléculas
(`ion-input`, `ion-button` = átomos; `ion-item` = molécula). Por eso aquí no hay botón,
campo de texto, formulario ni lista propios: sería duplicar lo que Ionic ya trae.

Su estilo minimalista sale de:
- `src/theme/variables.scss`: colores, espaciado y ancho de layout; las variables `--ion-*` apuntan a nuestros colores (incluye modo oscuro).
- `src/global.scss`: la forma común (barra con línea fina alineada al contenido, botones píldora).
- `src/app/home/home.page.scss`: lo propio de la página (filas de la lista, campos).

## Pantallas

- **Menú lateral:** en celular y tablet se abre con el botón ☰; desde 992px queda fijo a la izquierda (`ion-split-pane`).
- **Home:** una columna con poco espacio; con espacio amplio (≥ 820px disponibles), formulario a la izquierda (fijo al hacer scroll) y lista a la derecha. Se mide con una *container query*, así el menú fijo no aprieta las columnas.
- **Acerca de:** una columna de lectura (máx. ~760px); el código largo se desplaza de lado.
- Se respetan las zonas seguras (notch, barra de gestos, celular en horizontal) y los botones miden al menos 44px para tocarlos con el dedo.

## Reglas

- **Componentes de `ui/`: standalone + `ChangeDetectionStrategy.OnPush` + `input()`.** Sólo reciben datos; nunca los modifican.
- **Sin colores sueltos**: todo sale de los tokens de `src/theme/variables.scss`.
- **Sin `innerHTML`**: el texto del usuario siempre se pinta con `{{ }}`, que Angular escapa (evita XSS).

Cada nivel tiene un `index.ts` (barrel) para importar con una sola línea.
