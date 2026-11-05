import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideClock, LucideReceiptText } from '@lucide/angular';
import { HistorialPedidosService } from '../../core/services/historial-pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-historial',
  imports: [RouterLink, PrecioCopPipe, DatePipe, LucideClock, LucideReceiptText],
  template: `
    <section class="mx-auto max-w-[1100px] px-5 py-10 md:px-10">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Historial de pedidos</h1>
          <p class="mt-2 text-sm text-brasa-muted sm:text-base">Tus últimos pedidos guardados</p>
        </div>
        <a routerLink="/menu" class="rounded-xl bg-brasa-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">Ir al menú</a>
      </div>

      @if (historial.lista().length === 0) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brasa-gray-light text-brasa-muted">
            <svg lucideReceiptText [size]="28"></svg>
          </span>
          <h2 class="font-heading text-xl font-semibold text-brasa-black">Aún no hay pedidos</h2>
          <p class="max-w-md text-sm text-brasa-muted">Cuando hagas tu primer pedido aparecerá aquí.</p>
          <a routerLink="/menu" class="mt-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">Hacer mi primer pedido</a>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (pedido of historial.lista(); track pedido.id) {
            <article class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="flex flex-col gap-2 border-b border-brasa-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm text-brasa-muted">Pedido</p>
                  <p class="font-heading text-lg font-semibold text-brasa-black">{{ pedido.numero }}</p>
                </div>
                <div class="flex items-center gap-2 text-sm text-brasa-muted">
                  <svg lucideClock [size]="16"></svg>
                  {{ pedido.creadoEn | date: 'dd/MM/yyyy HH:mm' }}
                </div>
              </header>
              <div class="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex flex-wrap items-center gap-2 text-sm text-brasa-muted">
                  @for (item of pedido.items.slice(0, 3); track item.id) {
                    <span class="rounded-full bg-brasa-gray-light px-3 py-1">{{ item.cantidad }}x {{ item.nombre }}</span>
                  }
                  @if (pedido.items.length > 3) {
                    <span class="rounded-full bg-brasa-gray-light px-3 py-1">+{{ pedido.items.length - 3 }} más</span>
                  }
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-heading text-lg font-bold text-brasa-orange">{{ pedido.resumen.total | precioCop }}</span>
                  <a routerLink="/pedido" class="rounded-xl border border-brasa-border px-4 py-2 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light">Ver seguimiento</a>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class HistorialComponent {
  protected readonly historial = inject(HistorialPedidosService);
}
