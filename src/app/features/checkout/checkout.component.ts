import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideCreditCard, LucideFileText, LucideInfo, LucideMinus, LucidePlus, LucideSmartphone, LucideUserPlus, LucideUsers, LucideX } from '@lucide/angular';
import { CarritoService } from '../../core/services/carrito.service';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

type MetodoPago = 'tarjeta' | 'nequi' | 'daviplata' | 'efectivo';
type ModoDivision = 'igual' | 'consumo';

interface PersonaDivision {
  id: string;
  nombre: string;
}

@Component({
  selector: 'app-checkout',
  imports: [
    FormsModule,
    RouterLink,
    PrecioCopPipe,
    LucideArrowLeft,
    LucideCreditCard,
    LucideSmartphone,
    LucideUsers,
    LucideUserPlus,
    LucideX,
    LucideFileText,
    LucideInfo,
    LucideMinus,
    LucidePlus,
  ],
  template: `
    <section class="mx-auto max-w-[1400px] px-5 py-10 md:px-10">
      <div class="mb-6">
        <a routerLink="/carrito" class="inline-flex items-center gap-2 text-sm font-semibold text-brasa-muted transition hover:text-brasa-black">
          <svg lucideArrowLeft [size]="16"></svg>
          Volver al carrito
        </a>
        <h1 class="mt-3 font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Pago y facturación</h1>
        <p class="mt-2 text-sm text-brasa-muted sm:text-base">Selecciona tu método de pago. Los datos de tarjeta no se almacenan.</p>
      </div>

      @if (carrito.estaVacio()) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <p class="font-heading text-xl font-semibold text-brasa-black">No hay productos para pagar</p>
          <p class="text-sm text-brasa-muted">Agrega productos al carrito para continuar con el pago.</p>
          <a routerLink="/menu" class="mt-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark">Ir al menú</a>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div class="flex flex-col gap-6 lg:col-span-7">
            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="border-b border-brasa-border px-6 py-4">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Método de pago</h2>
              </header>
              <div class="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                @for (metodo of metodos; track metodo.id) {
                  <button
                    type="button"
                    class="flex items-center gap-3 rounded-xl border-2 p-4 text-left transition"
                    [class]="metodoSeleccionado() === metodo.id ? 'border-brasa-orange bg-brasa-orange/5' : 'border-brasa-border hover:border-brasa-muted'"
                    (click)="metodoSeleccionado.set(metodo.id)"
                  >
                    <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-brasa-orange/10 text-brasa-orange">
                      @if (metodo.id === 'tarjeta') { <svg lucideCreditCard [size]="18"></svg> }
                      @else if (metodo.id === 'nequi' || metodo.id === 'daviplata') { <svg lucideSmartphone [size]="18"></svg> }
                      @else { <svg lucideUsers [size]="18"></svg> }
                    </span>
                    <div>
                      <p class="font-semibold text-brasa-black">{{ metodo.titulo }}</p>
                      <p class="text-xs text-brasa-muted">{{ metodo.descripcion }}</p>
                    </div>
                  </button>
                }
              </div>

              @if (metodoSeleccionado() === 'tarjeta') {
                <div class="space-y-4 border-t border-brasa-border p-6">
                  <p class="text-xs text-brasa-muted">Simulación: no se envían datos reales. Usa solo para pruebas.</p>
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label class="space-y-1 text-sm">
                      <span class="font-medium text-brasa-black">Nombre en la tarjeta</span>
                      <input class="w-full rounded-xl border border-brasa-border px-4 py-3 outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30" placeholder="Nombre completo" />
                    </label>
                    <label class="space-y-1 text-sm">
                      <span class="font-medium text-brasa-black">Número de tarjeta</span>
                      <input class="w-full rounded-xl border border-brasa-border px-4 py-3 outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30" placeholder="0000 0000 0000 0000" inputmode="numeric" />
                    </label>
                    <label class="space-y-1 text-sm">
                      <span class="font-medium text-brasa-black">Fecha de vencimiento</span>
                      <input class="w-full rounded-xl border border-brasa-border px-4 py-3 outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30" placeholder="MM/AA" />
                    </label>
                    <label class="space-y-1 text-sm">
                      <span class="font-medium text-brasa-black">CVV</span>
                      <input class="w-full rounded-xl border border-brasa-border px-4 py-3 outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30" placeholder="123" inputmode="numeric" />
                    </label>
                  </div>
                </div>
              }
            </div>

            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="flex items-center gap-2 border-b border-brasa-border px-6 py-4">
                <svg lucideUsers [size]="18" class="text-brasa-orange"></svg>
                <h2 class="font-heading text-base font-semibold text-brasa-black">Dividir la cuenta</h2>
              </header>
              <div class="flex flex-col gap-4 p-6">
                <div class="grid grid-cols-2 gap-2 rounded-xl bg-brasa-gray-light p-1">
                  <button
                    type="button"
                    class="rounded-lg px-4 py-2 text-sm font-semibold transition"
                    [class]="modoDivision() === 'igual' ? 'bg-white text-brasa-black shadow-sm' : 'text-brasa-muted hover:text-brasa-black'"
                    (click)="modoDivision.set('igual')"
                  >
                    Partes iguales
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-4 py-2 text-sm font-semibold transition"
                    [class]="modoDivision() === 'consumo' ? 'bg-white text-brasa-black shadow-sm' : 'text-brasa-muted hover:text-brasa-black'"
                    (click)="modoDivision.set('consumo')"
                  >
                    Por lo que consumió
                  </button>
                </div>

                @if (modoDivision() === 'igual') {
                  <div class="rounded-xl border border-brasa-border">
                    <div class="flex items-center justify-between border-b border-brasa-border px-5 py-4">
                      <div>
                        <p class="text-sm font-medium text-brasa-black">Número de personas</p>
                        <p class="text-xs text-brasa-muted">Mínimo 2, máximo 10</p>
                      </div>
                      <div class="inline-flex items-center rounded-xl border border-brasa-border">
                        <button
                          type="button"
                          class="p-2.5 text-brasa-black transition hover:text-brasa-orange disabled:cursor-not-allowed disabled:opacity-40"
                          (click)="disminuirPersonas()"
                          [disabled]="personas() <= 2"
                          aria-label="Reducir número de personas"
                        >
                          <svg lucideMinus [size]="16"></svg>
                        </button>
                        <span class="min-w-10 text-center font-semibold">{{ personas() }}</span>
                        <button
                          type="button"
                          class="p-2.5 text-brasa-black transition hover:text-brasa-orange disabled:cursor-not-allowed disabled:opacity-40"
                          (click)="incrementarPersonas()"
                          [disabled]="personas() >= 10"
                          aria-label="Aumentar número de personas"
                        >
                          <svg lucidePlus [size]="16"></svg>
                        </button>
                      </div>
                    </div>

                    <div class="space-y-2 px-5 py-4">
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-brasa-muted">Total a dividir</span>
                        <span class="font-semibold text-brasa-black">{{ carrito.total() | precioCop }}</span>
                      </div>
                      @if (resto() > 0) {
                        <p class="text-xs text-brasa-muted">Se redondea hacia arriba para simplificar el cobro.</p>
                      }
                      <div class="mt-2 flex items-center justify-between rounded-xl bg-brasa-orange/5 px-4 py-3">
                        <span class="font-medium text-brasa-black">Cada uno paga</span>
                        <span class="font-heading text-xl font-bold text-brasa-orange">{{ totalPorPersona() | precioCop }}</span>
                      </div>
                    </div>
                  </div>
                }

                @if (modoDivision() === 'consumo') {
                  <div class="space-y-4">
                    <div class="flex flex-wrap items-center gap-2">
                      @for (persona of personasLista(); track persona.id) {
                        <div class="inline-flex items-center gap-2 rounded-full border border-brasa-border bg-white px-3 py-1.5">
                          <span class="text-sm font-medium text-brasa-black">{{ persona.nombre }}</span>
                          @if (personasLista().length > 2) {
                            <button type="button" class="text-brasa-muted transition hover:text-brasa-black" (click)="eliminarPersona(persona.id)" aria-label="Eliminar persona">
                              <svg lucideX [size]="14"></svg>
                            </button>
                          }
                        </div>
                      }
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brasa-border px-3 py-1.5 text-sm text-brasa-muted transition hover:border-brasa-orange hover:text-brasa-orange disabled:cursor-not-allowed disabled:opacity-40"
                        (click)="agregarPersona()"
                        [disabled]="personasLista().length >= 10"
                      >
                        <svg lucideUserPlus [size]="16"></svg>
                        Agregar persona
                      </button>
                    </div>

                    <div class="space-y-3">
                      @for (item of carrito.lineas(); track item.id) {
                        <div class="rounded-xl border border-brasa-border p-4">
                          <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3">
                              <img [src]="item.imagenUrl" [alt]="item.nombre" width="48" height="48" class="h-12 w-12 rounded-xl border border-brasa-border object-cover" />
                              <div>
                                <p class="font-semibold text-brasa-black">{{ item.nombre }}</p>
                                <p class="text-xs text-brasa-muted">{{ item.cantidad }} x {{ item.precioUnitario | precioCop }} · {{ (item.precioUnitario * item.cantidad) | precioCop }}</p>
                              </div>
                            </div>
                            <button type="button" class="text-xs font-semibold text-brasa-orange" (click)="asignarATodos(item.id)">Pagar entre todos</button>
                          </div>
                          <div class="mt-3 flex flex-wrap gap-2">
                            @for (persona of personasLista(); track persona.id) {
                              <button
                                type="button"
                                class="rounded-full border px-3 py-1.5 text-sm transition"
                                [class]="estaAsignado(item.id, persona.id) ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black' : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'"
                                (click)="alternarAsignacion(item.id, persona.id)"
                              >
                                {{ persona.nombre }}
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    @if (itemsSinAsignar().length > 0) {
                      <div class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <svg lucideInfo [size]="16" class="mt-0.5 shrink-0"></svg>
                        Hay {{ itemsSinAsignar().length }} producto(s) sin asignar. Debes seleccionar quién lo paga para calcular correctamente.
                      </div>
                    }

                    @if (totalesPorPersona().length > 0 && itemsSinAsignar().length === 0) {
                      <div class="space-y-2">
                        <p class="text-sm font-semibold text-brasa-black">A pagar por persona</p>
                        @for (tp of totalesPorPersona(); track tp.persona.id) {
                          <div class="flex items-center justify-between rounded-xl border border-brasa-border px-4 py-3">
                            <div>
                              <p class="font-medium text-brasa-black">{{ tp.persona.nombre }}</p>
                              <p class="text-xs text-brasa-muted">Consumo: {{ tp.subtotal | precioCop }}</p>
                            </div>
                            <span class="font-heading text-lg font-bold text-brasa-orange">{{ tp.total | precioCop }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="flex items-center gap-2 border-b border-brasa-border px-6 py-4">
                <svg lucideFileText [size]="18" class="text-brasa-orange"></svg>
                <h2 class="font-heading text-base font-semibold text-brasa-black">Factura electrónica</h2>
              </header>
              <div class="flex flex-col gap-3 p-6">
                <label class="flex items-center gap-3 text-sm">
                  <input type="checkbox" class="h-4 w-4 rounded border-brasa-border text-brasa-orange focus:ring-brasa-orange" [checked]="solicitarFactura()" (change)="solicitarFactura.set($any($event.target).checked)" />
                  <span class="text-brasa-black">Solicitar factura electrónica</span>
                </label>
                @if (solicitarFactura()) {
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label class="space-y-1 text-sm">
                      <span class="font-medium text-brasa-black">NIT / Identificación</span>
                      <input class="w-full rounded-xl border border-brasa-border px-4 py-3 outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30" placeholder="Número de identificación" />
                    </label>
                    <label class="space-y-1 text-sm">
                      <span class="font-medium text-brasa-black">Correo electrónico</span>
                      <input type="email" class="w-full rounded-xl border border-brasa-border px-4 py-3 outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30" placeholder="correo@ejemplo.com" />
                    </label>
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="lg:col-span-5">
            <div class="flex flex-col gap-6 lg:sticky lg:top-24">
              <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
                <header class="border-b border-brasa-border px-6 py-4">
                  <h2 class="font-heading text-base font-semibold text-brasa-black">Resumen</h2>
                </header>
                <div class="flex flex-col gap-3 px-6 py-5">
                  @for (item of carrito.lineas(); track item.id) {
                    <div class="flex items-center justify-between gap-3 text-sm">
                      <div class="flex items-center gap-3">
                        <img [src]="item.imagenUrl" [alt]="item.nombre" width="48" height="48" class="h-12 w-12 rounded-xl border border-brasa-border object-cover" />
                        <div>
                          <p class="font-semibold text-brasa-black">{{ item.nombre }}</p>
                          <p class="text-xs text-brasa-muted">{{ item.cantidad }} x {{ item.precioUnitario | precioCop }}</p>
                        </div>
                      </div>
                      <span class="font-semibold text-brasa-black">{{ item.precioUnitario * item.cantidad | precioCop }}</span>
                    </div>
                  }
                  <div class="border-t border-brasa-border pt-3">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-brasa-muted">Subtotal</span>
                      <span class="font-semibold text-brasa-black">{{ carrito.subtotal() | precioCop }}</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-brasa-muted">Impuestos</span>
                      <span class="font-semibold text-brasa-black">{{ carrito.impuestos() | precioCop }}</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-brasa-muted">Propina</span>
                      <span class="font-semibold text-brasa-black">{{ carrito.propina() | precioCop }}</span>
                    </div>
                    @if (carrito.descuento() > 0) {
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-brasa-muted">Descuento</span>
                        <span class="font-semibold text-green-600">-{{ carrito.descuento() | precioCop }}</span>
                      </div>
                    }
                    <div class="mt-3 flex items-center justify-between border-t border-brasa-border pt-3">
                      <span class="font-heading text-base font-semibold text-brasa-black">Total</span>
                      <span class="font-heading text-2xl font-bold text-brasa-orange">{{ carrito.total() | precioCop }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="!puedePagar()"
                (click)="pagar()"
              >
                <svg lucideCreditCard [size]="18"></svg>
                Confirmar y pagar
              </button>

              <div class="flex items-start gap-3 rounded-2xl border border-brasa-border bg-white px-5 py-4 text-xs text-brasa-muted">
                <svg lucideInfo [size]="16" class="mt-0.5 shrink-0 text-brasa-orange"></svg>
                @if (modoDivision() === 'consumo' && itemsSinAsignar().length > 0) {
                  Asigna todos los productos a alguna persona para poder confirmar el pago.
                } @else {
                  Pasarela de pago en preparación. Esta es una simulación para pruebas.
                }
              </div>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class CheckoutComponent {
  private readonly router = inject(Router);
  protected readonly carrito = inject(CarritoService);
  private readonly mesa = inject(MesaService);
  private readonly pedidos = inject(PedidosService);
  private readonly notificaciones = inject(NotificacionesService);

  protected readonly metodoSeleccionado = signal<MetodoPago>('tarjeta');
  protected readonly dividir = signal(false);
  protected readonly personas = signal(2);
  protected readonly solicitarFactura = signal(false);

  protected readonly modoDivision = signal<ModoDivision>('igual');
  protected readonly personasLista = signal<PersonaDivision[]>([
    { id: 'p1', nombre: 'Persona 1' },
    { id: 'p2', nombre: 'Persona 2' },
  ]);
  protected readonly asignaciones = signal<Record<string, string[]>>({});

  protected readonly totalPorPersona = computed(() => {
    const p = this.personas() <= 0 ? 1 : this.personas();
    return Math.ceil(this.carrito.total() / p);
  });

  protected readonly resto = computed(() => {
    const p = this.personas() <= 0 ? 1 : this.personas();
    return this.carrito.total() % p;
  });

  protected incrementarPersonas(): void {
    if (this.personas() < 10) {
      this.personas.update((v) => v + 1);
    }
  }

  protected disminuirPersonas(): void {
    if (this.personas() > 2) {
      this.personas.update((v) => v - 1);
    }
  }

  protected agregarPersona(): void {
    if (this.personasLista().length >= 10) return;
    const numero = this.personasLista().length + 1;
    this.personasLista.update((actuales) => [
      ...actuales,
      { id: `p${Date.now()}`, nombre: `Persona ${numero}` },
    ]);
  }

  protected eliminarPersona(id: string): void {
    if (this.personasLista().length <= 2) return;
    this.personasLista.update((actuales) => actuales.filter((p) => p.id !== id));
    this.asignaciones.update((actual) => {
      const copia: Record<string, string[]> = { ...actual };
      Object.keys(copia).forEach((itemId) => {
        copia[itemId] = copia[itemId].filter((pid) => pid !== id);
        if (copia[itemId].length === 0) {
          delete copia[itemId];
        }
      });
      return copia;
    });
  }

  protected estaAsignado(itemId: string, personaId: string): boolean {
    return (this.asignaciones()[itemId] || []).includes(personaId);
  }

  protected alternarAsignacion(itemId: string, personaId: string): void {
    this.asignaciones.update((actual) => {
      const actuales = actual[itemId] || [];
      if (actuales.includes(personaId)) {
        const filtrados = actuales.filter((id) => id !== personaId);
        if (filtrados.length === 0) {
          const copia: Record<string, string[]> = { ...actual };
          delete copia[itemId];
          return copia;
        }
        return { ...actual, [itemId]: filtrados };
      }
      return { ...actual, [itemId]: [...actuales, personaId] };
    });
  }

  protected asignarATodos(itemId: string): void {
    this.asignaciones.update((actual) => ({
      ...actual,
      [itemId]: this.personasLista().map((p) => p.id),
    }));
  }

  protected readonly totalesPorPersona = computed(() => {
    if (this.modoDivision() !== 'consumo') return [];
    const items = this.carrito.lineas();
    const personas = this.personasLista();
    const subtotalTotal = this.carrito.subtotal();
    const descuentoTotal = this.carrito.descuento();
    const impuestosTotal = this.carrito.impuestos();
    const propinaTotal = this.carrito.propina();

    return personas.map((persona) => {
      let subtotalPersona = 0;
      items.forEach((item) => {
        const asignados = this.asignaciones()[item.id] || [];
        if (asignados.includes(persona.id) && asignados.length > 0) {
          subtotalPersona += (item.precioUnitario * item.cantidad) / asignados.length;
        }
      });
      subtotalPersona = Math.round(subtotalPersona);

      const ratio = subtotalTotal === 0 ? 0 : subtotalPersona / subtotalTotal;
      const descuentoPersona = Math.round(descuentoTotal * ratio);
      const base = subtotalPersona - descuentoPersona;
      const impuestosPersona = Math.round(impuestosTotal * ratio);
      const propinaPersona = Math.round(propinaTotal * ratio);
      const totalPersona = base + impuestosPersona + propinaPersona;

      return {
        persona,
        subtotal: subtotalPersona,
        descuento: descuentoPersona,
        impuestos: impuestosPersona,
        propina: propinaPersona,
        total: totalPersona,
      };
    });
  });

  protected readonly itemsSinAsignar = computed(() => {
    if (this.modoDivision() !== 'consumo') return [];
    return this.carrito.lineas().filter((item) => !(this.asignaciones()[item.id]?.length));
  });

  protected readonly puedePagar = computed(() => {
    if (this.carrito.estaVacio()) return false;
    if (this.modoDivision() === 'consumo') {
      return this.itemsSinAsignar().length === 0;
    }
    return true;
  });

  protected readonly metodos: { id: MetodoPago; titulo: string; descripcion: string }[] = [
    { id: 'tarjeta', titulo: 'Tarjeta de crédito/débito', descripcion: 'Visa, Mastercard, Amex' },
    { id: 'nequi', titulo: 'Nequi', descripcion: 'Pago con tu cuenta Nequi' },
    { id: 'daviplata', titulo: 'Daviplata', descripcion: 'Pago con Daviplata' },
    { id: 'efectivo', titulo: 'Efectivo / Datáfono en mesa', descripcion: 'Paga en caja o con datáfono' },
  ];

  async pagar(): Promise<void> {
    if (this.carrito.estaVacio()) return;
    const pedido = await this.pedidos.crearPedido({
      items: this.carrito.lineas(),
      resumen: {
        subtotal: this.carrito.subtotal(),
        impuestos: this.carrito.impuestos(),
        propina: this.carrito.propina(),
        descuento: this.carrito.descuento(),
        total: this.carrito.total(),
      },
      mesa: { tipo: this.mesa.tipo(), numero: this.mesa.numero() },
      notasCocina: '',
    });
    this.carrito.limpiar();
    this.notificaciones.mostrar(`Pedido confirmado · ${pedido.numero}`);
    this.router.navigate(['/pedido']);
  }
}
