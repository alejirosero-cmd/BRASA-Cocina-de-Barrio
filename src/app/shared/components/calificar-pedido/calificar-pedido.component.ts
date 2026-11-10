import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideStar } from '@lucide/angular';
import { CalificacionesService } from '../../../core/services/calificaciones.service';
import { PedidosService } from '../../../core/services/pedidos.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { mensajeError } from '../../../core/services/api.service';

@Component({
  selector: 'app-calificar-pedido',
  imports: [FormsModule, LucideStar],
  template: `
    @if (abierto()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="titulo-calificar">
        <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header class="border-b border-brasa-border px-6 py-4 text-center">
            <h2 id="titulo-calificar" class="font-heading text-lg font-semibold text-brasa-black">Califica tu pedido</h2>
            <p class="mt-1 text-sm text-brasa-muted">¿Cómo fue tu experiencia en BRASA?</p>
            @if (pedido()) {
              <p class="mt-1 text-xs text-brasa-muted">Pedido {{ pedido()!.numero }}</p>
            }
          </header>

          <div class="space-y-6 px-6 py-6">
            <div class="flex flex-col items-center gap-2">
              <div class="flex items-center gap-1">
                @for (estrella of estrellas; track estrella) {
                  <button
                    type="button"
                    class="p-1 transition"
                    [attr.aria-label]="'Calificar con ' + estrella + ' estrellas'"
                    (click)="seleccionar(estrella)"
                    (mouseenter)="hover.set(estrella)"
                    (mouseleave)="hover.set(0)"
                  >
                    <svg
                      lucideStar
                      [size]="32"
                      [attr.fill]="(hover() || calificacion()) >= estrella ? '#FF6B00' : 'none'"
                      [attr.stroke]="(hover() || calificacion()) >= estrella ? '#FF6B00' : '#9CA3AF'"
                      [attr.stroke-width]="1.5"
                    ></svg>
                  </button>
                }
              </div>
              <p class="text-sm text-brasa-muted">
                {{ calificacion() === 0 ? 'Selecciona una calificación' : calificacion() + ' de 5 estrellas' }}
              </p>
            </div>

            <div class="space-y-2">
              <label for="comentario-calificacion" class="text-sm font-medium text-brasa-black">Comentario (opcional)</label>
              <textarea
                id="comentario-calificacion"
                maxlength="500"
                rows="4"
                class="w-full rounded-xl border border-brasa-border px-4 py-3 text-sm outline-none transition placeholder:text-brasa-muted focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30"
                placeholder="Cuéntanos qué te gustó o qué podemos mejorar..."
                [ngModel]="comentario()"
                (ngModelChange)="comentario.set($event)"
              ></textarea>
            </div>
          </div>

          @if (error()) {
            <p class="mx-6 mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
          }
          <footer class="flex items-center gap-3 border-t border-brasa-border px-6 py-4">
            <button
              type="button"
              class="flex-1 rounded-xl border border-brasa-border px-4 py-2.5 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light"
              (click)="omitir()"
            >
              Omitir
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-brasa-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="calificacion() === 0 || enviando()"
              (click)="enviar()"
            >
              {{ enviando() ? 'Enviando...' : 'Enviar calificación' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class CalificarPedidoComponent {
  private readonly calificaciones = inject(CalificacionesService);
  private readonly pedidos = inject(PedidosService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly abierto = input(false);
  readonly pedidoId = input<string | null>(null);
  readonly cerrar = output<void>();
  readonly calificado = output<void>();

  protected readonly estrellas = [1, 2, 3, 4, 5];
  protected readonly calificacion = signal(0);
  protected readonly hover = signal(0);
  protected readonly comentario = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  protected readonly pedido = computed(() => {
    const p = this.pedidos.pedido();
    return p && p.id === this.pedidoId() ? p : null;
  });

  seleccionar(valor: number): void {
    this.calificacion.set(valor);
  }

  omitir(): void {
    this.cerrar.emit();
  }

  /** Se guarda en el servidor, que exige que el pedido esté entregado y no calificado. */
  async enviar(): Promise<void> {
    const id = this.pedidoId();
    if (!id || this.calificacion() === 0 || this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');
    try {
      await this.calificaciones.calificar(id, this.calificacion(), this.comentario().trim());
      this.notificaciones.mostrar('¡Gracias por tu calificación!');
      this.calificacion.set(0);
      this.comentario.set('');
      this.hover.set(0);
      this.calificado.emit();
    } catch (e) {
      this.error.set(mensajeError(e, 'No se pudo guardar tu calificación.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
