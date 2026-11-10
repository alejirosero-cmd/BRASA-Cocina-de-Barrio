import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideBell } from '@lucide/angular';
import { mensajeError } from '../../core/services/api.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PanelPersonalService } from '../../core/services/panel-personal.service';
import { MOTIVOS_SOLICITUD } from '../../core/services/solicitudes-mesero.service';
import { EstadoPedido, Pedido } from '../../models/pedido.model';
import { TarjetaPedidoComponent } from '../../shared/components/tarjeta-pedido/tarjeta-pedido.component';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

/** Panel de meseros: llamados de las mesas, pedidos por confirmar, listos para entregar y cobros. */
@Component({
  selector: 'app-mesero',
  imports: [DatePipe, LucideBell, TarjetaPedidoComponent, PrecioCopPipe],
  template: `
    <section class="mx-auto max-w-[1760px] px-5 py-8 md:px-10">
      <div class="mb-6">
        <h1 class="flex items-center gap-3 font-heading text-3xl font-bold tracking-tight text-brasa-black">
          <svg lucideBell [size]="26" class="text-brasa-orange"></svg> Meseros
        </h1>
        <p class="mt-1 flex items-center gap-2 text-sm text-brasa-muted">
          <span class="inline-flex h-2 w-2 rounded-full" [class]="panel.conectado() ? 'bg-green-500' : 'bg-amber-400'" aria-hidden="true"></span>
          {{ panel.conectado() ? 'En vivo' : 'Reconectando...' }}
        </p>
      </div>
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

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                <button type="button" class="rounded-xl border border-brasa-black px-3 py-2 text-sm font-semibold" [disabled]="ocupado() === p.id" (click)="cobrar(p)">Cobrado en efectivo/datáfono</button>
              </div>
            } @empty { <p class="text-sm text-brasa-muted">Todas las cuentas activas están pagadas.</p> }
          </div>
        </section>
      </div>
    </section>
  `,
})
export class MeseroComponent implements OnInit, OnDestroy {
  protected readonly panel = inject(PanelPersonalService);
  private readonly notificaciones = inject(NotificacionesService);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;

  protected readonly pendientes = computed(() => this.panel.porEstado()['PENDIENTE'] ?? []);
  protected readonly listos = computed(() => this.panel.porEstado()['LISTO'] ?? []);
  protected readonly porCobrar = computed(() => this.panel.pedidos().filter((p) => p.saldo > 0));

  ngOnInit(): void {
    this.panel.iniciar();
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 30_000);
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

  protected cobrar(p: Pedido) {
    if (!confirm(`¿Confirmas que recibiste el pago de ${p.numero}?`)) return Promise.resolve();
    return this.accion(p.id, () => this.panel.cobrarEfectivo(p.id), 'Pago registrado');
  }
}
