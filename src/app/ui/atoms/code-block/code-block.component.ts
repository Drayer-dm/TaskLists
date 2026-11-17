import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * ÁTOMO · Bloque de código de ejemplo.
 * - El código llega como texto y se pinta con {{ }}: Angular lo escapa, así
 *   que llaves, @if o etiquetas HTML se muestran tal cual y no se ejecutan.
 * - Si una línea es más ancha que la pantalla, el bloque se desplaza de lado
 *   (no rompe el layout en celular). tabindex="0" permite desplazarlo con teclado.
 */
@Component({
  selector: 'app-code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<pre tabindex="0" [attr.aria-label]="label() || null"><code>{{ code() }}</code></pre>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    pre {
      margin: 0;
      padding: var(--space-3) var(--space-4);
      overflow-x: auto;
      border-radius: 12px;
      background: var(--color-tint);
      color: var(--color-ink);
      font-family: ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace;
      font-size: 0.78rem;
      line-height: 1.6;
      tab-size: 2;
    }
  `,
})
export class CodeBlockComponent {
  readonly code = input.required<string>();
  readonly label = input('Ejemplo de código');
}
