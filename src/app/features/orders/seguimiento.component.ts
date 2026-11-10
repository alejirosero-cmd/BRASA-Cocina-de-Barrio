import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideCheck, LucideChefHat, LucideClock, LucideMapPin, LucideStar, LucideUtensilsCrossed, LucideCreditCard, LucideX } from '@lucide/angular';
import { PedidosService } from '../../core/services/pedidos.service';
import { mensajeError } from '../../core/services/api.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { EstadoPedido, ETIQUETA_ESTADO_PAGO } from '../../models/pedido.model';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';
import { CalificarPedidoComponent } from '../../shared/components/calificar-pedido/calificar-pedido.component';

interface Paso {
  estados: EstadoPedido[];
  titulo: string;
  descripcion: string;
  icono: 'reloj' | 'cocina' | 'listo' | 'entregado';
}

const ORDEN: EstadoPedido[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'];

@Component({
  selector: 'app-seguimiento',
  imports: [RouterLink, PrecioCopPipe, CalificarPedidoComponent, LucideCheck, LucideChefHat, LucideClock, LucideMapPin, LucideStar, LucideUtensilsCrossed, LucideCreditCard, LucideX],
  template: `
    <section class="mx-auto max-w-[1100px] px-5 py-10 md:px-10">
      @if (cargando()) {
        <p class="py-16 text-center text-sm text-brasa-muted" role="status">Cargando tu pedido...</p>
      } @else if (!pedido()) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brasa-gray-light text-brasa-muted">
            <svg lucideUtensilsCrossed [size]="28"></svg>
          </span>
          <h1 class="font-heading text-2xl font-bold text-brasa-black">Sin pedido en seguimiento</h1>
          <p class="max-w-md text-sm text-brasa-muted">
            {{ error() || 'Cuando envíes tu pedido desde el carrito, podrás seguir su estado aquí.' }}
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-3">
            <a routerLink="/menu" class="inline-flex items-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">Ir al menú</a>
            <a routerLink="/historial" class="inline-flex items-center gap-2 rounded-xl border border-brasa-border px-6 py-3.5 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light">Mis pedidos</a>
          </div>
        </div>
      } @else {
        <div class="mb-8 text-center">
          <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Seguimiento de tu pedido</h1>
          <p class="mt-2 flex items-center justify-center gap-2 text-sm text-brasa-muted sm:text-base">
            <span class="inline-flex h-2 w-2 rounded-full" [class]="pedidos.conectado() ? 'bg-green-500' : 'bg-amber-400'" aria-hidden="true"></span>
            {{ pedidos.conectado() ? 'Actualización en tiempo real activa' : 'Reconectando para recibir actualizaciones...' }}
          </p>
        </div>

        @if (pedido()!.estado === 'CANCELADO') {
          <div class="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700" role="status">
            <strong>Pedido cancelado.</strong> {{ pedido()!.motivoCancelacion }}
          </div>
        }

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
            <header class="flex flex-col gap-2 border-b border-brasa-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-brasa-muted">Número de pedido</p>
                <p class="font-heading text-2xl font-bold text-brasa-black">{{ pedido()!.numero }}</p>
              </div>
              <div class="flex items-center gap-2 rounded-full bg-brasa-orange/10 px-4 py-2 text-sm font-semibold text-brasa-orange">
                <svg lucideClock [size]="16"></svg>
                Tiempo estimado: {{ pedido()!.tiempoEstimadoMin }} min
              </div>
            </header>

            <ol class="p-6" aria-label="Estado del pedido">
              <div class="relative">
                <div class="absolute left-6 top-0 h-full w-px bg-brasa-border" aria-hidden="true"></div>
                <div class="space-y-8">
                  @for (paso of pasos; track paso.titulo) {
                    <li class="relative flex gap-4" [attr.aria-current]="esActual(paso) ? 'step' : null">
                      <div
                        class="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition"
                        [class]="completado(paso) ? 'border-brasa-orange bg-brasa-orange text-white' : 'border-brasa-border bg-white text-brasa-muted'"
                      >
                        @if (completado(paso)) {
                          <svg lucideCheck [size]="18" [strokeWidth]="3"></svg>
                        } @else if (paso.icono === 'cocina') {
                          <svg lucideChefHat [size]="18"></svg>
                        } @else if (paso.icono === 'reloj') {
                          <svg lucideClock [size]="18"></svg>
                        } @else {
                          <svg lucideUtensilsCrossed [size]="18"></svg>
                        }
                      </div>
                      <div class="flex-1 pt-1">
                        <h3 class="font-heading text-base font-semibold" [class]="completado(paso) ? 'text-brasa-black' : 'text-brasa-muted'">
                          {{ paso.titulo }}
                          @if (esActual(paso)) {
                            <span class="ml-2 rounded-full bg-brasa-orange/10 px-2 py-0.5 text-xs text-brasa-orange">Ahora</span>
                          }
                        </h3>
                        <p class="mt-1 text-sm text-brasa-muted">{{ paso.descripcion }}</p>
                      </div>
                    </li>
                  }
                </div>
              </div>
            </ol>
          </div>

          <div class="flex flex-col gap-6">
            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="border-b border-brasa-border px-6 py-4">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Información</h2>
              </header>
              <div class="space-y-3 px-6 py-5">
                <div class="flex items-center gap-3">
                  <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brasa-orange/10 text-brasa-orange">
                    <svg lucideMapPin [size]="18"></svg>
                  </span>
                  <div>
                    <p class="text-xs text-brasa-muted">Ubicación</p>
                    <p class="font-semibold text-brasa-black">{{ ubicacion() }}</p>
                  </div>
                </div>
                <div class="flex items-center justify-between border-t border-brasa-border pt-3 text-sm">
                  <span class="text-brasa-muted">Total</span>
                  <span class="font-heading text-lg font-bold text-brasa-orange">{{ pedido()!.resumen.total | precioCop }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-brasa-muted">Pago</span>
                  <span class="font-semibold" [class]="pedido()!.estadoPago === 'PAGADO' ? 'text-green-600' : 'text-brasa-black'">
                    {{ etiquetaPago[pedido()!.estadoPago] }}
                    @if (pedido()!.estadoPago === 'PARCIAL') { · faltan {{ pedido()!.saldo | precioCop }} }
                  </span>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="border-b border-brasa-border px-6 py-4">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Detalle del pedido</h2>
              </header>
              <div class="flex flex-col gap-3 px-6 py-5">
                @for (item of pedido()!.items; track item.id) {
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <img [src]="item.imagenUrl" [alt]="item.nombre" width="48" height="48" class="h-12 w-12 rounded-xl border border-brasa-border object-cover" />
                      <div>
                        <p class="text-sm font-semibold text-brasa-black">{{ item.nombre }}</p>
                        <p class="text-xs text-brasa-muted">{{ item.cantidad }} x {{ item.precioUnitario | precioCop }}</p>
                      </div>
                    </div>
                    <span class="text-sm font-semibold text-brasa-black">{{ item.precioUnitario * item.cantidad | precioCop }}</span>
                  </div>
                }
              </div>
            </div>

            @if (puedePagar()) {
              <a [routerLink]="['/pagar', pedido()!.id]" class="flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-black px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange">
                <svg lucideCreditCard [size]="18"></svg>
                Pagar la cuenta · {{ pedido()!.saldo | precioCop }}
              </a>
            }

            <a routerLink="/menu" class="flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">
              Ver carta y pedir más items
            </a>

            @if (pedido()!.estado === 'PENDIENTE') {
              <button
                type="button"
                class="flex w-full items-center justify-center gap-2 rounded-xl border border-brasa-border px-6 py-3 text-sm font-semibold text-brasa-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                [disabled]="cancelando()"
                (click)="cancelar()"
              >
                <svg lucideX [size]="16"></svg>
                {{ cancelando() ? 'Cancelando...' : 'Cancelar pedido' }}
              </button>
              <p class="-mt-4 text-center text-xs text-brasa-muted">Puedes cancelarlo hasta que el restaurante lo confirme.</p>
            }

            @if (pedido()!.estado === 'ENTREGADO') {
              @if (pedido()!.calificado) {
                <div class="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700">
                  <svg lucideStar [size]="16" [attr.fill]="'#22C55E'" [attr.stroke]="'#22C55E'"></svg>
                  ¡Gracias! Ya calificaste este pedido
                </div>
              } @else {
                <button
                  type="button"
                  class="flex w-full items-center justify-center gap-2 rounded-xl border border-brasa-orange px-6 py-3.5 text-sm font-semibold text-brasa-orange transition hover:bg-brasa-orange/5"
                  (click)="mostrarCalificar.set(true)"
                >
                  <svg lucideStar [size]="18"></svg>
                  Calificar pedido
                </button>
              }
            }
          </div>
        </div>
      }
    </section>

    <app-calificar-pedido
      [abierto]="mostrarCalificar()"
      [pedidoId]="pedido()?.id ?? null"
      (cerrar)="mostrarCalificar.set(false)"
      (calificado)="alCalificar()"
    ></app-calificar-pedido>
  `,
})
export class SeguimientoComponent implements OnDestroy {
  protected readonly pedidos = inject(PedidosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  /** Id del pedido desde la ruta /pedido/:id (enlazado por withComponentInputBinding). */
  readonly id = input<string>();

  protected readonly pedido = this.pedidos.pedido;
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly cancelando = signal(false);
  protected readonly mostrarCalificar = signal(false);
  protected readonly etiquetaPago = ETIQUETA_ESTADO_PAGO;
  private yaOfrecioCalificar = false;

  protected readonly pasos: Paso[] = [
    { estados: ['PENDIENTE'], titulo: 'Pedido recibido', descripcion: 'El restaurante recibió tu pedido y lo confirmará en breve.', icono: 'reloj' },
    { estados: ['CONFIRMADO', 'EN_PREPARACION'], titulo: 'En preparación', descripcion: 'La cocina está preparando tu orden.', icono: 'cocina' },
    { estados: ['LISTO'], titulo: 'Listo para servir', descripcion: 'Tu pedido está listo; el mesero te lo llevará.', icono: 'listo' },
    { estados: ['ENTREGADO'], titulo: 'Entregado', descripcion: '¡Buen provecho!', icono: 'entregado' },
  ];

  protected readonly ubicacion = computed(() => {
    const m = this.pedido()?.mesa;
    if (!m) return '';
    return m.tipo === 'llevar' ? 'Para llevar' : `Mesa #${String(m.numero ?? '').padStart(2, '0')}`;
  });

  protected readonly puedePagar = computed(() => {
    const p = this.pedido();
    return !!p && p.estado !== 'CANCELADO' && p.saldo > 0;
  });

  constructor() {
    effect(() => {
      const id = this.id() ?? this.pedidos.ultimoId();
      if (!id) {
        this.cargando.set(false);
        return;
      }
      if (!this.id()) {
        this.router.navigate(['/pedido', id], { replaceUrl: true });
        return;
      }
      this.abrir(id);
    });

    // Al entregarse el pedido se ofrece calificarlo una sola vez.
    effect(() => {
      const p = this.pedido();
      if (p?.estado === 'ENTREGADO' && !p.calificado && !this.yaOfrecioCalificar) {
        this.yaOfrecioCalificar = true;
        setTimeout(() => this.mostrarCalificar.set(true), 800);
      }
    });
  }

  ngOnDestroy(): void {
    this.pedidos.dejarDeSeguir();
  }

  private async abrir(id: string): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.pedidos.cargar(id);
      this.pedidos.seguir(id);
    } catch (e) {
      this.error.set(mensajeError(e, 'No encontramos ese pedido en este dispositivo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  protected completado(paso: Paso): boolean {
    const estado = this.pedido()?.estado;
    if (!estado || estado === 'CANCELADO') return false;
    const actual = ORDEN.indexOf(estado);
    return ORDEN.indexOf(paso.estados[0]) <= actual;
  }

  protected esActual(paso: Paso): boolean {
    const estado = this.pedido()?.estado;
    return !!estado && paso.estados.includes(estado) && estado !== 'ENTREGADO';
  }

  protected async cancelar(): Promise<void> {
    const p = this.pedido();
    if (!p || !confirm('¿Seguro que quieres cancelar tu pedido?')) return;
    this.cancelando.set(true);
    try {
      await this.pedidos.cancelar(p.id);
      this.notificaciones.mostrar('Pedido cancelado', 'info');
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e), 'error');
    } finally {
      this.cancelando.set(false);
    }
  }

  protected alCalificar(): void {
    this.mostrarCalificar.set(false);
    const id = this.pedido()?.id;
    if (id) this.pedidos.cargar(id).catch(() => undefined);
  }
}
