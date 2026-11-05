import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck, LucideChefHat, LucideClock, LucideMapPin, LucideStar, LucideUtensilsCrossed } from '@lucide/angular';
import { PedidosService } from '../../core/services/pedidos.service';
import { MesaService } from '../../core/services/mesa.service';
import { CalificacionesService } from '../../core/services/calificaciones.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';
import { CalificarPedidoComponent } from '../../shared/components/calificar-pedido/calificar-pedido.component';

type Paso = { id: 'recibido' | 'preparando' | 'listo'; titulo: string; descripcion: string };

@Component({
  selector: 'app-seguimiento',
  imports: [RouterLink, PrecioCopPipe, CalificarPedidoComponent, LucideCheck, LucideChefHat, LucideClock, LucideMapPin, LucideStar, LucideUtensilsCrossed],
  template: `
    <section class="mx-auto max-w-[1100px] px-5 py-10 md:px-10">
      @if (!pedidos.hayPedidoActivo()) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brasa-gray-light text-brasa-muted">
            <svg lucideUtensilsCrossed [size]="28"></svg>
          </span>
          <h1 class="font-heading text-2xl font-bold text-brasa-black">Sin pedido en seguimiento</h1>
          <p class="max-w-md text-sm text-brasa-muted">
            Cuando envíes tu pedido desde el carrito, podrás seguir su estado aquí.
          </p>
          <a routerLink="/menu" class="mt-2 inline-flex items-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">
            Ir al menú
          </a>
        </div>
      } @else {
        <div class="mb-8 text-center">
          <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Seguimiento de tu pedido</h1>
          <p class="mt-2 text-sm text-brasa-muted sm:text-base">Te avisamos cuando esté listo para servir</p>
        </div>

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

            <div class="p-6">
              <div class="relative">
                <div class="absolute left-6 top-0 h-full w-px bg-brasa-border"></div>
                <div class="space-y-8">
                  @for (paso of pasos; track paso.id; let i = $index) {
                    <div class="relative flex gap-4">
                      <div
                        class="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2"
                        [class]="estadoPaso(paso.id) >= i ? 'border-brasa-orange bg-brasa-orange text-white' : 'border-brasa-border bg-white text-brasa-muted'"
                      >
                        @if (estadoPaso(paso.id) >= i) {
                          <svg lucideCheck [size]="18" [strokeWidth]="3"></svg>
                        } @else if (paso.id === 'preparando') {
                          <svg lucideChefHat [size]="18"></svg>
                        } @else if (paso.id === 'listo') {
                          <svg lucideUtensilsCrossed [size]="18"></svg>
                        } @else {
                          <svg lucideClock [size]="18"></svg>
                        }
                      </div>
                      <div class="flex-1 pt-1">
                        <h3 class="font-heading text-base font-semibold" [class]="estadoPaso(paso.id) >= i ? 'text-brasa-black' : 'text-brasa-muted'">
                          {{ paso.titulo }}
                        </h3>
                        <p class="mt-1 text-sm" [class]="estadoPaso(paso.id) >= i ? 'text-brasa-muted' : 'text-brasa-muted/70'">
                          {{ paso.descripcion }}
                        </p>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
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
                    <p class="font-semibold text-brasa-black">{{ mesa.etiqueta() }}</p>
                  </div>
                </div>
                <div class="flex items-center justify-between border-t border-brasa-border pt-3 text-sm">
                  <span class="text-brasa-muted">Total</span>
                  <span class="font-heading text-lg font-bold text-brasa-orange">{{ pedido()!.resumen.total | precioCop }}</span>
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

            <a routerLink="/menu" class="flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">
              Ver carta y pedir más items
            </a>

            @if (pedido()!.estado === 'listo') {
              @if (yaCalificado()) {
                <div class="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700">
                  <svg lucideStar [size]="16" [attr.fill]="'#22C55E'" [attr.stroke]="'#22C55E'"></svg>
                  ¡Gracias! Ya calificaste este pedido
                </div>
              } @else {
                <button
                  type="button"
                  class="flex w-full items-center justify-center gap-2 rounded-xl border border-brasa-orange px-6 py-3.5 text-sm font-semibold text-brasa-orange transition hover:bg-brasa-orange/5"
                  (click)="abrirCalificar()"
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
      (cerrar)="cerrarCalificar()"
      (calificado)="alCalificar()"
    ></app-calificar-pedido>
  `,
})
export class SeguimientoComponent {
  protected readonly pedidos = inject(PedidosService);
  protected readonly mesa = inject(MesaService);
  private readonly calificaciones = inject(CalificacionesService);

  protected readonly pedido = this.pedidos.pedido;
  protected readonly mostrarCalificar = signal(false);
  protected readonly yaCalificado = signal(false);

  protected readonly pasos: Paso[] = [
    { id: 'recibido', titulo: 'Pedido recibido', descripcion: 'Hemos recibido tu pedido correctamente.' },
    { id: 'preparando', titulo: 'En preparación', descripcion: 'La cocina está preparando tu orden.' },
    { id: 'listo', titulo: 'Listo para servir', descripcion: 'Tu pedido está listo. Pídele al mesero que te lo entregue.' },
  ];

  protected estadoPaso(paso: Paso['id']): number {
    const estado = this.pedido()?.estado || 'recibido';
    const mapa: Record<string, number> = { recibido: 0, preparando: 1, listo: 2 };
    const actual = mapa[estado] ?? 0;
    const pasoIndex = mapa[paso] ?? 0;
    return actual >= pasoIndex ? 1 : 0;
  }

  constructor() {
    effect(() => {
      const p = this.pedido();
      if (p && p.estado === 'recibido') {
        setTimeout(() => this.pedidos.actualizarEstado('preparando'), 5000);
        setTimeout(() => this.pedidos.actualizarEstado('listo'), 12000);
      }
      if (p && p.estado === 'listo') {
        this.yaCalificado.set(this.calificaciones.yaCalificado(p.id));
        if (!this.calificaciones.yaCalificado(p.id)) {
          // Mostrar modal después de un breve momento
          setTimeout(() => this.mostrarCalificar.set(true), 800);
        }
      }
    });
  }

  protected abrirCalificar(): void {
    this.mostrarCalificar.set(true);
  }

  protected cerrarCalificar(): void {
    this.mostrarCalificar.set(false);
  }

  protected alCalificar(): void {
    const p = this.pedido();
    if (p) {
      this.yaCalificado.set(this.calificaciones.yaCalificado(p.id));
    }
    this.mostrarCalificar.set(false);
  }
}
