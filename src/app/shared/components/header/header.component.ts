import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LogoBrasaComponent } from '../logo-brasa/logo-brasa.component';
import { MesaService } from '../../../core/services/mesa.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { UiService } from '../../../core/services/ui.service';
import { PedidosService } from '../../../core/services/pedidos.service';

const ENLACE = 'rounded-lg px-4 py-2 text-sm font-medium text-brasa-muted transition hover:text-brasa-black';

/**
 * Encabezado según el rol (el servidor valida igualmente cada acción):
 * - Cliente: menú, seguimiento, sus pedidos, su mesa y el carrito.
 * - Cocina: solo su pantalla (no toma pedidos ni cobra).
 * - Mesero: menú y carrito solo mientras toma un pedido para una mesa.
 * A la derecha, como en la mayoría de sitios: carrito y, en la esquina, Ingresar o el perfil.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, LogoBrasaComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-brasa-border bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-20 max-w-[1760px] items-center justify-between gap-4 px-5 md:px-10 xl:px-20">
        <app-logo-brasa />

        <nav class="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          @if (verMenu()) {
            <a routerLink="/menu" routerLinkActive="bg-brasa-gray-light text-brasa-black" class="${ENLACE}">Menú</a>
          }
          @if (!auth.esPersonal()) {
            <a routerLink="/pedido" routerLinkActive="bg-brasa-gray-light text-brasa-black" class="${ENLACE}">
              Seguimiento
              @if (pedidos.hayPedidoActivo()) {
                <span class="ml-1.5 inline-flex h-2 w-2 rounded-full bg-brasa-orange" aria-label="pedido en curso"></span>
              }
            </a>
            <a routerLink="/historial" routerLinkActive="bg-brasa-gray-light text-brasa-black" class="${ENLACE}">Mis pedidos</a>
          }
          @for (enlace of enlacesPersonal(); track enlace.ruta) {
            <a [routerLink]="enlace.ruta" routerLinkActive="bg-brasa-gray-light text-brasa-black" class="rounded-lg px-4 py-2 text-sm font-semibold text-brasa-orange transition hover:text-brasa-orange-dark">{{ enlace.titulo }}</a>
          }
        </nav>

        <div class="flex items-center gap-2 md:gap-3">
          @if (!auth.esPersonal()) {
            <button
              type="button"
              class="hidden items-center gap-2 rounded-xl border border-brasa-border bg-brasa-gray-light px-3 py-2 text-sm font-semibold text-brasa-black transition hover:border-brasa-orange sm:inline-flex"
              [attr.aria-label]="'Tu mesa: ' + mesa.etiqueta() + '. Cambiar mesa'"
              (click)="ui.abrirModalCambiarMesa()"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brasa-orange" aria-hidden="true">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
              {{ mesa.etiqueta() }}
              <span class="text-xs font-medium text-brasa-muted">· cambiar</span>
            </button>
          }

          @if (verCarrito()) {
            <a
              routerLink="/carrito"
              class="relative inline-flex items-center gap-2 rounded-xl bg-brasa-orange px-3 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 sm:px-4"
              [attr.aria-label]="'Mi Carrito, ' + carrito.cantidadTotal() + ' productos'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <span class="hidden sm:inline">Mi Carrito</span>
              @if (carrito.cantidadTotal() > 0) {
                <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
                  {{ carrito.cantidadTotal() }}
                </span>
              }
            </a>
          }

          <!-- Esquina derecha: Ingresar o el perfil con la inicial del nombre. -->
          @if (auth.autenticado()) {
            <a
              routerLink="/cuenta"
              class="inline-flex items-center gap-2 rounded-full border border-brasa-border py-1 pl-1 pr-1 text-sm font-medium text-brasa-black transition hover:border-brasa-orange md:pr-3"
              [attr.aria-label]="'Mi cuenta, ' + auth.usuario()?.nombre"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brasa-black font-heading text-sm font-bold text-white" aria-hidden="true">{{ inicial() }}</span>
              <span class="hidden max-w-32 truncate md:inline">{{ auth.usuario()?.nombre }}</span>
            </a>
          } @else {
            <a
              routerLink="/login"
              class="inline-flex items-center gap-2 rounded-xl border border-brasa-black px-3 py-2 text-sm font-semibold text-brasa-black transition hover:bg-brasa-black hover:text-white"
              aria-label="Ingresar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <span class="hidden sm:inline">Ingresar</span>
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

  /** La cocina no ve el menú para pedir; el mesero y el administrador sí (para tomar pedidos). */
  protected readonly verMenu = computed(() => this.auth.rol() !== 'COCINA');

  /** Carrito: clientes siempre; mesero o administrador solo mientras toman un pedido para una mesa. */
  protected readonly verCarrito = computed(() => {
    const rol = this.auth.rol();
    if (rol === 'COCINA') return false;
    if (rol === 'MESERO' || rol === 'ADMIN') return this.mesa.codigo() !== null;
    return true;
  });

  protected readonly inicial = computed(() => (this.auth.usuario()?.nombre ?? '?').trim().charAt(0).toUpperCase());

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
