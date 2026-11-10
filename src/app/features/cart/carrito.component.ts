import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideMinus,
  LucidePlus,
  LucideShoppingCart,
  LucideTag,
  LucideTrash2,
  LucideMessageSquareText,
  LucideInfo,
} from '@lucide/angular';
import { CarritoService } from '../../core/services/carrito.service';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { CONFIGURACION } from '../../core/config/configuracion';
import { mensajeError } from '../../core/services/api.service';
import { UiService } from '../../core/services/ui.service';
import { ItemCarrito } from '../../models/carrito.model';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

@Component({
  selector: 'app-carrito',
  imports: [
    FormsModule,
    RouterLink,
    PrecioCopPipe,
    LucideArrowLeft,
    LucideShoppingCart,
    LucideMinus,
    LucidePlus,
    LucideTrash2,
    LucideTag,
    LucideMessageSquareText,
    LucideInfo,
  ],
  template: `
    <section class="mx-auto max-w-[1760px] px-5 py-10 md:px-10 xl:px-20">
      <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <a
            routerLink="/menu"
            class="inline-flex items-center gap-2 text-sm font-semibold text-brasa-muted transition hover:text-brasa-black"
          >
            <svg lucideArrowLeft [size]="16"></svg>
            Volver al menú
          </a>
          <h1 class="mt-3 font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">
            Carrito de compras
          </h1>
          <p class="mt-2 text-sm text-brasa-muted sm:text-base">
            Revisa tu pedido, añade notas de cocina y envíalo cuando estés listo.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div class="lg:col-span-8">
          @if (carrito.estaVacio()) {
            <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
              <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brasa-gray-light text-brasa-muted">
                <svg lucideShoppingCart [size]="28"></svg>
              </span>
              <h2 class="font-heading text-xl font-semibold text-brasa-black">Tu carrito está vacío</h2>
              <p class="max-w-md text-sm text-brasa-muted">
                Explora el menú digital y agrega tus platillos favoritos para continuar.
              </p>
              <a
                routerLink="/menu"
                class="mt-2 inline-flex items-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2"
              >
                Ir al menú
              </a>
            </div>
          } @else {
            <div class="overflow-hidden rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="flex items-center justify-between border-b border-brasa-border px-6 py-4">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Productos seleccionados</h2>
                <span class="text-sm text-brasa-muted">{{ carrito.cantidadTotal() }} ítems</span>
              </header>

              <ul class="divide-y divide-brasa-border">
                @for (item of carrito.lineas(); track item.id) {
                  <li class="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:px-6">
                    <img
                      [src]="item.imagenUrl"
                      [alt]="item.nombre"
                      width="96"
                      height="96"
                      class="h-24 w-24 shrink-0 rounded-xl border border-brasa-border bg-brasa-gray-light object-cover"
                    />

                    <div class="flex w-full flex-col gap-3">
                      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 class="font-heading text-base font-semibold text-brasa-black">
                            {{ item.nombre }}
                          </h3>
                          @if (descripcionPersonalizacion(item); as detalle) {
                            <p class="mt-1 text-sm text-brasa-muted">{{ detalle }}</p>
                          }
                          <p class="mt-1 text-sm text-brasa-black">
                            Precio unitario: {{ item.precioUnitario | precioCop }}
                          </p>
                        </div>
                        <button
                          type="button"
                          class="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 transition hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                          (click)="carrito.eliminar(item.id)"
                        >
                          <svg lucideTrash2 [size]="16"></svg>
                          Eliminar
                        </button>
                      </div>

                      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div class="inline-flex items-center rounded-xl border border-brasa-border">
                          <button
                            type="button"
                            class="p-2.5 text-brasa-black transition hover:text-brasa-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                            [attr.aria-label]="'Reducir cantidad de ' + item.nombre"
                            (click)="carrito.reducir(item.id)"
                          >
                            <svg lucideMinus [size]="16"></svg>
                          </button>
                          <span class="min-w-10 text-center font-semibold" aria-live="polite">
                            {{ item.cantidad }}
                          </span>
                          <button
                            type="button"
                            class="p-2.5 text-brasa-black transition hover:text-brasa-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                            [attr.aria-label]="'Aumentar cantidad de ' + item.nombre"
                            (click)="carrito.incrementar(item.id)"
                          >
                            <svg lucidePlus [size]="16"></svg>
                          </button>
                        </div>
                        <span class="font-heading text-lg font-bold text-brasa-black">
                          {{ item.precioUnitario * item.cantidad | precioCop }}
                        </span>
                      </div>
                    </div>
                  </li>
                }
              </ul>

              <div class="border-t border-brasa-border p-5 md:p-6">
                <label class="mb-2 flex items-center gap-2 text-sm font-semibold text-brasa-black">
                  <svg lucideMessageSquareText [size]="16" class="text-brasa-orange"></svg>
                  Notas para cocina
                </label>
                <textarea
                  rows="3"
                  class="w-full rounded-xl border border-brasa-border px-4 py-3 text-sm outline-none transition placeholder:text-brasa-muted focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30"
                  placeholder="Añade indicaciones: sin cebolla, salsas aparte, cocción a término medio..."
                  [ngModel]="notasCocina()"
                  (ngModelChange)="notasCocina.set($event)"
                ></textarea>
              </div>
            </div>
          }
        </div>

        <div class="lg:col-span-4">
          <div class="flex flex-col gap-6 lg:sticky lg:top-24">
            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="border-b border-brasa-border px-6 py-4">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Resumen del pedido</h2>
              </header>
              <div class="flex flex-col gap-3 px-6 py-5">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-brasa-muted">Subtotal</span>
                  <span class="font-semibold text-brasa-black">{{ carrito.resumen().subtotal | precioCop }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-brasa-muted">Descuento</span>
                  <span class="font-semibold text-green-600">{{ carrito.resumen().descuento | precioCop }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-brasa-muted">Impuestos ({{ porcentajeImpuesto() }}%)</span>
                  <span class="font-semibold text-brasa-black">{{ carrito.resumen().impuestos | precioCop }}</span>
                </div>

                <div class="flex flex-col gap-2 pt-3">
                  <span class="text-sm font-semibold text-brasa-black">Propina voluntaria</span>
                  <div class="flex flex-wrap gap-2">
                    @for (opcion of opcionesPropina; track opcion.value) {
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-semibold transition"
                        [class]="
                          Math.abs(porcentajePropina() - opcion.value) < 0.0001
                            ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black'
                            : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'
                        "
                        (click)="establecerPropina(opcion.value)"
                      >
                        {{ opcion.label }}
                        <span class="text-xs text-brasa-muted">{{ (opcion.value * 100).toFixed(0) }}%</span>
                      </button>
                    }
                  </div>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-brasa-muted">Propina</span>
                  <span class="font-semibold text-brasa-black">{{ carrito.resumen().propina | precioCop }}</span>
                </div>

                <div class="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-brasa-border p-3">
                  <svg lucideTag [size]="16" class="text-brasa-orange"></svg>
                  <input
                    type="text"
                    class="w-full bg-transparent text-sm outline-none placeholder:text-brasa-muted"
                    placeholder="Código de cupón (ej. BRASA10)"
                    [ngModel]="cupon()"
                    (ngModelChange)="cupon.set($event)"
                    (keydown.enter)="$event.preventDefault(); aplicarCupon()"
                  />
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light"
                    (click)="aplicarCupon()"
                  >
                    Aplicar
                  </button>
                </div>
                @if (mensajeCupon()) {
                  <p class="text-xs font-medium text-brasa-orange" role="status">{{ mensajeCupon() }}</p>
                }

                <div class="mt-3 flex items-center justify-between border-t border-brasa-border pt-4">
                  <span class="font-heading text-base font-semibold text-brasa-black">Total a pagar</span>
                  <span class="font-heading text-2xl font-bold text-brasa-orange" aria-live="polite">
                    {{ carrito.resumen().total | precioCop }}
                  </span>
                </div>
                @if (!carrito.cotizacion() && !carrito.estaVacio()) {
                  <p class="text-xs text-brasa-muted" role="status">
                    {{ carrito.errorCotizacion() || 'Calculando el total con el restaurante...' }}
                  </p>
                }
                @if (!mesa.configurada()) {
                  <p class="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800" role="alert">
                    Escanea el QR de tu mesa o elige "Para llevar" antes de enviar el pedido.
                    <button type="button" class="ml-1 font-semibold underline" (click)="ui.abrirModalCambiarMesa()">Elegir ahora</button>
                  </p>
                }
                @if (errorEnvio()) {
                  <p class="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{{ errorEnvio() }}</p>
                }

                <button
                  type="button"
                  class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  [disabled]="carrito.estaVacio() || enviando() || !mesa.configurada()"
                  (click)="enviarPedido()"
                >
                  @if (enviando()) {
                    Enviando pedido...
                  } @else {
                    <svg lucideShoppingCart [size]="18"></svg>
                    Enviar pedido a cocina
                  }
                </button>

                @if (carrito.estaVacio()) {
                  <p class="flex items-center gap-2 text-xs text-brasa-muted">
                    <svg lucideInfo [size]="14"></svg>
                    Agrega productos para poder enviar tu pedido.
                  </p>
                }
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-2xl border border-brasa-border bg-white px-5 py-4 shadow-card">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brasa-orange/10 text-brasa-orange">
                <svg lucideInfo [size]="18"></svg>
              </span>
              <p class="text-sm text-brasa-muted">
                Tu pedido llega directo a la cocina. Podrás seguirlo en tiempo real y pagar desde tu celular cuando quieras.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

  `,
})
export class CarritoComponent {
  protected readonly carrito = inject(CarritoService);
  protected readonly mesa = inject(MesaService);
  protected readonly ui = inject(UiService);
  private readonly pedidos = inject(PedidosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  protected readonly notasCocina = signal('');
  protected readonly cupon = signal(this.carrito.cupon() ?? '');
  protected readonly mensajeCupon = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal('');
  protected readonly Math = Math;

  protected readonly porcentajeImpuesto = computed(
    () => this.carrito.cotizacion()?.impuestoPorcentaje ?? Math.round(CONFIGURACION.iva * 100),
  );

  protected readonly opcionesPropina = [
    { label: 'Sin propina', value: 0 },
    { label: 'Buen servicio', value: 0.05 },
    { label: 'Excelente', value: 0.1 },
    { label: 'Muy bien', value: 0.12 },
    { label: 'Extra', value: 0.15 },
  ];

  protected readonly porcentajePropina = computed(() => this.carrito.porcentajePropina());

  protected descripcionPersonalizacion(item: ItemCarrito): string {
    const { tamano, extras, retirados } = item.personalizacion;
    const partes: string[] = [];
    if (tamano) partes.push(tamano.nombre);
    if (extras.length > 0) partes.push(extras.map((e) => e.nombre).join(', '));
    if (retirados.length > 0) partes.push(`Sin ${retirados.join(', ').toLowerCase()}`);
    return partes.join(' · ');
  }

  protected establecerPropina(porcentaje: number): void {
    this.carrito.establecerPropina(porcentaje);
  }

  protected async aplicarCupon(): Promise<void> {
    const codigo = this.cupon().trim();
    if (codigo.length === 0) {
      this.mensajeCupon.set('Ingresa un código de cupón para aplicar.');
      return;
    }
    const error = await this.carrito.aplicarCupon(codigo);
    if (error) {
      this.carrito.quitarCupon();
      this.mensajeCupon.set(error);
    } else {
      this.mensajeCupon.set(`Cupón ${this.carrito.cupon()} aplicado correctamente.`);
    }
  }

  /** Envía el pedido al servidor. Si falla, se informa y el carrito se conserva. */
  protected async enviarPedido(): Promise<void> {
    if (this.carrito.estaVacio() || this.enviando()) return;
    if (!this.mesa.configurada()) {
      this.ui.abrirModalCambiarMesa();
      return;
    }
    this.enviando.set(true);
    this.errorEnvio.set('');
    try {
      const pedido = await this.pedidos.enviarCarrito(this.notasCocina());
      this.notificaciones.mostrar(`Pedido ${pedido.numero} enviado a cocina`);
      this.router.navigate(['/pedido', pedido.id]);
    } catch (error) {
      this.errorEnvio.set(mensajeError(error, 'No se pudo enviar el pedido. Tu carrito sigue guardado.'));
      this.notificaciones.mostrar('No se pudo enviar el pedido', 'error');
    } finally {
      this.enviando.set(false);
    }
  }
}
