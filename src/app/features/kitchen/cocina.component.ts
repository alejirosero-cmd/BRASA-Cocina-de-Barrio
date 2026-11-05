import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideChefHat, LucideClock } from '@lucide/angular';
import { PedidosService } from '../../core/services/pedidos.service';
import { HistorialPedidosService } from '../../core/services/historial-pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-cocina',
  imports: [RouterLink, PrecioCopPipe, DatePipe, LucideChefHat, LucideClock],
  template: `
    <section class="mx-auto max-w-[1400px] px-5 py-10 md:px-10">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Panel Cocina</h1>
          <p class="mt-2 text-sm text-brasa-muted sm:text-base">Gestiona los pedidos en tiempo real</p>
        </div>
        <a routerLink="/menu" class="rounded-xl border border-brasa-border px-5 py-2.5 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light">Volver al menú</a>
      </div>

      @if (!pedidos.hayPedidoActivo()) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brasa-gray-light text-brasa-muted">
            <svg lucideChefHat [size]="28"></svg>
          </span>
          <h2 class="font-heading text-xl font-semibold text-brasa-black">Sin pedidos activos</h2>
          <p class="max-w-md text-sm text-brasa-muted">Cuando se cree un pedido aparecerá aquí para gestionarlo.</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article class="rounded-2xl border border-brasa-border bg-white shadow-card">
            <header class="flex items-center justify-between border-b border-brasa-border px-6 py-4">
              <div>
                <p class="text-sm text-brasa-muted">Pedido</p>
                <p class="font-heading text-xl font-semibold text-brasa-black">{{ pedidos.pedido()!.numero }}</p>
              </div>
              <div class="flex items-center gap-2 rounded-full bg-brasa-orange/10 px-3 py-1.5 text-sm font-semibold text-brasa-orange">
                <svg lucideClock [size]="16"></svg>
                {{ pedidos.pedido()!.tiempoEstimadoMin }} min
              </div>
            </header>
            <div class="flex flex-col gap-3 px-6 py-5">
              @for (item of pedidos.pedido()!.items; track item.id) {
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-semibold text-brasa-black">{{ item.nombre }}</p>
                    <p class="text-sm text-brasa-muted">Cantidad: {{ item.cantidad }}</p>
                    @if (item.personalizacion.instrucciones) {
                      <p class="mt-1 text-xs text-brasa-orange">Nota: {{ item.personalizacion.instrucciones }}</p>
                    }
                  </div>
                  <span class="text-sm font-semibold text-brasa-black">{{ item.precioUnitario * item.cantidad | precioCop }}</span>
                </div>
              }
            </div>
            <footer class="flex flex-wrap items-center gap-2 border-t border-brasa-border px-6 py-4">
              <button
                type="button"
                class="rounded-xl border border-brasa-border px-4 py-2 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light"
                (click)="pedidos.actualizarEstado('recibido')"
              >
                Recibido
              </button>
              <button
                type="button"
                class="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                (click)="pedidos.actualizarEstado('preparando')"
              >
                En preparación
              </button>
              <button
                type="button"
                class="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                (click)="pedidos.actualizarEstado('listo')"
              >
                Listo para servir
              </button>
            </footer>
          </article>

          <article class="rounded-2xl border border-brasa-border bg-white shadow-card">
            <header class="border-b border-brasa-border px-6 py-4">
              <h2 class="font-heading text-base font-semibold text-brasa-black">Historial reciente</h2>
            </header>
            <div class="flex flex-col divide-y divide-brasa-border">
              @for (pedido of historial.lista().slice(0, 5); track pedido.id) {
                <div class="flex items-center justify-between px-6 py-4">
                  <div>
                    <p class="font-semibold text-brasa-black">{{ pedido.numero }}</p>
                    <p class="text-xs text-brasa-muted">{{ pedido.items.length }} productos · {{ pedido.creadoEn | date: 'HH:mm' }}</p>
                  </div>
                  <span class="text-sm font-semibold text-brasa-black">{{ pedido.resumen.total | precioCop }}</span>
                </div>
              }
            </div>
          </article>
        </div>
      }
    </section>
  `,
})
export class CocinaComponent {
  protected readonly pedidos = inject(PedidosService);
  protected readonly historial = inject(HistorialPedidosService);
}
