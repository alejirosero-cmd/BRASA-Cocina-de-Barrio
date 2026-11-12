/**
 * Secciones del panel de administración. Cada acción llama a la API, que vuelve a validar
 * el rol ADMIN; ocultar o mostrar botones aquí es solo comodidad de interfaz.
 */
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { ApiService, mensajeError } from '../../core/services/api.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ETIQUETA_ESTADO, ETIQUETA_ESTADO_PAGO, EstadoPedido, Pedido } from '../../models/pedido.model';
import { Producto } from '../../models/producto.model';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

const TARJETA = 'rounded-2xl border border-brasa-border bg-white shadow-card';
const CAMPO = 'w-full rounded-xl border border-brasa-border px-3 py-2 text-sm outline-none focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30';
const BOTON = 'rounded-xl bg-brasa-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark disabled:opacity-50';
const BOTON_SEC = 'rounded-xl border border-brasa-border px-3 py-1.5 text-sm font-semibold transition hover:bg-brasa-gray-light disabled:opacity-50';

/** Utilidad común: ejecuta una acción mostrando el error si falla. */
abstract class SeccionAdmin {
  protected readonly api = inject(ApiService);
  protected readonly notificaciones = inject(NotificacionesService);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly ocupado = signal(false);

  protected async ejecutar<T>(fn: () => Promise<T>, exito?: string): Promise<T | undefined> {
    this.ocupado.set(true);
    try {
      const r = await fn();
      if (exito) this.notificaciones.mostrar(exito);
      return r;
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e), 'error');
      return undefined;
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async cargar(fn: () => Promise<void>): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      await fn();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}

// ------------------------------------------------------------------ Resumen / reportes
interface Reporte {
  ventasTotales: number;
  pagosAprobados: number;
  pedidosPorEstado: Record<string, number>;
  pedidosEntregados: number;
  ticketPromedio: number;
  masVendidos: { nombre: string; cantidad: number }[];
  calificacionPromedio: number | null;
  calificaciones: number;
  ventasPorDia: { dia: string; total: number }[];
}

@Component({
  selector: 'app-admin-resumen',
  imports: [FormsModule, PrecioCopPipe, DatePipe],
  template: `
    <form class="mb-6 flex flex-wrap items-end gap-3" (ngSubmit)="actualizar()">
      <label class="text-sm"><span class="mb-1 block font-medium">Desde</span><input type="date" name="desde" class="${CAMPO}" [(ngModel)]="desde" /></label>
      <label class="text-sm"><span class="mb-1 block font-medium">Hasta</span><input type="date" name="hasta" class="${CAMPO}" [(ngModel)]="hasta" /></label>
      <button class="${BOTON}" type="submit">Actualizar</button>
    </form>
    @if (cargando()) { <p class="text-sm text-brasa-muted" role="status">Calculando...</p> }
    @else if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
    @else if (r()) {
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        @for (k of kpis(); track k.titulo) {
          <div class="${TARJETA} p-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-brasa-muted">{{ k.titulo }}</p>
            <p class="mt-2 font-heading text-2xl font-bold text-brasa-black">{{ k.valor }}</p>
          </div>
        }
      </div>
      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="${TARJETA} p-5">
          <h2 class="font-heading text-base font-semibold">Ventas cobradas por día</h2>
          @if (r()!.ventasPorDia.length === 0) { <p class="mt-3 text-sm text-brasa-muted">Sin ventas en el período.</p> }
          <ul class="mt-4 flex flex-col gap-2">
            @for (d of r()!.ventasPorDia; track d.dia) {
              <li class="flex items-center gap-3 text-sm">
                <span class="w-24 shrink-0 text-brasa-muted">{{ d.dia | date: 'd MMM' }}</span>
                <span class="h-3 rounded-full bg-brasa-orange" [style.width.%]="(d.total / maxDia()) * 70" aria-hidden="true"></span>
                <span class="font-semibold">{{ d.total | precioCop }}</span>
              </li>
            }
          </ul>
        </section>
        <section class="${TARJETA} p-5">
          <h2 class="font-heading text-base font-semibold">Más vendidos</h2>
          <ol class="mt-4 flex flex-col gap-2 text-sm">
            @for (m of r()!.masVendidos; track m.nombre; let i = $index) {
              <li class="flex justify-between"><span>{{ i + 1 }}. {{ m.nombre }}</span><span class="font-semibold">{{ m.cantidad }} u.</span></li>
            } @empty { <li class="text-brasa-muted">Sin datos.</li> }
          </ol>
          <h2 class="mt-6 font-heading text-base font-semibold">Pedidos por estado</h2>
          <ul class="mt-3 flex flex-wrap gap-2 text-sm">
            @for (e of estados(); track e[0]) {
              <li class="rounded-full bg-brasa-gray-light px-3 py-1">{{ etiqueta(e[0]) }}: <strong>{{ e[1] }}</strong></li>
            }
          </ul>
        </section>
      </div>
    }
  `,
})
export class AdminResumenComponent extends SeccionAdmin implements OnInit {
  protected desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  protected hasta = new Date().toISOString().slice(0, 10);
  protected readonly r = signal<Reporte | null>(null);
  private readonly cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  protected readonly kpis = computed(() => {
    const r = this.r();
    if (!r) return [];
    return [
      { titulo: 'Ventas cobradas', valor: this.cop.format(r.ventasTotales) },
      { titulo: 'Pedidos entregados', valor: String(r.pedidosEntregados) },
      { titulo: 'Ticket promedio', valor: this.cop.format(r.ticketPromedio) },
      { titulo: 'Calificación', valor: r.calificacionPromedio ? `${r.calificacionPromedio} ★ (${r.calificaciones})` : 'Sin datos' },
    ];
  });
  protected readonly maxDia = computed(() => Math.max(1, ...(this.r()?.ventasPorDia.map((d) => d.total) ?? [1])));
  protected readonly estados = computed(() => Object.entries(this.r()?.pedidosPorEstado ?? {}));

  ngOnInit(): void {
    this.actualizar();
  }

  protected etiqueta(e: string): string {
    return ETIQUETA_ESTADO[e as EstadoPedido] ?? e;
  }

  protected actualizar(): Promise<void> {
    return this.cargar(async () => {
      const hasta = new Date(`${this.hasta}T23:59:59`);
      const desde = new Date(`${this.desde}T00:00:00`);
      this.r.set(await firstValueFrom(this.api.get<Reporte>('/reportes/resumen', { desde: desde.toISOString(), hasta: hasta.toISOString() })));
    });
  }
}

// ------------------------------------------------------------------ Pedidos
@Component({
  selector: 'app-admin-pedidos',
  imports: [FormsModule, PrecioCopPipe, DatePipe],
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <label class="text-sm"><span class="mb-1 block font-medium">Estado</span>
        <select class="${CAMPO}" [(ngModel)]="estado" (ngModelChange)="pagina = 1; recargar()">
          <option value="">Todos</option>
          @for (e of listaEstados; track e) { <option [value]="e">{{ etiquetas[e] }}</option> }
        </select>
      </label>
      <span class="text-sm text-brasa-muted">{{ total() }} pedidos</span>
    </div>
    @if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
    <div class="${TARJETA} overflow-x-auto">
      <table class="w-full min-w-[760px] text-left text-sm">
        <thead class="border-b border-brasa-border text-xs uppercase text-brasa-muted">
          <tr><th class="px-4 py-3">Pedido</th><th class="px-4 py-3">Fecha</th><th class="px-4 py-3">Ubicación</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Pago</th><th class="px-4 py-3 text-right">Total</th><th class="px-4 py-3"></th></tr>
        </thead>
        <tbody>
          @for (p of pedidos(); track p.id) {
            <tr class="border-b border-brasa-border last:border-0">
              <td class="px-4 py-3 font-semibold">{{ p.numero }}</td>
              <td class="px-4 py-3">{{ p.creadoEn | date: 'd MMM, h:mm a' }}</td>
              <td class="px-4 py-3">{{ p.mesa.tipo === 'llevar' ? 'Para llevar' : 'Mesa ' + p.mesa.numero }}</td>
              <td class="px-4 py-3">{{ etiquetas[p.estado] }}</td>
              <td class="px-4 py-3">{{ etiquetasPago[p.estadoPago] }}</td>
              <td class="px-4 py-3 text-right font-semibold">{{ p.resumen.total | precioCop }}</td>
              <td class="px-4 py-3 text-right">
                @if (p.facturaSolicitada) { <button type="button" class="${BOTON_SEC}" (click)="verFactura(p)">Factura</button> }
                @if (p.estado === 'PENDIENTE' || p.estado === 'CONFIRMADO') { <button type="button" class="${BOTON_SEC} ml-1 text-red-600" [disabled]="ocupado()" (click)="cancelar(p)">Cancelar</button> }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="px-4 py-8 text-center text-brasa-muted">{{ cargando() ? 'Cargando...' : 'Sin pedidos' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex gap-2">
      <button type="button" class="${BOTON_SEC}" [disabled]="pagina === 1" (click)="pagina = pagina - 1; recargar()">Anterior</button>
      <button type="button" class="${BOTON_SEC}" [disabled]="pagina * 50 >= total()" (click)="pagina = pagina + 1; recargar()">Siguiente</button>
    </div>
    @if (factura()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Datos de facturación">
        <div class="${TARJETA} w-full max-w-md p-6">
          <h2 class="font-heading text-lg font-semibold">Datos de facturación</h2>
          <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-brasa-muted">Documento</dt><dd>{{ factura()!['tipoDocumento'] }} {{ factura()!['numeroDocumento'] }}</dd>
            <dt class="text-brasa-muted">Nombre</dt><dd>{{ factura()!['nombre'] }}</dd>
            <dt class="text-brasa-muted">Correo</dt><dd>{{ factura()!['correo'] }}</dd>
            <dt class="text-brasa-muted">Autorización</dt><dd>{{ factura()!['autorizacionDatosEn'] | date: 'medium' }}</dd>
          </dl>
          <p class="mt-4 text-xs text-brasa-muted">Emite la factura en el software de facturación electrónica autorizado por la DIAN. Datos personales: no los copies fuera de ese sistema.</p>
          <button type="button" class="${BOTON} mt-6 w-full" (click)="factura.set(null)">Cerrar</button>
        </div>
      </div>
    }
  `,
})
export class AdminPedidosComponent extends SeccionAdmin implements OnInit {
  protected estado = '';
  protected pagina = 1;
  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly total = signal(0);
  protected readonly factura = signal<Record<string, string> | null>(null);
  protected readonly etiquetas = ETIQUETA_ESTADO;
  protected readonly etiquetasPago = ETIQUETA_ESTADO_PAGO;
  protected readonly listaEstados = Object.keys(ETIQUETA_ESTADO) as EstadoPedido[];

  ngOnInit(): void {
    this.recargar();
  }

  protected recargar(): Promise<void> {
    return this.cargar(async () => {
      const r = await firstValueFrom(
        this.api.get<{ total: number; pedidos: Pedido[] }>('/pedidos', { pagina: this.pagina, ...(this.estado ? { estado: this.estado } : {}) }),
      );
      this.pedidos.set(r.pedidos);
      this.total.set(r.total);
    });
  }

  protected async verFactura(p: Pedido): Promise<void> {
    const datos = await this.ejecutar(() => firstValueFrom(this.api.get<Record<string, string>>(`/pedidos/${p.id}/factura`)));
    if (datos) this.factura.set(datos);
  }

  protected async cancelar(p: Pedido): Promise<void> {
    const motivo = prompt(`Motivo de la cancelación de ${p.numero}:`);
    if (motivo === null) return;
    const ok = await this.ejecutar(
      () => firstValueFrom(this.api.patch(`/pedidos/${p.id}/estado`, { estado: 'CANCELADO', nota: motivo.slice(0, 200) })),
      'Pedido cancelado. Si tenía pagos, quedaron pendientes de reembolso.',
    );
    if (ok) this.recargar();
  }
}

// ------------------------------------------------------------------ Pagos
interface PagoAdmin {
  id: string;
  pedidoNumero: string;
  proveedor: string;
  referencia: string;
  monto: number;
  estado: string;
  metodo: string | null;
  creadoEn: string;
}

@Component({
  selector: 'app-admin-pagos',
  imports: [PrecioCopPipe, DatePipe],
  template: `
    @if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
    <div class="${TARJETA} overflow-x-auto">
      <table class="w-full min-w-[820px] text-left text-sm">
        <thead class="border-b border-brasa-border text-xs uppercase text-brasa-muted">
          <tr><th class="px-4 py-3">Fecha</th><th class="px-4 py-3">Pedido</th><th class="px-4 py-3">Proveedor</th><th class="px-4 py-3">Referencia</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3 text-right">Monto</th><th class="px-4 py-3"></th></tr>
        </thead>
        <tbody>
          @for (p of pagos(); track p.id) {
            <tr class="border-b border-brasa-border last:border-0">
              <td class="px-4 py-3">{{ p.creadoEn | date: 'd MMM, h:mm a' }}</td>
              <td class="px-4 py-3 font-semibold">{{ p.pedidoNumero }}</td>
              <td class="px-4 py-3">{{ p.proveedor }}{{ p.metodo ? ' · ' + p.metodo : '' }}</td>
              <td class="px-4 py-3 font-mono text-xs">{{ p.referencia }}</td>
              <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="clase(p.estado)">{{ p.estado }}</span></td>
              <td class="px-4 py-3 text-right font-semibold">{{ p.monto | precioCop }}</td>
              <td class="px-4 py-3 text-right">
                @if (p.estado === 'APROBADO') { <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="accion(p, 'reembolso', '¿Marcar este pago para reembolso?')">Reembolsar</button> }
                @if (p.estado === 'REEMBOLSO_SOLICITADO') { <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="accion(p, 'reembolsado', '¿Confirmas que ya devolviste el dinero en el panel del proveedor?')">Confirmar reembolso</button> }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="px-4 py-8 text-center text-brasa-muted">{{ cargando() ? 'Cargando...' : 'Sin pagos' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-brasa-muted">Los reembolsos con tarjeta o Nequi se ejecutan en el panel de Wompi; aquí se registra el seguimiento.</p>
  `,
})
export class AdminPagosComponent extends SeccionAdmin implements OnInit {
  protected readonly pagos = signal<PagoAdmin[]>([]);

  ngOnInit(): void {
    this.recargar();
  }

  protected recargar(): Promise<void> {
    return this.cargar(async () => {
      this.pagos.set((await firstValueFrom(this.api.get<{ pagos: PagoAdmin[] }>('/pagos'))).pagos);
    });
  }

  protected clase(estado: string): string {
    if (estado === 'APROBADO') return 'bg-green-50 text-green-700';
    if (estado === 'PENDIENTE') return 'bg-amber-50 text-amber-700';
    if (estado.startsWith('REEMBOLSO')) return 'bg-blue-50 text-blue-700';
    return 'bg-red-50 text-red-700';
  }

  protected async accion(p: PagoAdmin, ruta: 'reembolso' | 'reembolsado', pregunta: string): Promise<void> {
    if (!confirm(pregunta)) return;
    if (await this.ejecutar(() => firstValueFrom(this.api.patch(`/pagos/${p.id}/${ruta}`, {})), 'Pago actualizado')) this.recargar();
  }
}

// ------------------------------------------------------------------ Menú: productos y categorías
interface CategoriaAdmin { id: string; nombre: string; orden: number; activa: boolean }
type ProductoAdmin = Producto & { disponible: boolean };

const PRODUCTO_VACIO = {
  id: '', nombre: '', descripcion: '', precio: 0, categoria: '', imagenUrl: 'img/brasa-original.jpg',
  etiquetas: [] as string[], ingredientes: [] as string[], tamanos: [] as unknown[], extras: [] as unknown[],
  salsas: [] as unknown[], retirables: [] as unknown[], tiempoPreparacionMin: 15, disponible: true,
};

@Component({
  selector: 'app-admin-productos',
  imports: [FormsModule, PrecioCopPipe],
  template: `
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-heading text-lg font-semibold">Productos</h2>
          <button type="button" class="${BOTON}" (click)="nuevo()">Nuevo producto</button>
        </div>
        @if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
        <div class="${TARJETA} divide-y divide-brasa-border">
          @for (p of productos(); track p.id) {
            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div class="flex items-center gap-3">
                <img [src]="p.imagenUrl" alt="" width="40" height="40" class="h-10 w-10 rounded-lg border border-brasa-border object-cover" />
                <div>
                  <p class="font-semibold" [class.text-brasa-muted]="!p.disponible">{{ p.nombre }} @if (!p.disponible) { <span class="text-xs font-normal">(agotado)</span> }</p>
                  <p class="text-xs text-brasa-muted">{{ p.categoria }} · {{ p.precio | precioCop }}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="alternar(p)">{{ p.disponible ? 'Marcar agotado' : 'Disponible' }}</button>
                <button type="button" class="${BOTON_SEC}" (click)="editar(p)">Editar</button>
              </div>
            </div>
          } @empty { <p class="px-4 py-8 text-center text-sm text-brasa-muted">{{ cargando() ? 'Cargando...' : 'Sin productos' }}</p> }
        </div>

        <h2 class="mb-3 mt-8 font-heading text-lg font-semibold">Categorías</h2>
        <div class="${TARJETA} divide-y divide-brasa-border">
          @for (c of categorias(); track c.id) {
            <div class="flex items-center justify-between px-4 py-3 text-sm">
              <span>{{ c.orden }}. <strong>{{ c.nombre }}</strong> <span class="text-brasa-muted">({{ c.id }})</span></span>
              <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="alternarCategoria(c)">{{ c.activa ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
          }
          <form class="flex flex-wrap items-end gap-2 px-4 py-3" (ngSubmit)="crearCategoria()">
            <input class="${CAMPO} w-32" name="cid" placeholder="id (slug)" [(ngModel)]="nuevaCategoria.id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            <input class="${CAMPO} w-40" name="cnombre" placeholder="Nombre" [(ngModel)]="nuevaCategoria.nombre" required />
            <input class="${CAMPO} w-20" name="corden" type="number" min="0" [(ngModel)]="nuevaCategoria.orden" />
            <button class="${BOTON}" type="submit" [disabled]="ocupado()">Agregar</button>
          </form>
        </div>
      </section>

      @if (form()) {
        <form class="${TARJETA} h-fit p-5 xl:sticky xl:top-24" (ngSubmit)="guardar()" #f="ngForm">
          <h2 class="font-heading text-lg font-semibold">{{ editando() ? 'Editar producto' : 'Nuevo producto' }}</h2>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <label class="col-span-2">Nombre<input class="${CAMPO}" name="nombre" required minlength="2" maxlength="80" [(ngModel)]="form()!.nombre" /></label>
            <label>Identificador<input class="${CAMPO}" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" [(ngModel)]="form()!.id" /></label>
            <label>Categoría
              <select class="${CAMPO}" name="categoria" required [(ngModel)]="form()!.categoria">
                @for (c of categorias(); track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
              </select>
            </label>
            <label>Precio (COP)<input class="${CAMPO}" type="number" name="precio" min="0" required [(ngModel)]="form()!.precio" /></label>
            <label>Preparación (min)<input class="${CAMPO}" type="number" name="tiempo" min="1" max="240" required [(ngModel)]="form()!.tiempoPreparacionMin" /></label>
            <label class="col-span-2">Descripción<textarea class="${CAMPO}" name="descripcion" rows="2" maxlength="400" [(ngModel)]="form()!.descripcion"></textarea></label>
            <label class="col-span-2">Imagen (img/... o https://...)<input class="${CAMPO}" name="imagen" required [(ngModel)]="form()!.imagenUrl" /></label>
            <label class="col-span-2">Ingredientes (separados por coma)<input class="${CAMPO}" name="ingredientes" [(ngModel)]="ingredientesTexto" /></label>
            <fieldset class="col-span-2 flex flex-wrap gap-3">
              <legend class="mb-1">Etiquetas</legend>
              @for (e of etiquetasDisponibles; track e) {
                <label class="flex items-center gap-1"><input type="checkbox" [checked]="form()!.etiquetas.includes(e)" (change)="alternarEtiqueta(e)" /> {{ e }}</label>
              }
            </fieldset>
            <label class="col-span-2">Opciones avanzadas (JSON: tamanos, extras, salsas, retirables)
              <textarea class="${CAMPO} font-mono text-xs" name="opciones" rows="6" [(ngModel)]="opcionesTexto"></textarea>
            </label>
          </div>
          @if (errorForm()) { <p class="mt-3 text-sm text-red-700" role="alert">{{ errorForm() }}</p> }
          <div class="mt-4 flex gap-2">
            <button type="button" class="${BOTON_SEC} flex-1" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="${BOTON} flex-1" [disabled]="ocupado() || f.invalid">Guardar</button>
          </div>
        </form>
      }
    </div>
  `,
})
export class AdminProductosComponent extends SeccionAdmin implements OnInit {
  protected readonly productos = signal<ProductoAdmin[]>([]);
  protected readonly categorias = signal<CategoriaAdmin[]>([]);
  protected readonly form = signal<typeof PRODUCTO_VACIO | null>(null);
  protected readonly editando = signal<string | null>(null);
  protected readonly errorForm = signal('');
  protected readonly etiquetasDisponibles = ['vegetariano', 'sin-gluten', 'mas-vendido', 'picante', 'para-compartir'];
  protected ingredientesTexto = '';
  protected opcionesTexto = '';
  protected nuevaCategoria = { id: '', nombre: '', orden: 10 };

  ngOnInit(): void {
    this.recargar();
  }

  protected recargar(): Promise<void> {
    return this.cargar(async () => {
      const [p, c] = await Promise.all([
        firstValueFrom(this.api.get<ProductoAdmin[]>('/productos/admin/todos')),
        firstValueFrom(this.api.get<CategoriaAdmin[]>('/productos/admin/categorias')),
      ]);
      this.productos.set(p);
      this.categorias.set(c);
    });
  }

  protected nuevo(): void {
    this.abrir({ ...PRODUCTO_VACIO, categoria: this.categorias()[0]?.id ?? '' }, null);
  }

  protected editar(p: ProductoAdmin): void {
    this.abrir(structuredClone({ ...PRODUCTO_VACIO, ...p }) as typeof PRODUCTO_VACIO, p.id);
  }

  private abrir(datos: typeof PRODUCTO_VACIO, id: string | null): void {
    this.form.set(datos);
    this.editando.set(id);
    this.errorForm.set('');
    this.ingredientesTexto = datos.ingredientes.join(', ');
    this.opcionesTexto = JSON.stringify({ tamanos: datos.tamanos, extras: datos.extras, salsas: datos.salsas, retirables: datos.retirables }, null, 2);
  }

  protected alternarEtiqueta(e: string): void {
    const f = this.form();
    if (!f) return;
    f.etiquetas = f.etiquetas.includes(e) ? f.etiquetas.filter((x) => x !== e) : [...f.etiquetas, e];
  }

  protected async guardar(): Promise<void> {
    const f = this.form();
    if (!f) return;
    let opciones: Record<string, unknown[]>;
    try {
      opciones = JSON.parse(this.opcionesTexto || '{}');
    } catch {
      this.errorForm.set('Las opciones avanzadas no son un JSON válido.');
      return;
    }
    const cuerpo = {
      id: f.id, nombre: f.nombre, descripcion: f.descripcion, precio: Number(f.precio), categoria: f.categoria,
      imagenUrl: f.imagenUrl, etiquetas: f.etiquetas, tiempoPreparacionMin: Number(f.tiempoPreparacionMin), disponible: f.disponible,
      ingredientes: this.ingredientesTexto.split(',').map((x) => x.trim()).filter(Boolean),
      tamanos: opciones['tamanos'] ?? [], extras: opciones['extras'] ?? [], salsas: opciones['salsas'] ?? [], retirables: opciones['retirables'] ?? [],
    };
    const id = this.editando();
    this.ocupado.set(true);
    try {
      await firstValueFrom(id ? this.api.put(`/productos/${id}`, cuerpo) : this.api.post('/productos', cuerpo));
      this.notificaciones.mostrar('Producto guardado');
      this.form.set(null);
      this.recargar();
    } catch (e) {
      this.errorForm.set(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async alternar(p: ProductoAdmin): Promise<void> {
    if (await this.ejecutar(() => firstValueFrom(this.api.patch(`/productos/${p.id}/disponibilidad`, { disponible: !p.disponible })))) this.recargar();
  }

  protected async alternarCategoria(c: CategoriaAdmin): Promise<void> {
    if (await this.ejecutar(() => firstValueFrom(this.api.put(`/productos/categorias/${c.id}`, { ...c, activa: !c.activa })))) this.recargar();
  }

  protected async crearCategoria(): Promise<void> {
    const ok = await this.ejecutar(
      () => firstValueFrom(this.api.post('/productos/categorias', { ...this.nuevaCategoria, orden: Number(this.nuevaCategoria.orden) })),
      'Categoría creada',
    );
    if (ok) {
      this.nuevaCategoria = { id: '', nombre: '', orden: 10 };
      this.recargar();
    }
  }
}

// ------------------------------------------------------------------ Mesas y QR
interface MesaAdmin { id: string; numero: number; codigo: string; activa: boolean; url: string }

@Component({
  selector: 'app-admin-mesas',
  imports: [FormsModule],
  template: `
    <form class="mb-6 flex items-end gap-3" (ngSubmit)="crear()">
      <label class="text-sm"><span class="mb-1 block font-medium">Número de la nueva mesa</span><input type="number" min="1" max="999" name="numero" class="${CAMPO} w-32" [(ngModel)]="numero" required /></label>
      <button class="${BOTON}" type="submit" [disabled]="ocupado()">Agregar mesa</button>
      <button class="${BOTON_SEC}" type="button" (click)="imprimir()">Imprimir QR</button>
    </form>
    @if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 print:grid-cols-3">
      @for (m of mesas(); track m.id) {
        <div class="${TARJETA} flex flex-col items-center p-4 text-center" [class.opacity-50]="!m.activa">
          <p class="font-heading text-lg font-bold">Mesa {{ m.numero }}</p>
          @if (qrs()[m.id]) { <img [src]="qrs()[m.id]" [alt]="'Código QR de la mesa ' + m.numero" class="my-2 h-36 w-36" /> }
          <p class="font-mono text-sm tracking-widest">{{ m.codigo }}</p>
          <div class="mt-3 flex flex-wrap justify-center gap-1 print:hidden">
            <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="alternar(m)">{{ m.activa ? 'Desactivar' : 'Activar' }}</button>
            <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="regenerar(m)">Nuevo QR</button>
          </div>
        </div>
      } @empty { <p class="text-sm text-brasa-muted">{{ cargando() ? 'Cargando...' : 'Sin mesas' }}</p> }
    </div>
  `,
})
export class AdminMesasComponent extends SeccionAdmin implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  protected numero: number | null = null;
  protected readonly mesas = signal<MesaAdmin[]>([]);
  protected readonly qrs = signal<Record<string, SafeUrl>>({});

  ngOnInit(): void {
    this.recargar();
  }

  protected recargar(): Promise<void> {
    return this.cargar(async () => {
      const mesas = await firstValueFrom(this.api.get<MesaAdmin[]>('/mesas'));
      this.mesas.set(mesas);
      const entradas = await Promise.all(
        mesas.map(async (m) => {
          const svg = await this.api.texto(`/mesas/${m.id}/qr.svg`);
          // El SVG lo genera nuestro servidor con la librería qrcode; se muestra como imagen (no se inyecta en el DOM).
          return [m.id, this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(svg)}`)] as const;
        }),
      );
      this.qrs.set(Object.fromEntries(entradas));
    });
  }

  protected async crear(): Promise<void> {
    if (!this.numero) return;
    if (await this.ejecutar(() => firstValueFrom(this.api.post('/mesas', { numero: Number(this.numero) })), 'Mesa creada')) {
      this.numero = null;
      this.recargar();
    }
  }

  protected async alternar(m: MesaAdmin): Promise<void> {
    if (await this.ejecutar(() => firstValueFrom(this.api.patch(`/mesas/${m.id}`, { activa: !m.activa })))) this.recargar();
  }

  protected async regenerar(m: MesaAdmin): Promise<void> {
    if (!confirm(`El QR actual de la mesa ${m.numero} dejará de funcionar. ¿Continuar?`)) return;
    if (await this.ejecutar(() => firstValueFrom(this.api.post(`/mesas/${m.id}/regenerar-codigo`, {})), 'Nuevo QR generado')) this.recargar();
  }

  protected imprimir(): void {
    window.print();
  }
}

// ------------------------------------------------------------------ Usuarios
interface UsuarioAdmin { id: string; email: string; nombre: string; rol: string; activo: boolean }

@Component({
  selector: 'app-admin-usuarios',
  imports: [FormsModule],
  template: `
    <form class="${TARJETA} mb-6 grid grid-cols-1 gap-3 p-5 text-sm md:grid-cols-5" (ngSubmit)="crear()" #f="ngForm">
      <input class="${CAMPO}" name="nombre" placeholder="Nombre" required minlength="2" [(ngModel)]="nuevo.nombre" />
      <input class="${CAMPO}" name="email" type="email" placeholder="Correo" required autocomplete="off" [(ngModel)]="nuevo.email" />
      <input class="${CAMPO}" name="password" type="password" placeholder="Contraseña inicial (10+)" required minlength="10" autocomplete="new-password" [(ngModel)]="nuevo.password" />
      <select class="${CAMPO}" name="rol" [(ngModel)]="nuevo.rol">
        @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
      </select>
      <button class="${BOTON}" type="submit" [disabled]="ocupado() || f.invalid">Crear usuario</button>
    </form>
    @if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
    <div class="${TARJETA} overflow-x-auto">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead class="border-b border-brasa-border text-xs uppercase text-brasa-muted"><tr><th class="px-4 py-3">Nombre</th><th class="px-4 py-3">Correo</th><th class="px-4 py-3">Rol</th><th class="px-4 py-3">Estado</th></tr></thead>
        <tbody>
          @for (u of usuarios(); track u.id) {
            <tr class="border-b border-brasa-border last:border-0">
              <td class="px-4 py-3 font-semibold">{{ u.nombre }}</td>
              <td class="px-4 py-3">{{ u.email }}</td>
              <td class="px-4 py-3">
                <select class="${CAMPO} w-36" [ngModel]="u.rol" (ngModelChange)="cambiar(u, { rol: $event })" [attr.aria-label]="'Rol de ' + u.nombre" [disabled]="ocupado()">
                  @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
                </select>
              </td>
              <td class="px-4 py-3">
                <button type="button" class="${BOTON_SEC}" [disabled]="ocupado()" (click)="cambiar(u, { activo: !u.activo })">{{ u.activo ? 'Activo · desactivar' : 'Inactivo · activar' }}</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-brasa-muted">Cambiar el rol o desactivar un usuario cierra sus sesiones abiertas de inmediato.</p>
  `,
})
export class AdminUsuariosComponent extends SeccionAdmin implements OnInit {
  protected readonly roles = ['MESERO', 'COCINA', 'ADMIN', 'CLIENTE'];
  protected readonly usuarios = signal<UsuarioAdmin[]>([]);
  protected nuevo = { nombre: '', email: '', password: '', rol: 'MESERO' };

  ngOnInit(): void {
    this.recargar();
  }

  protected recargar(): Promise<void> {
    return this.cargar(async () => this.usuarios.set(await firstValueFrom(this.api.get<UsuarioAdmin[]>('/usuarios'))));
  }

  protected async crear(): Promise<void> {
    if (await this.ejecutar(() => firstValueFrom(this.api.post('/usuarios', this.nuevo)), 'Usuario creado')) {
      this.nuevo = { nombre: '', email: '', password: '', rol: 'MESERO' };
      this.recargar();
    }
  }

  protected async cambiar(u: UsuarioAdmin, cambio: Partial<UsuarioAdmin>): Promise<void> {
    await this.ejecutar(() => firstValueFrom(this.api.patch(`/usuarios/${u.id}`, cambio)), 'Usuario actualizado');
    this.recargar();
  }
}

// ------------------------------------------------------------------ Calificaciones
interface CalificacionAdmin { id: string; pedidoNumero: string; estrellas: number; comentario: string; creadoEn: string }

@Component({
  selector: 'app-admin-calificaciones',
  imports: [DatePipe],
  template: `
    @if (resumen()) {
      <div class="${TARJETA} mb-6 flex flex-wrap items-center gap-8 p-5">
        <div>
          <p class="text-xs font-semibold uppercase text-brasa-muted">Promedio</p>
          <p class="font-heading text-3xl font-bold">{{ resumen()!.promedio ?? '—' }} <span class="text-brasa-orange">★</span></p>
          <p class="text-xs text-brasa-muted">{{ resumen()!.total }} calificaciones</p>
        </div>
        <ul class="flex-1 text-sm">
          @for (n of [5, 4, 3, 2, 1]; track n) {
            <li class="flex items-center gap-2"><span class="w-6">{{ n }}★</span>
              <span class="h-2 rounded-full bg-brasa-orange" [style.width.%]="resumen()!.total ? (resumen()!.distribucion[n] / resumen()!.total) * 80 : 0"></span>
              <span class="text-brasa-muted">{{ resumen()!.distribucion[n] }}</span></li>
          }
        </ul>
      </div>
    }
    @if (error()) { <p class="text-sm text-red-700" role="alert">{{ error() }}</p> }
    <ul class="flex flex-col gap-3">
      @for (c of lista(); track c.id) {
        <li class="${TARJETA} px-5 py-4">
          <p class="text-sm"><span class="text-brasa-orange" [attr.aria-label]="c.estrellas + ' de 5 estrellas'">{{ '★'.repeat(c.estrellas) }}{{ '☆'.repeat(5 - c.estrellas) }}</span>
            <span class="ml-2 text-brasa-muted">Pedido {{ c.pedidoNumero }} · {{ c.creadoEn | date: 'd MMM y' }}</span></p>
          @if (c.comentario) { <p class="mt-1 text-sm">{{ c.comentario }}</p> }
        </li>
      } @empty { <li class="text-sm text-brasa-muted">{{ cargando() ? 'Cargando...' : 'Aún no hay calificaciones.' }}</li> }
    </ul>
  `,
})
export class AdminCalificacionesComponent extends SeccionAdmin implements OnInit {
  protected readonly lista = signal<CalificacionAdmin[]>([]);
  protected readonly resumen = signal<{ promedio: number | null; total: number; distribucion: Record<number, number> } | null>(null);

  ngOnInit(): void {
    this.cargar(async () => {
      const [l, r] = await Promise.all([
        firstValueFrom(this.api.get<CalificacionAdmin[]>('/calificaciones')),
        firstValueFrom(this.api.get<{ promedio: number | null; total: number; distribucion: Record<number, number> }>('/calificaciones/resumen')),
      ]);
      this.lista.set(l);
      this.resumen.set(r);
    });
  }
}
