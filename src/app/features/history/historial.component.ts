import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideClock, LucideReceiptText } from '@lucide/angular';
import { PedidosService } from '../../core/services/pedidos.service';
import { AuthService } from '../../core/services/auth.service';
import { mensajeError } from '../../core/services/api.service';
import { ETIQUETA_ESTADO, ETIQUETA_ESTADO_PAGO, Pedido } from '../../models/pedido.model';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-historial',
  imports: [RouterLink, PrecioCopPipe, DatePipe, LucideClock, LucideReceiptText],
  template: `
    <section class="mx-auto max-w-[1100px] px-5 py-10 md:px-10">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Historial de pedidos</h1>
          <p class="mt-2 text-sm text-brasa-muted sm:text-base">
            @if (auth.tieneRol('CLIENTE')) {
              Los pedidos de tu cuenta y los hechos desde este dispositivo
            } @else {
              Pedidos hechos desde este dispositivo ·
              <a routerLink="/registro" class="font-semibold text-brasa-orange hover:underline">crea una cuenta</a> para verlos en cualquier lugar
            }
          </p>
        </div>
        <a routerLink="/menu" class="rounded-xl bg-brasa-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">Ir al menú</a>
      </div>

      @if (cargando()) {
        <p class="py-12 text-center text-sm text-brasa-muted" role="status">Cargando tus pedidos...</p>
      } @else if (error()) {
        <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ error() }}</p>
      } @else if (lista().length === 0) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brasa-gray-light text-brasa-muted">
            <svg lucideReceiptText [size]="28"></svg>
          </span>
          <h2 class="font-heading text-xl font-semibold text-brasa-black">Aún no hay pedidos</h2>
          <p class="max-w-md text-sm text-brasa-muted">Cuando hagas tu primer pedido aparecerá aquí.</p>
          <a routerLink="/menu" class="mt-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">Hacer mi primer pedido</a>
        </div>
      } @else {
        <ul class="flex flex-col gap-4">
          @for (pedido of lista(); track pedido.id) {
            <li class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <div class="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="font-heading text-lg font-semibold text-brasa-black">Pedido {{ pedido.numero }}</p>
                  <p class="flex items-center gap-1.5 text-sm text-brasa-muted">
                    <svg lucideClock [size]="14"></svg>
                    {{ pedido.creadoEn | date: 'd MMM y, h:mm a' }} · {{ pedido.items.length }} productos
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full px-3 py-1 text-xs font-semibold" [class]="claseEstado(pedido)">{{ etiquetaEstado[pedido.estado] }}</span>
                  <span class="rounded-full bg-brasa-gray-light px-3 py-1 text-xs font-semibold text-brasa-muted">{{ etiquetaPago[pedido.estadoPago] }}</span>
                  <span class="font-heading text-lg font-bold text-brasa-orange">{{ pedido.resumen.total | precioCop }}</span>
                  <a [routerLink]="['/pedido', pedido.id]" class="rounded-xl border border-brasa-border px-4 py-2 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light">Ver</a>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class HistorialComponent {
  protected readonly auth = inject(AuthService);
  private readonly pedidos = inject(PedidosService);

  protected readonly lista = signal<Pedido[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly etiquetaPago = ETIQUETA_ESTADO_PAGO;

  constructor() {
    this.pedidos
      .historial()
      .then((l) => this.lista.set(l))
      .catch((e) => this.error.set(mensajeError(e)))
      .finally(() => this.cargando.set(false));
  }

  protected claseEstado(p: Pedido): string {
    if (p.estado === 'CANCELADO') return 'bg-red-50 text-red-700';
    if (p.estado === 'ENTREGADO') return 'bg-green-50 text-green-700';
    return 'bg-brasa-orange/10 text-brasa-orange';
  }
}
