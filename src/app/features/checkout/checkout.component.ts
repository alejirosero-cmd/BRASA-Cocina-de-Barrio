import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideArrowLeft, LucideCreditCard, LucideFileText, LucideInfo, LucideMinus, LucidePlus, LucideSmartphone, LucideUsers } from '@lucide/angular';
import { ApiService, mensajeError } from '../../core/services/api.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { SolicitudesMeseroService } from '../../core/services/solicitudes-mesero.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

type MetodoPago = 'linea' | 'mesa';
type ModoDivision = 'total' | 'igual' | 'consumo';

/** Monto mínimo por pago en línea (coincide con el servidor). */
const MONTO_MINIMO = 1500;

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, PrecioCopPipe, LucideArrowLeft, LucideCreditCard, LucideSmartphone, LucideUsers, LucideFileText, LucideInfo, LucideMinus, LucidePlus],
  template: `
    <section class="mx-auto max-w-[1400px] px-5 py-10 md:px-10">
      <div class="mb-6">
        <a [routerLink]="['/pedido', id()]" class="inline-flex items-center gap-2 text-sm font-semibold text-brasa-muted transition hover:text-brasa-black">
          <svg lucideArrowLeft [size]="16"></svg>
          Volver al seguimiento
        </a>
        <h1 class="mt-3 font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">Pagar la cuenta</h1>
        <p class="mt-2 text-sm text-brasa-muted sm:text-base">
          Paga en línea con tarjeta, Nequi, PSE o Bancolombia, o pide pagar en la mesa. BRASA nunca ve ni guarda los datos de tu tarjeta.
        </p>
      </div>

      @if (cargando()) {
        <p class="py-16 text-center text-sm text-brasa-muted" role="status">Cargando la cuenta...</p>
      } @else if (!pedido()) {
        <div class="rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
          <p class="text-sm text-brasa-muted">{{ error() || 'No encontramos ese pedido.' }}</p>
          <a routerLink="/historial" class="mt-4 inline-block rounded-xl bg-brasa-orange px-6 py-3 text-sm font-semibold text-white">Mis pedidos</a>
        </div>
      } @else if (pedido()!.saldo <= 0) {
        <div class="rounded-2xl border border-green-200 bg-green-50 px-6 py-12 text-center">
          <h2 class="font-heading text-xl font-semibold text-green-800">¡Cuenta pagada!</h2>
          <p class="mt-2 text-sm text-green-700">El pedido {{ pedido()!.numero }} no tiene saldo pendiente.</p>
          <a [routerLink]="['/pedido', pedido()!.id]" class="mt-4 inline-block rounded-xl bg-brasa-orange px-6 py-3 text-sm font-semibold text-white">Ver mi pedido</a>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div class="flex flex-col gap-6 lg:col-span-7">
            <!-- Método -->
            <fieldset class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <legend class="sr-only">Método de pago</legend>
              <header class="border-b border-brasa-border px-6 py-4">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Método de pago</h2>
              </header>
              <div class="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
                @for (m of metodos; track m.id) {
                  <label class="flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition"
                    [class]="metodo() === m.id ? 'border-brasa-orange bg-brasa-orange/5' : 'border-brasa-border hover:border-brasa-muted'">
                    <input type="radio" name="metodo" class="mt-1 accent-brasa-orange" [checked]="metodo() === m.id" (change)="metodo.set(m.id)" />
                    <span>
                      <span class="flex items-center gap-2 font-semibold text-brasa-black">
                        @if (m.id === 'linea') { <svg lucideSmartphone [size]="16" class="text-brasa-orange"></svg> } @else { <svg lucideCreditCard [size]="16" class="text-brasa-orange"></svg> }
                        {{ m.titulo }}
                      </span>
                      <span class="mt-1 block text-xs text-brasa-muted">{{ m.descripcion }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (proveedor() === 'simulado' && metodo() === 'linea') {
                <p class="mx-6 mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Entorno de pruebas: la pasarela es un simulador y no se cobra dinero real.
                </p>
              }
            </fieldset>

            <!-- División -->
            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="flex items-center gap-2 border-b border-brasa-border px-6 py-4">
                <svg lucideUsers [size]="18" class="text-brasa-orange"></svg>
                <h2 class="font-heading text-base font-semibold text-brasa-black">¿Cuánto vas a pagar?</h2>
              </header>
              <div class="flex flex-col gap-4 p-6">
                <div class="flex flex-wrap gap-2" role="group" aria-label="Forma de dividir la cuenta">
                  @for (d of divisiones; track d.id) {
                    <button type="button" class="rounded-xl border px-4 py-2 text-sm font-semibold transition"
                      [class]="modo() === d.id ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black' : 'border-brasa-border text-brasa-muted hover:text-brasa-black'"
                      [attr.aria-pressed]="modo() === d.id" (click)="modo.set(d.id)">
                      {{ d.titulo }}
                    </button>
                  }
                </div>

                @if (modo() === 'igual') {
                  <div class="flex items-center gap-4">
                    <span class="text-sm text-brasa-muted">Personas</span>
                    <button type="button" class="rounded-lg border border-brasa-border p-2" aria-label="Menos personas" (click)="personas.set(Math.max(2, personas() - 1))"><svg lucideMinus [size]="16"></svg></button>
                    <span class="w-6 text-center font-semibold" aria-live="polite">{{ personas() }}</span>
                    <button type="button" class="rounded-lg border border-brasa-border p-2" aria-label="Más personas" (click)="personas.set(Math.min(10, personas() + 1))"><svg lucidePlus [size]="16"></svg></button>
                  </div>
                  <p class="text-xs text-brasa-muted">Cada persona paga {{ parteIgual() | precioCop }} desde su celular. Quien pague de último cubre el saldo restante.</p>
                }

                @if (modo() === 'consumo') {
                  <p class="text-sm text-brasa-muted">Marca lo que consumiste tú. Impuestos y propina se reparten en proporción.</p>
                  <ul class="flex flex-col gap-2">
                    @for (item of pedido()!.items; track item.id) {
                      <li>
                        <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-brasa-border px-4 py-3">
                          <span class="flex items-center gap-3">
                            <input type="checkbox" class="accent-brasa-orange" [checked]="seleccionados().has(item.id)" (change)="alternar(item.id)" />
                            <span class="text-sm font-medium text-brasa-black">{{ item.cantidad }} × {{ item.nombre }}</span>
                          </span>
                          <span class="text-sm font-semibold">{{ item.precioUnitario * item.cantidad | precioCop }}</span>
                        </label>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>

            <!-- Propina -->
            @if (pedido()!.pagado === 0) {
              <div class="rounded-2xl border border-brasa-border bg-white p-6 shadow-card">
                <h2 class="font-heading text-base font-semibold text-brasa-black">Propina voluntaria</h2>
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (p of propinas; track p) {
                    <button type="button" class="rounded-xl border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50"
                      [class]="pedido()!.propinaPorcentaje === p ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black' : 'border-brasa-border text-brasa-muted hover:text-brasa-black'"
                      [disabled]="procesando()" (click)="cambiarPropina(p)">
                      {{ p === 0 ? 'Sin propina' : p + '%' }}
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Factura electrónica -->
            <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
              <header class="flex items-center gap-2 border-b border-brasa-border px-6 py-4">
                <svg lucideFileText [size]="18" class="text-brasa-orange"></svg>
                <h2 class="font-heading text-base font-semibold text-brasa-black">Factura electrónica</h2>
              </header>
              <div class="flex flex-col gap-3 p-6">
                @if (pedido()!.facturaSolicitada || facturaGuardada()) {
                  <p class="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">Recibimos tus datos de facturación. La factura llegará a tu correo.</p>
                } @else {
                  <label class="flex items-center gap-3 text-sm">
                    <input type="checkbox" class="h-4 w-4 accent-brasa-orange" [checked]="solicitarFactura()" (change)="solicitarFactura.set($any($event.target).checked)" />
                    <span class="text-brasa-black">Solicitar factura electrónica</span>
                  </label>
                  @if (solicitarFactura()) {
                    <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" (ngSubmit)="guardarFactura()">
                      <label class="space-y-1 text-sm">
                        <span class="font-medium text-brasa-black">Tipo de documento</span>
                        <select name="tipo" class="w-full rounded-xl border border-brasa-border px-4 py-3" [(ngModel)]="factura.tipoDocumento" required>
                          <option value="CC">Cédula de ciudadanía</option>
                          <option value="NIT">NIT</option>
                          <option value="CE">Cédula de extranjería</option>
                          <option value="PP">Pasaporte</option>
                        </select>
                      </label>
                      <label class="space-y-1 text-sm">
                        <span class="font-medium text-brasa-black">Número</span>
                        <input name="numero" class="w-full rounded-xl border border-brasa-border px-4 py-3" [(ngModel)]="factura.numeroDocumento" required pattern="[0-9A-Za-z-]{5,20}" autocomplete="off" />
                      </label>
                      <label class="space-y-1 text-sm">
                        <span class="font-medium text-brasa-black">Nombre o razón social</span>
                        <input name="nombre" class="w-full rounded-xl border border-brasa-border px-4 py-3" [(ngModel)]="factura.nombre" required minlength="2" maxlength="120" autocomplete="name" />
                      </label>
                      <label class="space-y-1 text-sm">
                        <span class="font-medium text-brasa-black">Correo electrónico</span>
                        <input name="correo" type="email" class="w-full rounded-xl border border-brasa-border px-4 py-3" [(ngModel)]="factura.correo" required autocomplete="email" />
                      </label>
                      <label class="flex items-start gap-3 text-xs text-brasa-muted sm:col-span-2">
                        <input name="acepta" type="checkbox" class="mt-0.5 h-4 w-4 accent-brasa-orange" [(ngModel)]="factura.aceptaTratamientoDatos" required />
                        Autorizo a BRASA a tratar mis datos personales únicamente para emitir y enviar la factura electrónica, conforme a la Ley 1581 de 2012.
                      </label>
                      @if (errorFactura()) {
                        <p class="text-sm text-red-700 sm:col-span-2" role="alert">{{ errorFactura() }}</p>
                      }
                      <button type="submit" class="rounded-xl border border-brasa-orange px-4 py-2.5 text-sm font-semibold text-brasa-orange sm:col-span-2" [disabled]="procesando()">Guardar datos de facturación</button>
                    </form>
                  }
                }
              </div>
            </div>
          </div>

          <!-- Resumen -->
          <div class="lg:col-span-5">
            <div class="flex flex-col gap-6 lg:sticky lg:top-24">
              <div class="rounded-2xl border border-brasa-border bg-white shadow-card">
                <header class="border-b border-brasa-border px-6 py-4">
                  <h2 class="font-heading text-base font-semibold text-brasa-black">Pedido {{ pedido()!.numero }}</h2>
                </header>
                <dl class="flex flex-col gap-2 px-6 py-5 text-sm">
                  <div class="flex justify-between"><dt class="text-brasa-muted">Subtotal</dt><dd>{{ pedido()!.resumen.subtotal | precioCop }}</dd></div>
                  @if (pedido()!.resumen.descuento) {
                    <div class="flex justify-between"><dt class="text-brasa-muted">Descuento</dt><dd class="text-green-600">−{{ pedido()!.resumen.descuento | precioCop }}</dd></div>
                  }
                  <div class="flex justify-between"><dt class="text-brasa-muted">Impuestos</dt><dd>{{ pedido()!.resumen.impuestos | precioCop }}</dd></div>
                  <div class="flex justify-between"><dt class="text-brasa-muted">Propina ({{ pedido()!.propinaPorcentaje }}%)</dt><dd>{{ pedido()!.resumen.propina | precioCop }}</dd></div>
                  <div class="flex justify-between border-t border-brasa-border pt-2 font-semibold"><dt>Total</dt><dd>{{ pedido()!.resumen.total | precioCop }}</dd></div>
                  @if (pedido()!.pagado > 0) {
                    <div class="flex justify-between text-green-700"><dt>Ya pagado</dt><dd>{{ pedido()!.pagado | precioCop }}</dd></div>
                  }
                  <div class="flex justify-between"><dt class="text-brasa-muted">Saldo pendiente</dt><dd class="font-semibold">{{ pedido()!.saldo | precioCop }}</dd></div>
                  <div class="mt-2 flex items-center justify-between border-t border-brasa-border pt-4">
                    <dt class="font-heading text-base font-semibold">Vas a pagar</dt>
                    <dd class="font-heading text-2xl font-bold text-brasa-orange" aria-live="polite">{{ montoAPagar() | precioCop }}</dd>
                  </div>
                </dl>
              </div>

              @if (error()) {
                <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ error() }}</p>
              }

              <button type="button"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="!puedePagar() || procesando()" (click)="pagar()">
                <svg lucideCreditCard [size]="18"></svg>
                {{ procesando() ? 'Procesando...' : metodo() === 'linea' ? 'Ir a pagar ' : 'Pedir la cuenta al mesero' }}
                @if (metodo() === 'linea' && !procesando()) { {{ montoAPagar() | precioCop }} }
              </button>

              <div class="flex items-start gap-3 rounded-2xl border border-brasa-border bg-white px-5 py-4 text-xs text-brasa-muted">
                <svg lucideInfo [size]="16" class="mt-0.5 shrink-0 text-brasa-orange"></svg>
                @if (motivoNoPago()) {
                  {{ motivoNoPago() }}
                } @else if (metodo() === 'linea') {
                  Serás redirigido a la pasarela segura de Wompi. El pago se confirma cuando Wompi nos notifica, no antes.
                } @else {
                  Un mesero llevará el datáfono o recibirá el efectivo en tu mesa.
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
  private readonly api = inject(ApiService);
  private readonly pedidos = inject(PedidosService);
  private readonly solicitudes = inject(SolicitudesMeseroService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly id = input.required<string>();

  protected readonly pedido = this.pedidos.pedido;
  protected readonly cargando = signal(true);
  protected readonly procesando = signal(false);
  protected readonly error = signal('');
  protected readonly proveedor = signal<'wompi' | 'simulado' | null>(null);
  protected readonly metodo = signal<MetodoPago>('linea');
  protected readonly modo = signal<ModoDivision>('total');
  protected readonly personas = signal(2);
  protected readonly seleccionados = signal<Set<string>>(new Set());
  protected readonly solicitarFactura = signal(false);
  protected readonly facturaGuardada = signal(false);
  protected readonly errorFactura = signal('');
  protected readonly Math = Math;
  protected factura = { tipoDocumento: 'CC', numeroDocumento: '', nombre: '', correo: '', aceptaTratamientoDatos: false };

  protected readonly metodos: { id: MetodoPago; titulo: string; descripcion: string }[] = [
    { id: 'linea', titulo: 'Pagar en línea', descripcion: 'Tarjeta, Nequi, PSE o Bancolombia a través de Wompi' },
    { id: 'mesa', titulo: 'Efectivo o datáfono', descripcion: 'El mesero te cobra en la mesa' },
  ];
  protected readonly divisiones: { id: ModoDivision; titulo: string }[] = [
    { id: 'total', titulo: 'Todo el saldo' },
    { id: 'igual', titulo: 'Partes iguales' },
    { id: 'consumo', titulo: 'Por lo que consumí' },
  ];
  protected readonly propinas = [0, 5, 10, 15];

  protected readonly parteIgual = computed(() => {
    const p = this.pedido();
    return p ? Math.ceil(p.resumen.total / this.personas()) : 0;
  });

  protected readonly montoAPagar = computed(() => {
    const p = this.pedido();
    if (!p) return 0;
    let monto = p.saldo;
    if (this.modo() === 'igual') monto = this.parteIgual();
    if (this.modo() === 'consumo') {
      const mio = p.items.filter((i) => this.seleccionados().has(i.id)).reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
      monto = p.resumen.subtotal ? Math.round((mio / p.resumen.subtotal) * p.resumen.total) : 0;
    }
    // Si lo que queda después de este pago es menor al mínimo, se cobra todo el saldo.
    if (p.saldo - monto < MONTO_MINIMO) monto = p.saldo;
    return Math.min(monto, p.saldo);
  });

  protected readonly motivoNoPago = computed(() => {
    if (this.metodo() !== 'linea') return '';
    const monto = this.montoAPagar();
    if (this.modo() === 'consumo' && monto === 0) return 'Selecciona lo que consumiste para calcular tu parte.';
    if (monto < Math.min(MONTO_MINIMO, this.pedido()?.saldo ?? 0)) return `El pago mínimo en línea es de $${MONTO_MINIMO.toLocaleString('es-CO')}.`;
    return '';
  });

  protected readonly puedePagar = computed(() => !!this.pedido() && this.pedido()!.estado !== 'CANCELADO' && !this.motivoNoPago());

  constructor() {
    firstValueFrom(this.api.get<{ proveedor: 'wompi' | 'simulado' }>('/pagos/proveedor'))
      .then((r) => this.proveedor.set(r.proveedor))
      .catch(() => undefined);
    effect(() => {
      const id = this.id();
      this.cargando.set(true);
      this.pedidos
        .cargar(id)
        .catch((e) => this.error.set(mensajeError(e, 'No encontramos ese pedido en este dispositivo.')))
        .finally(() => this.cargando.set(false));
    });
  }

  protected alternar(itemId: string): void {
    this.seleccionados.update((s) => {
      const copia = new Set(s);
      if (copia.has(itemId)) copia.delete(itemId);
      else copia.add(itemId);
      return copia;
    });
  }

  protected async cambiarPropina(porcentaje: number): Promise<void> {
    this.procesando.set(true);
    try {
      await this.pedidos.cambiarPropina(this.id(), porcentaje);
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e), 'error');
    } finally {
      this.procesando.set(false);
    }
  }

  protected async guardarFactura(): Promise<void> {
    this.errorFactura.set('');
    if (!this.factura.aceptaTratamientoDatos) {
      this.errorFactura.set('Debes autorizar el tratamiento de datos para emitir la factura.');
      return;
    }
    this.procesando.set(true);
    try {
      await this.pedidos.guardarFactura(this.id(), this.factura);
      this.facturaGuardada.set(true);
    } catch (e) {
      this.errorFactura.set(mensajeError(e));
    } finally {
      this.procesando.set(false);
    }
  }

  protected async pagar(): Promise<void> {
    if (!this.puedePagar() || this.procesando()) return;
    this.procesando.set(true);
    this.error.set('');
    try {
      if (this.metodo() === 'mesa') {
        await this.solicitudes.enviar('cuenta');
        this.notificaciones.mostrar('Un mesero irá a tu mesa para cobrarte');
        return;
      }
      const r = await firstValueFrom(
        this.api.post<{ urlCheckout: string }>('/pagos', { pedidoId: this.id(), monto: this.montoAPagar() }, this.pedidos.cabeceras(this.id())),
      );
      // Solo se redirige a la pasarela de Wompi o al simulador del propio sitio.
      const destino = new URL(r.urlCheckout);
      if (destino.origin !== 'https://checkout.wompi.co' && destino.origin !== location.origin) {
        throw new Error('Destino de pago no permitido');
      }
      location.assign(destino.toString());
    } catch (e) {
      this.error.set(mensajeError(e, 'No se pudo iniciar el pago.'));
    } finally {
      this.procesando.set(false);
    }
  }
}
