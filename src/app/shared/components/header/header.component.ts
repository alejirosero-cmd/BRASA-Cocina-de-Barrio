import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoBrasaComponent } from '../logo-brasa/logo-brasa.component';
import { MesaService } from '../../../core/services/mesa.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { UiService } from '../../../core/services/ui.service';
import { PedidosService } from '../../../core/services/pedidos.service';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, LogoBrasaComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-brasa-border bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-20 max-w-[1760px] items-center justify-between gap-6 px-5 md:px-10 xl:px-20">
        <app-logo-brasa />

        <nav class="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          <a
            routerLink="/menu"
            routerLinkActive="bg-brasa-gray-light text-brasa-black"
            class="rounded-lg px-4 py-2 text-sm font-medium text-brasa-muted transition hover:text-brasa-black"
          >
            Menú
          </a>
          <a
            routerLink="/pedido"
            routerLinkActive="bg-brasa-gray-light text-brasa-black"
            class="rounded-lg px-4 py-2 text-sm font-medium text-brasa-muted transition hover:text-brasa-black"
          >
            Seguimiento
            @if (pedidos.hayPedidoActivo()) {
              <span class="ml-1.5 inline-flex h-2 w-2 rounded-full bg-brasa-orange" aria-label="pedido en curso"></span>
            }
          </a>
          <a routerLink="/historial" routerLinkActive="bg-brasa-gray-light text-brasa-black" class="rounded-lg px-4 py-2 text-sm font-medium text-brasa-muted transition hover:text-brasa-black">Mis pedidos</a>
          @for (enlace of enlacesPersonal(); track enlace.ruta) {
            <a [routerLink]="enlace.ruta" routerLinkActive="bg-brasa-gray-light text-brasa-black" class="rounded-lg px-4 py-2 text-sm font-semibold text-brasa-orange transition hover:text-brasa-orange-dark">{{ enlace.titulo }}</a>
          }
        </nav>

        <div class="flex items-center gap-2 md:gap-3">
          @if (auth.autenticado()) {
            <a routerLink="/cuenta" class="hidden rounded-xl px-3 py-2 text-sm font-medium text-brasa-muted transition hover:text-brasa-black md:inline" [attr.aria-label]="'Mi cuenta, ' + auth.usuario()?.nombre">
              {{ auth.usuario()?.nombre }}
            </a>
          } @else {
            <a routerLink="/login" class="hidden rounded-xl px-3 py-2 text-sm font-medium text-brasa-muted transition hover:text-brasa-black md:inline">Ingresar</a>
          }
          @if (!auth.esPersonal()) {
          <div
            class="hidden items-center gap-2 rounded-xl border border-brasa-border bg-brasa-gray-light px-3 py-2 sm:flex"
            [attr.aria-label]="'Ubicación actual: ' + mesa.etiqueta()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brasa-orange" aria-hidden="true">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
            </svg>
            <span class="text-sm font-semibold text-brasa-black">{{ mesa.etiqueta() }}</span>
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-brasa-border px-3 py-2 text-sm font-medium text-brasa-black transition hover:border-brasa-orange hover:text-brasa-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
            (click)="ui.abrirModalCambiarMesa()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
            </svg>
            <span class="hidden sm:inline">Cambiar mesa</span>
          </button>

          <a
            routerLink="/carrito"
            class="relative inline-flex items-center gap-2 rounded-xl bg-brasa-orange px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2"
            [attr.aria-label]="'Mi Carrito, ' + carrito.cantidadTotal() + ' productos'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <span class="hidden sm:inline">Mi Carrito</span>
            @if (carrito.cantidadTotal() > 0) {
              <span class="ml-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
                {{ carrito.cantidadTotal() }}
              </span>
            }
          </a>
          }
        </div>
      </div>
    </header>
  `,
})
export class SiteHeaderComponent {
  protected readonly mesa = inject(MesaService);
  protected readonly carrito = inject(CarritoService);
  protected readonly ui = inject(UiService);
  protected readonly pedidos = inject(PedidosService);
  protected readonly auth = inject(AuthService);

  /** Accesos del personal (el servidor valida igualmente cada acción). */
  protected readonly enlacesPersonal = computed(() => {
    const rol = this.auth.rol();
    const enlaces: { ruta: string; titulo: string }[] = [];
    if (rol === 'COCINA' || rol === 'ADMIN') enlaces.push({ ruta: '/cocina', titulo: 'Cocina' });
    if (rol === 'MESERO' || rol === 'ADMIN') enlaces.push({ ruta: '/mesero', titulo: 'Meseros' });
    if (rol === 'ADMIN') enlaces.push({ ruta: '/admin', titulo: 'Admin' });
    return enlaces;
  });
}
