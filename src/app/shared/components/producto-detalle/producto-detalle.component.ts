import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { LucideMinus, LucidePlus } from '@lucide/angular';
import { Producto } from '../../../models/producto.model';
import { PersonalizacionItem } from '../../../models/carrito.model';
import { CarritoService, calcularPrecioUnitario } from '../../../core/services/carrito.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { ModalComponent } from '../modal/modal.component';
import { PrecioCopPipe } from '../../pipes/precio-cop.pipe';

@Component({
  selector: 'app-producto-detalle',
  imports: [ModalComponent, PrecioCopPipe, LucidePlus, LucideMinus],
  template: `
    @if (abierto() && producto()) {
      <app-modal [titulo]="producto()!.nombre" anchoClase="max-w-2xl" (cerrar)="cerrar.emit()">
        <div class="grid grid-cols-1 gap-0 md:grid-cols-2">
          <div class="relative aspect-square bg-brasa-gray-light md:aspect-auto md:h-full">
            <img
              [src]="producto()!.imagenUrl"
              [alt]="producto()!.nombre"
              width="600"
              height="600"
              class="h-full w-full object-cover"
            />
          </div>

          <div class="flex max-h-[80vh] flex-col overflow-y-auto">
            <div class="flex-1 space-y-6 p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="font-heading text-xl font-semibold text-brasa-black">
                    {{ producto()!.nombre }}
                  </h2>
                  <p class="mt-1 text-sm leading-relaxed text-brasa-muted">
                    {{ producto()!.descripcion }}
                  </p>
                </div>
                <span class="shrink-0 font-heading text-lg font-bold text-brasa-orange">
                  {{ precioTotal() | precioCop }}
                </span>
              </div>

              @if (producto()!.tamanos && producto()!.tamanos!.length > 0) {
                <section class="space-y-2">
                  <h3 class="text-sm font-semibold text-brasa-black">Tamaño</h3>
                  <div class="flex flex-wrap gap-2">
                    @for (tamano of producto()!.tamanos!; track tamano.id) {
                      <button
                        type="button"
                        class="rounded-xl border px-4 py-2 text-sm transition"
                        [class]="
                          tamanoSeleccionado()?.id === tamano.id
                            ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black'
                            : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'
                        "
                        (click)="seleccionarTamano(tamano)"
                      >
                        {{ tamano.nombre }}
                        @if (tamano.diferenciaPrecio !== 0) {
                          <span class="ml-1 text-xs">({{ tamano.diferenciaPrecio > 0 ? '+' : '' }}{{ tamano.diferenciaPrecio | precioCop }})</span>
                        }
                      </button>
                    }
                  </div>
                </section>
              }

              @if (producto()!.extras && producto()!.extras!.length > 0) {
                <section class="space-y-2">
                  <h3 class="text-sm font-semibold text-brasa-black">Extras</h3>
                  <div class="space-y-2">
                    @for (extra of producto()!.extras!; track extra.id) {
                      <button
                        type="button"
                        class="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition"
                        [class]="
                          estaExtra(extra.id)
                            ? 'border-brasa-orange bg-brasa-orange/5'
                            : 'border-brasa-border hover:border-brasa-muted'
                        "
                        (click)="alternarExtra(extra)"
                      >
                        <span class="text-sm text-brasa-black">{{ extra.nombre }}</span>
                        <span class="text-sm font-semibold text-brasa-orange">+{{ extra.precio | precioCop }}</span>
                      </button>
                    }
                  </div>
                </section>
              }

              @if (producto()!.salsas && producto()!.salsas!.length > 0) {
                <section class="space-y-2">
                  <h3 class="text-sm font-semibold text-brasa-black">Salsas</h3>
                  <div class="space-y-2">
                    @for (salsa of producto()!.salsas!; track salsa.id) {
                      <button
                        type="button"
                        class="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition"
                        [class]="
                          estaSalsa(salsa.id)
                            ? 'border-brasa-orange bg-brasa-orange/5'
                            : 'border-brasa-border hover:border-brasa-muted'
                        "
                        (click)="alternarSalsa(salsa)"
                      >
                        <span class="text-sm text-brasa-black">{{ salsa.nombre }}</span>
                        <span class="text-sm text-brasa-muted">{{ salsa.precio === 0 ? 'Sin costo' : '+' + (salsa.precio | precioCop) }}</span>
                      </button>
                    }
                  </div>
                </section>
              }

              @if (producto()!.retirables && producto()!.retirables!.length > 0) {
                <section class="space-y-2">
                  <h3 class="text-sm font-semibold text-brasa-black">Quitar ingredientes</h3>
                  <div class="flex flex-wrap gap-2">
                    @for (item of producto()!.retirables!; track item.id) {
                      <button
                        type="button"
                        class="rounded-xl border px-3 py-1.5 text-sm transition"
                        [class]="
                          estaRetirado(item.nombre)
                            ? 'border-brasa-black bg-brasa-black text-white'
                            : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'
                        "
                        (click)="alternarRetirado(item.nombre)"
                      >
                        Sin {{ item.nombre }}
                      </button>
                    }
                  </div>
                </section>
              }

              <section class="space-y-2">
                <h3 class="text-sm font-semibold text-brasa-black">Instrucciones especiales para cocina</h3>
                <textarea
                  rows="3"
                  class="w-full rounded-xl border border-brasa-border px-4 py-3 text-sm outline-none transition placeholder:text-brasa-muted focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30"
                  placeholder="Ej. Término medio, salsas aparte, sin hielo..."
                  [value]="instrucciones()"
                  (input)="instrucciones.set($any($event.target).value)"
                ></textarea>
              </section>
            </div>

            <div class="flex items-center gap-3 border-t border-brasa-border p-6">
              <div class="inline-flex items-center rounded-xl border border-brasa-border">
                <button
                  type="button"
                  class="p-2.5 text-brasa-black transition hover:text-brasa-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                  [attr.aria-label]="'Reducir cantidad'"
                  (click)="reducir()"
                >
                  <svg lucideMinus [size]="16"></svg>
                </button>
                <span class="min-w-10 text-center font-semibold">{{ cantidad() }}</span>
                <button
                  type="button"
                  class="p-2.5 text-brasa-black transition hover:text-brasa-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                  [attr.aria-label]="'Aumentar cantidad'"
                  (click)="aumentar()"
                >
                  <svg lucidePlus [size]="16"></svg>
                </button>
              </div>

              <button
                type="button"
                class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2"
                (click)="agregarAlCarrito()"
              >
                Agregar al pedido · {{ precioTotal() | precioCop }}
              </button>
            </div>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ProductoDetalleComponent {
  readonly producto = input<Producto | null>(null);
  readonly abierto = input(false);
  readonly cerrar = output<void>();

  private readonly carrito = inject(CarritoService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly tamanoSeleccionado = signal<any>(null);
  protected readonly extrasSeleccionados = signal<any[]>([]);
  protected readonly salsasSeleccionadas = signal<any[]>([]);
  protected readonly retirados = signal<string[]>([]);
  protected readonly instrucciones = signal('');
  protected readonly cantidad = signal(1);

  protected readonly precioTotal = computed(() => {
    const prod = this.producto();
    if (!prod) return 0;
    const personalizacion: PersonalizacionItem = {
      tamano: this.tamanoSeleccionado(),
      extras: this.extrasSeleccionados(),
      salsas: this.salsasSeleccionadas(),
      retirados: this.retirados(),
      instrucciones: this.instrucciones(),
    };
    return calcularPrecioUnitario(prod, personalizacion) * this.cantidad();
  });

  constructor() {
    effect(() => {
      if (this.abierto() && this.producto()) {
        const p = this.producto()!;
        this.tamanoSeleccionado.set(p.tamanos?.[0] ?? null);
        this.extrasSeleccionados.set([]);
        this.salsasSeleccionadas.set([]);
        this.retirados.set([]);
        this.instrucciones.set('');
        this.cantidad.set(1);
      }
    });
  }

  protected seleccionarTamano(tamano: any): void {
    this.tamanoSeleccionado.set(tamano);
  }

  protected estaExtra(id: string): boolean {
    return this.extrasSeleccionados().some((e) => e.id === id);
  }

  protected alternarExtra(extra: any): void {
    if (this.estaExtra(extra.id)) {
      this.extrasSeleccionados.update((actuales) => actuales.filter((e) => e.id !== extra.id));
    } else {
      this.extrasSeleccionados.update((actuales) => [...actuales, extra]);
    }
  }

  protected estaSalsa(id: string): boolean {
    return this.salsasSeleccionadas().some((s) => s.id === id);
  }

  protected alternarSalsa(salsa: any): void {
    if (this.estaSalsa(salsa.id)) {
      this.salsasSeleccionadas.update((actuales) => actuales.filter((s) => s.id !== salsa.id));
    } else {
      this.salsasSeleccionadas.update((actuales) => [...actuales, salsa]);
    }
  }

  protected estaRetirado(nombre: string): boolean {
    return this.retirados().includes(nombre);
  }

  protected alternarRetirado(nombre: string): void {
    if (this.estaRetirado(nombre)) {
      this.retirados.update((actuales) => actuales.filter((n) => n !== nombre));
    } else {
      this.retirados.update((actuales) => [...actuales, nombre]);
    }
  }

  protected reducir(): void {
    if (this.cantidad() > 1) {
      this.cantidad.update((c) => c - 1);
    }
  }

  protected aumentar(): void {
    this.cantidad.update((c) => c + 1);
  }

  protected agregarAlCarrito(): void {
    const prod = this.producto();
    if (!prod) return;
    const personalizacion: PersonalizacionItem = {
      tamano: this.tamanoSeleccionado(),
      extras: this.extrasSeleccionados(),
      salsas: this.salsasSeleccionadas(),
      retirados: this.retirados(),
      instrucciones: this.instrucciones().trim(),
    };
    this.carrito.agregar({ producto: prod, personalizacion, cantidad: this.cantidad() });
    this.notificaciones.mostrar(`Se agregó ${prod.nombre} al carrito`);
    this.cerrar.emit();
  }
}
