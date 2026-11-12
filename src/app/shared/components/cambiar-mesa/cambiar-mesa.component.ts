import { Component, inject, signal, effect } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { MesaService } from '../../../core/services/mesa.service';
import { UiService } from '../../../core/services/ui.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { mensajeError } from '../../../core/services/api.service';
import { TipoPedido } from '../../../models/mesa.model';

@Component({
  selector: 'app-cambiar-mesa',
  imports: [ModalComponent],
  template: `
    @if (ui.modalCambiarMesaAbierto()) {
      <app-modal titulo="Cambiar ubicación" anchoClase="max-w-md" (cerrar)="cerrar()">
        <div class="space-y-5 p-6">
          <p class="text-sm text-brasa-muted">
            Indica dónde vas a disfrutar tu pedido. Puedes cambiarlo en cualquier momento.
          </p>

          <div class="grid grid-cols-2 gap-3" role="group" aria-label="Tipo de pedido">
            <button
              type="button"
              class="rounded-xl border-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
              [class]="
                tipo() === 'mesa'
                  ? 'border-brasa-orange bg-brasa-orange/5'
                  : 'border-brasa-border hover:border-brasa-muted'
              "
              [attr.aria-pressed]="tipo() === 'mesa'"
              (click)="seleccionarTipo('mesa')"
            >
              <span class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-brasa-orange/10 text-brasa-orange">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
                </svg>
              </span>
              <span class="block font-heading text-sm font-semibold text-brasa-black">En mesa</span>
              <span class="block text-xs text-brasa-muted">Consumo en el restaurante</span>
            </button>

            <button
              type="button"
              class="rounded-xl border-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
              [class]="
                tipo() === 'llevar'
                  ? 'border-brasa-orange bg-brasa-orange/5'
                  : 'border-brasa-border hover:border-brasa-muted'
              "
              [attr.aria-pressed]="tipo() === 'llevar'"
              (click)="seleccionarTipo('llevar')"
            >
              <span class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-brasa-orange/10 text-brasa-orange">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0" />
                </svg>
              </span>
              <span class="block font-heading text-sm font-semibold text-brasa-black">Para llevar</span>
              <span class="block text-xs text-brasa-muted">Recoge en el local</span>
            </button>
          </div>

          @if (tipo() === 'mesa') {
            <div class="space-y-2">
              <label for="numero-mesa" class="block text-sm font-semibold text-brasa-black">
                Número o código de la mesa
              </label>
              <input
                id="numero-mesa"
                type="text"
                autocomplete="off"
                autocapitalize="characters"
                maxlength="12"
                aria-describedby="ayuda-numero-mesa"
                class="w-full rounded-xl border border-brasa-border px-4 py-3 text-sm uppercase tracking-widest transition focus:border-brasa-orange focus:outline-none focus:ring-2 focus:ring-brasa-orange/30"
                [value]="codigo()"
                (input)="actualizarCodigo($event)"
                (keydown.enter)="guardar()"
                placeholder="Ej. 01 o K7P2QXMA"
              />
              <p id="ayuda-numero-mesa" class="text-xs text-brasa-muted">
                Escanea el QR de tu mesa o escribe su número (ej. 01) o el código impreso debajo del QR.
                @if (mesa.codigo()) { Actualmente: {{ mesa.etiqueta() }}. }
              </p>
              @if (error()) {
                <p class="text-xs font-medium text-red-600" role="alert">{{ error() }}</p>
              }
            </div>
          }

          <div class="flex gap-3 pt-1">
            <button
              type="button"
              class="flex-1 rounded-xl border border-brasa-border px-4 py-3 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
              (click)="cerrar()"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-brasa-orange px-4 py-3 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2"
              [disabled]="validando()"
              (click)="guardar()"
            >
              {{ validando() ? 'Validando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class CambiarMesaComponent {
  protected readonly ui = inject(UiService);
  protected readonly mesa = inject(MesaService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly tipo = signal<TipoPedido>('mesa');
  protected readonly codigo = signal('');
  protected readonly error = signal('');
  protected readonly validando = signal(false);

  constructor() {
    effect(() => {
      if (this.ui.modalCambiarMesaAbierto()) {
        this.tipo.set(this.mesa.tipo());
        this.codigo.set('');
        this.error.set('');
      }
    });
  }

  protected seleccionarTipo(tipo: TipoPedido): void {
    this.tipo.set(tipo);
    this.error.set('');
  }

  protected actualizarCodigo(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value.trim().toUpperCase());
    this.error.set('');
  }

  protected async guardar(): Promise<void> {
    if (this.tipo() === 'llevar') {
      this.mesa.paraLlevar();
      return this.listo();
    }
    if (!this.codigo() && this.mesa.codigo()) return this.cerrar();
    if (!/^([0-9]{1,3}|[A-Z0-9]{6,12})$/.test(this.codigo())) {
      this.error.set('Escanea el QR de tu mesa o escribe su número (ej. 01) o el código impreso debajo del QR.');
      return;
    }
    this.validando.set(true);
    try {
      await this.mesa.usarCodigo(this.codigo());
      this.listo();
    } catch (e) {
      this.error.set(mensajeError(e, 'No pudimos validar el código de la mesa.'));
    } finally {
      this.validando.set(false);
    }
  }

  private listo(): void {
    this.notificaciones.mostrar(`Ubicación actualizada: ${this.mesa.etiqueta()}`);
    this.cerrar();
  }

  protected cerrar(): void {
    this.ui.cerrarModalCambiarMesa();
  }
}
