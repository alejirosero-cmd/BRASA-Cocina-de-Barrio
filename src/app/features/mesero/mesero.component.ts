import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LucideBell, LucideBellRing, LucideVolume2, LucideVolumeX } from '@lucide/angular';
import { ApiService, mensajeError } from '../../core/services/api.service';
import { AvisoSonoroService } from '../../core/services/aviso-sonoro.service';
import { AuthService } from '../../core/services/auth.service';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PanelPersonalService } from '../../core/services/panel-personal.service';
import { MOTIVOS_SOLICITUD } from '../../core/services/solicitudes-mesero.service';
import { ETIQUETA_ESTADO, EstadoPedido, Pedido } from '../../models/pedido.model';
import { PanelAgotadosComponent } from '../../shared/components/panel-agotados/panel-agotados.component';
import { TarjetaPedidoComponent } from '../../shared/components/tarjeta-pedido/tarjeta-pedido.component';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

interface EstadoMesa {
  numero: number;
  estado: string;
  punto: string;
  borde: string;
  saldo: number;
}

/** Panel de meseros: mapa de mesas, llamados, pedidos por confirmar, en cocina, listos y cobros. */
@Component({
  selector: 'app-mesero',
  imports: [DatePipe, LucideBell, LucideBellRing, LucideVolume2, LucideVolumeX, TarjetaPedidoComponent, PrecioCopPipe, PanelAgotadosComponent],
  template: `
    <section class="mx-auto max-w-[1760px] px-5 py-8 md:px-10">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-3 font-heading text-3xl font-bold tracking-tight text-brasa-black">
            <svg lucideBell [size]="26" class="text-brasa-orange"></svg> Meseros
          </h1>
          <p class="mt-1 flex items-center gap-2 text-sm text-brasa-muted">
            <span class="inline-flex h-2 w-2 rounded-full" [class]="panel.conectado() ? 'bg-green-500' : 'bg-amber-400'" aria-hidden="true"></span>
            {{ panel.conectado() ? 'En vivo' : 'Reconectando...' }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
          [class]="sonido.activo() ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black' : 'border-brasa-border text-brasa-muted hover:text-brasa-black'"
          [attr.aria-pressed]="sonido.activo()"
          (click)="sonido.alternar()"
        >
          @if (sonido.activo()) { <svg lucideVolume2 [size]="18"></svg> Sonido activado } @else { <svg lucideVolumeX [size]="18"></svg> Activar sonido de avisos }
        </button>
      </div>

      @if (aviso()) {
        <div class="mb-6 flex items-center gap-3 rounded-2xl border-2 border-brasa-orange bg-brasa-orange/10 px-5 py-3" role="status">
          <svg lucideBellRing [size]="22" class="text-brasa-orange"></svg>
          <p class="flex-1 text-sm font-semibold text-brasa-black">{{ aviso() }}</p>
          <button type="button" class="text-sm font-semibold text-brasa-orange" (click)="aviso.set('')">Entendido</button>
        </div>
      }

      <!-- Mapa de mesas: de un vistazo qué mesa espera, cuál está comiendo y cuál debe. -->
      <section aria-label="Mesas" class="mb-8">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-heading text-lg font-semibold">Mesas</h2>
          <p class="flex flex-wrap gap-3 text-xs text-brasa-muted">
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-gray-300"></span>Libre</span>
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>Pedido en curso</span>
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span>Listo para servir</span>
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-sky-500"></span>Por cobrar</span>
            <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-brasa-orange"></span>Llamando</span>
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          @for (m of mapaMesas(); track m.numero) {
            <div class="flex flex-col rounded-2xl border-2 bg-white p-3 shadow-card" [class]="m.borde">
              <div class="flex items-center justify-between">
                <p class="font-heading text-base font-bold">Mesa {{ m.numero }}</p>
                <span class="h-3 w-3 rounded-full" [class]="m.punto" aria-hidden="true"></span>
              </div>
              <div class="mb-3 mt-1">
                <p class="text-xs font-medium text-brasa-black">{{ m.estado }}</p>
                @if (m.saldo > 0) { <p class="text-xs text-brasa-muted">Debe {{ m.saldo | precioCop }}</p> }
              </div>
              <button
                type="button"
                class="mt-auto rounded-lg bg-brasa-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brasa-orange disabled:opacity-50"
                [disabled]="tomando() !== null"
                (click)="tomarPedido(m.numero)"
              >
                {{ tomando() === m.numero ? 'Abriendo menú...' : 'Tomar pedido' }}
              </button>
            </div>
          } @empty {
            <p class="text-sm text-brasa-muted">Cargando mesas...</p>
          }
        </div>
      </section>
      @if (panel.error()) {
        <p class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ panel.error() }}</p>
      }

      <section aria-label="Llamados de las mesas" class="mb-8">
        <h2 class="mb-3 font-heading text-lg font-semibold">Llamados ({{ panel.solicitudes().length }})</h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
          @for (s of panel.solicitudes(); track s.id) {
            <div class="flex items-center justify-between gap-3 rounded-2xl border-2 border-brasa-orange bg-brasa-orange/5 px-4 py-3">
              <div>
                <p class="font-heading font-bold">{{ s.mesa ? 'Mesa ' + s.mesa : 'Mostrador' }}</p>
                <p class="text-sm text-brasa-black">{{ motivo(s.motivo) }}</p>
                <p class="text-xs text-brasa-muted">{{ s.creadaEn | date: 'h:mm a' }}</p>
              </div>
              <button type="button" class="rounded-xl bg-brasa-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="ocupado() === s.id" (click)="atender(s.id)">Atendido</button>
            </div>
          } @empty {
            <p class="text-sm text-brasa-muted">No hay llamados pendientes.</p>
          }
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        <section aria-label="Pedidos por confirmar" class="rounded-2xl bg-brasa-gray-light p-4">
          <h2 class="mb-4 font-heading text-base font-semibold">Nuevos por confirmar ({{ pendientes().length }})</h2>
          <div class="flex flex-col gap-4">
            @for (p of pendientes(); track p.id) {
              <app-tarjeta-pedido [pedido]="p" [mostrarPago]="true" [ahora]="ahora()">
                <button type="button" class="flex-1 rounded-xl bg-brasa-orange px-3 py-2 text-sm font-semibold text-white" [disabled]="ocupado() === p.id" (click)="estado(p, 'CONFIRMADO')">Confirmar</button>
                <button type="button" class="rounded-xl border border-brasa-border px-3 py-2 text-sm font-semibold text-red-600" [disabled]="ocupado() === p.id" (click)="cancelar(p)">Cancelar</button>
              </app-tarjeta-pedido>
            } @empty { <p class="text-sm text-brasa-muted">Sin pedidos nuevos.</p> }
          </div>
        </section>

        <section aria-label="Pedidos en cocina" class="rounded-2xl bg-brasa-gray-light p-4">
          <h2 class="mb-4 font-heading text-base font-semibold">En cocina ({{ enCocina().length }})</h2>
          <div class="flex flex-col gap-3">
            @for (p of enCocina(); track p.id) {
              <div class="rounded-xl bg-white px-4 py-3 shadow-card">
                <div class="flex items-center justify-between gap-2">
                  <p class="font-semibold">{{ p.numero }} · {{ p.mesa.tipo === 'llevar' ? 'Para llevar' : 'Mesa ' + p.mesa.numero }}</p>
                  <span class="text-xs" [class]="minutos(p) > p.tiempoEstimadoMin ? 'font-semibold text-red-600' : 'text-brasa-muted'">{{ minutos(p) }} / {{ p.tiempoEstimadoMin }} min</span>
                </div>
                <p class="text-xs text-brasa-muted">{{ etiquetaEstado[p.estado] }} · {{ resumenItems(p) }}</p>
              </div>
            } @empty { <p class="text-sm text-brasa-muted">Nada en preparación.</p> }
          </div>
        </section>

        <section aria-label="Pedidos listos para entregar" class="rounded-2xl bg-brasa-gray-light p-4">
          <h2 class="mb-4 font-heading text-base font-semibold">Listos para entregar ({{ listos().length }})</h2>
          <div class="flex flex-col gap-4">
            @for (p of listos(); track p.id) {
              <app-tarjeta-pedido [pedido]="p" [mostrarPago]="true" [ahora]="ahora()">
                <button type="button" class="flex-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white" [disabled]="ocupado() === p.id" (click)="estado(p, 'ENTREGADO')">Entregado</button>
              </app-tarjeta-pedido>
            } @empty { <p class="text-sm text-brasa-muted">Nada por entregar.</p> }
          </div>
        </section>

        <section aria-label="Cuentas por cobrar" class="rounded-2xl bg-brasa-gray-light p-4">
          <h2 class="mb-4 font-heading text-base font-semibold">Por cobrar ({{ porCobrar().length }})</h2>
          <div class="flex flex-col gap-3">
            @for (p of porCobrar(); track p.id) {
              <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-card">
                <div>
                  <p class="font-semibold">{{ p.numero }} · {{ p.mesa.tipo === 'llevar' ? 'Para llevar' : 'Mesa ' + p.mesa.numero }}</p>
                  <p class="text-sm text-brasa-muted">Saldo {{ p.saldo | precioCop }}</p>
                </div>
                @if (puedeCobrar()) {
                  <button type="button" class="rounded-xl border border-brasa-black px-3 py-2 text-sm font-semibold" [disabled]="ocupado() === p.id" (click)="abrirCobro(p)">Registrar pago</button>
                } @else {
                  <span class="text-right text-xs text-brasa-muted">Lo cobra la caja</span>
                }
              </div>
            } @empty { <p class="text-sm text-brasa-muted">Todas las cuentas activas están pagadas.</p> }
          </div>
        </section>
      </div>

      <div class="mt-8">
        <app-panel-agotados />
      </div>
    </section>

    @if (cobro(); as c) {
      <!-- Registrar un pago recibido en la mesa. El servidor revisa el permiso, el saldo y los duplicados. -->
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro">
        <form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft" (submit)="$event.preventDefault(); confirmarCobro()">
          <h2 id="titulo-cobro" class="font-heading text-lg font-semibold">Registrar pago · {{ c.pedido.numero }}</h2>
          <p class="text-sm text-brasa-muted">{{ c.pedido.mesa.tipo === 'llevar' ? 'Para llevar' : 'Mesa ' + c.pedido.mesa.numero }} · saldo {{ c.pedido.saldo | precioCop }}</p>

          <div class="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
            @for (m of metodos; track m.id) {
              <button type="button" role="radio" [attr.aria-checked]="c.metodo === m.id"
                class="rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition"
                [class]="c.metodo === m.id ? 'border-brasa-orange bg-brasa-orange/5' : 'border-brasa-border text-brasa-muted'"
                (click)="actualizarCobro({ metodo: m.id })">{{ m.titulo }}</button>
            }
          </div>

          <label class="mt-4 block text-sm"><span class="mb-1 block font-medium">Valor a cobrar</span>
            <input type="number" min="1" [max]="c.pedido.saldo" class="w-full rounded-xl border border-brasa-border px-3 py-2" [value]="c.monto"
              (input)="actualizarCobro({ monto: +$any($event.target).value })" />
            <span class="mt-1 block text-xs text-brasa-muted">Por defecto el saldo completo. Para dividir la cuenta, escribe solo una parte.</span>
          </label>

          @if (c.metodo === 'EFECTIVO') {
            <label class="mt-4 block text-sm"><span class="mb-1 block font-medium">Efectivo recibido (opcional)</span>
              <input type="number" min="1" class="w-full rounded-xl border border-brasa-border px-3 py-2" [value]="c.recibido ?? ''"
                (input)="actualizarCobro({ recibido: $any($event.target).value ? +$any($event.target).value : null })" />
            </label>
            @if (c.recibido && c.recibido >= c.monto) { <p class="mt-2 text-sm font-semibold text-green-700">Cambio: {{ c.recibido - c.monto | precioCop }}</p> }
          } @else {
            <label class="mt-4 block text-sm"><span class="mb-1 block font-medium">Código de aprobación del comprobante</span>
              <input type="text" maxlength="12" autocomplete="off" class="w-full rounded-xl border border-brasa-border px-3 py-2 uppercase tracking-widest" [value]="c.codigo"
                (input)="actualizarCobro({ codigo: $any($event.target).value.trim() })" placeholder="Ej. 123456" />
              <span class="mt-1 block text-xs text-brasa-muted">Solo registra la tarjeta si el datáfono imprimió el comprobante APROBADO.</span>
            </label>
          }

          @if (c.error) { <p class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ c.error }}</p> }

          <div class="mt-6 flex gap-2">
            <button type="button" class="flex-1 rounded-xl border border-brasa-border px-4 py-2.5 text-sm font-semibold" (click)="cobro.set(null)">Cancelar</button>
            <button type="submit" class="flex-1 rounded-xl bg-brasa-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" [disabled]="c.enviando">
              {{ c.enviando ? 'Registrando...' : 'Registrar ' + (c.monto | precioCop) }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class MeseroComponent implements OnInit, OnDestroy {
  protected readonly panel = inject(PanelPersonalService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly api = inject(ApiService);
  private readonly mesa = inject(MesaService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly sonido = inject(AvisoSonoroService);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly ahora = signal(Date.now());
  protected readonly aviso = signal('');
  protected readonly tomando = signal<number | null>(null);
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  private readonly mesas = signal<{ numero: number; activa: boolean }[]>([]);
  private reloj?: ReturnType<typeof setInterval>;

  constructor() {
    // Pedido nuevo o llamado de mesa en vivo: timbre (si está activado) y aviso visible.
    // Al volver a esta pantalla no se repite el aviso de algo de hace rato.
    effect(() => {
      const p = this.panel.ultimoNuevo();
      if (!p || Date.now() - Date.parse(p.creadoEn) > 120_000) return;
      const lugar = p.mesa.tipo === 'llevar' ? 'Para llevar' : 'Mesa ' + p.mesa.numero;
      untracked(() => this.avisar('Pedido nuevo ' + p.numero + ' · ' + lugar + ': confírmalo'));
    });
    effect(() => {
      const s = this.panel.ultimoLlamado();
      if (!s || Date.now() - Date.parse(s.creadaEn) > 120_000) return;
      const lugar = s.mesa ? 'Mesa ' + s.mesa : 'Mostrador';
      untracked(() => this.avisar(lugar + ' te llama: ' + this.motivo(s.motivo)));
    });
  }

  protected readonly pendientes = computed(() => this.panel.porEstado()['PENDIENTE'] ?? []);
  protected readonly enCocina = computed(() => [
    ...(this.panel.porEstado()['CONFIRMADO'] ?? []),
    ...(this.panel.porEstado()['EN_PREPARACION'] ?? []),
  ]);
  protected readonly listos = computed(() => this.panel.porEstado()['LISTO'] ?? []);
  protected readonly porCobrar = computed(() => this.panel.pedidos().filter((p) => p.saldo > 0));

  /** Estado de cada mesa a partir de sus pedidos activos, saldos y llamados. */
  protected readonly mapaMesas = computed<EstadoMesa[]>(() =>
    this.mesas()
      .filter((m) => m.activa)
      .map((m) => {
        const pedidos = this.panel.pedidos().filter((p) => p.mesa.tipo === 'mesa' && p.mesa.numero === m.numero);
        const saldo = pedidos.reduce((s, p) => s + p.saldo, 0);
        const llamando = this.panel.solicitudes().some((s) => s.mesa === m.numero);
        const estados = pedidos.map((p) => p.estado);
        let estado = 'Libre';
        let punto = 'bg-gray-300';
        if (estados.includes('LISTO')) {
          estado = 'Pedido listo para servir';
          punto = 'bg-green-500';
        } else if (estados.includes('PENDIENTE')) {
          estado = 'Pedido por confirmar';
          punto = 'bg-amber-400';
        } else if (estados.includes('CONFIRMADO') || estados.includes('EN_PREPARACION')) {
          estado = 'En cocina';
          punto = 'bg-amber-400';
        } else if (saldo > 0) {
          estado = 'Comiendo · por cobrar';
          punto = 'bg-sky-500';
        }
        if (llamando) {
          estado = 'Te está llamando';
          punto = 'bg-brasa-orange';
        }
        const borde = llamando ? 'border-brasa-orange' : 'border-brasa-border';
        return { numero: m.numero, estado, punto, saldo, borde };
      }),
  );

  ngOnInit(): void {
    this.panel.iniciar();
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 30_000);
    firstValueFrom(this.api.get<{ numero: number; activa: boolean }[]>('/mesas'))
      .then((m) => this.mesas.set(m))
      .catch(() => this.notificaciones.mostrar('No se pudieron cargar las mesas', 'error'));
  }

  private avisar(texto: string): void {
    this.aviso.set(texto);
    this.sonido.sonar();
  }

  protected minutos(p: Pedido): number {
    return Math.max(0, Math.floor((this.ahora() - Date.parse(p.creadoEn)) / 60_000));
  }

  protected resumenItems(p: Pedido): string {
    return p.items.map((i) => i.cantidad + '× ' + i.nombre).join(', ');
  }

  /** El mesero toma el pedido por el cliente: elige la mesa y abre el menú como si hubiera escaneado el QR. */
  protected async tomarPedido(numero: number): Promise<void> {
    this.tomando.set(numero);
    try {
      await this.mesa.usarCodigo(String(numero));
      this.notificaciones.mostrar('Tomando pedido para la mesa ' + numero);
      await this.router.navigate(['/menu']);
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e, 'No se pudo abrir la mesa'), 'error');
    } finally {
      this.tomando.set(null);
    }
  }

  ngOnDestroy(): void {
    this.panel.detener();
    clearInterval(this.reloj);
  }

  protected motivo(id: string): string {
    return MOTIVOS_SOLICITUD.find((m) => m.id === id)?.titulo ?? id;
  }

  private async accion(id: string, fn: () => Promise<unknown>, exito?: string): Promise<void> {
    this.ocupado.set(id);
    try {
      await fn();
      if (exito) this.notificaciones.mostrar(exito);
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e), 'error');
      this.panel.recargar();
    } finally {
      this.ocupado.set(null);
    }
  }

  protected atender(id: string) {
    return this.accion(id, () => this.panel.atenderSolicitud(id));
  }

  protected estado(p: Pedido, estado: EstadoPedido) {
    return this.accion(p.id, () => this.panel.cambiarEstado(p.id, estado));
  }

  protected cancelar(p: Pedido) {
    const motivo = prompt(`Motivo de la cancelación del pedido ${p.numero}:`, 'Producto agotado');
    if (motivo === null) return Promise.resolve();
    return this.accion(p.id, () => this.panel.cambiarEstado(p.id, 'CANCELADO', motivo.slice(0, 200)), 'Pedido cancelado');
  }

  protected readonly metodos = [
    { id: 'EFECTIVO' as const, titulo: 'Efectivo' },
    { id: 'TARJETA' as const, titulo: 'Tarjeta (datáfono)' },
  ];
  /** El servidor decide; esto solo muestra u oculta el botón. */
  protected readonly puedeCobrar = computed(() => this.auth.usuario()?.puedeCobrar === true);
  protected readonly cobro = signal<{
    pedido: Pedido; metodo: 'EFECTIVO' | 'TARJETA'; monto: number; recibido: number | null;
    codigo: string; clave: string; error: string; enviando: boolean;
  } | null>(null);

  protected abrirCobro(p: Pedido): void {
    // Una clave por intento: si la red falla y se reintenta, el servidor no duplica el cobro.
    this.cobro.set({ pedido: p, metodo: 'EFECTIVO', monto: p.saldo, recibido: null, codigo: '', clave: crypto.randomUUID(), error: '', enviando: false });
  }

  protected actualizarCobro(cambio: Partial<{ metodo: 'EFECTIVO' | 'TARJETA'; monto: number; recibido: number | null; codigo: string }>): void {
    this.cobro.update((c) => (c ? { ...c, ...cambio, error: '' } : c));
  }

  protected async confirmarCobro(confirmarDuplicado = false): Promise<void> {
    const c = this.cobro();
    if (!c) return;
    this.cobro.set({ ...c, enviando: true, error: '' });
    try {
      const r = await this.panel.registrarCobro({
        pedidoId: c.pedido.id, metodo: c.metodo, monto: c.monto, clave: c.clave,
        ...(c.metodo === 'EFECTIVO' && c.recibido ? { efectivoRecibido: c.recibido } : {}),
        ...(c.metodo === 'TARJETA' && c.codigo ? { codigoAutorizacion: c.codigo } : {}),
        ...(confirmarDuplicado ? { confirmarDuplicado: true } : {}),
      });
      this.cobro.set(null);
      this.notificaciones.mostrar(r.cambio ? 'Pago registrado. Cambio: $' + r.cambio.toLocaleString('es-CO') : 'Pago registrado');
      this.panel.recargar();
    } catch (e) {
      const mensaje = mensajeError(e, 'No se pudo registrar el pago');
      if (!confirmarDuplicado && mensaje.includes('confírmalo') && confirm(mensaje)) return this.confirmarCobro(true);
      this.cobro.update((x) => (x ? { ...x, enviando: false, error: mensaje } : x));
    }
  }
}
