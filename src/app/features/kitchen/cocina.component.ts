import { Component, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { LucideBellRing, LucideChefHat, LucideVolume2, LucideVolumeX } from '@lucide/angular';
import { AvisoSonoroService } from '../../core/services/aviso-sonoro.service';
import { mensajeError } from '../../core/services/api.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PanelPersonalService } from '../../core/services/panel-personal.service';
import { EstadoPedido, Pedido } from '../../models/pedido.model';
import { PanelAgotadosComponent } from '../../shared/components/panel-agotados/panel-agotados.component';
import { TarjetaPedidoComponent } from '../../shared/components/tarjeta-pedido/tarjeta-pedido.component';

/** Panel de cocina: pedidos de todas las mesas, actualizados en tiempo real. */
@Component({
  selector: 'app-cocina',
  imports: [LucideChefHat, LucideVolume2, LucideVolumeX, LucideBellRing, TarjetaPedidoComponent, PanelAgotadosComponent],
  template: `
    <section class="mx-auto max-w-[1760px] px-5 py-8 md:px-10">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-3 font-heading text-3xl font-bold tracking-tight text-brasa-black">
            <svg lucideChefHat [size]="28" class="text-brasa-orange"></svg> Cocina
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
          @if (sonido.activo()) { <svg lucideVolume2 [size]="18"></svg> Sonido activado } @else { <svg lucideVolumeX [size]="18"></svg> Activar sonido de pedidos nuevos }
        </button>
      </div>

      @if (aviso(); as nuevo) {
        <div class="mb-6 flex items-center gap-3 rounded-2xl border-2 border-brasa-orange bg-brasa-orange/10 px-5 py-3" role="status">
          <svg lucideBellRing [size]="22" class="text-brasa-orange"></svg>
          <p class="flex-1 text-sm font-semibold text-brasa-black">
            Pedido nuevo {{ nuevo.numero }} · {{ nuevo.mesa.tipo === 'llevar' ? 'Para llevar' : 'Mesa ' + nuevo.mesa.numero }}
            · {{ nuevo.items.length }} {{ nuevo.items.length === 1 ? 'producto' : 'productos' }}
          </p>
          <button type="button" class="text-sm font-semibold text-brasa-orange" (click)="aviso.set(null)">Entendido</button>
        </div>
      }
      @if (panel.error()) {
        <p class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ panel.error() }}</p>
      }

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        @for (col of columnas; track col.estado) {
          <section [attr.aria-label]="col.titulo" class="rounded-2xl bg-brasa-gray-light p-4">
            <h2 class="mb-4 flex items-center justify-between font-heading text-base font-semibold">
              {{ col.titulo }}
              <span class="rounded-full bg-white px-2.5 py-0.5 text-sm">{{ lista(col.estado).length }}</span>
            </h2>
            <div class="flex flex-col gap-4">
              @for (p of lista(col.estado); track p.id) {
                <app-tarjeta-pedido [pedido]="p" [ahora]="ahora()">
                  @if (col.accion) {
                    <button type="button" class="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                      [class]="col.claseBoton" [disabled]="ocupado() === p.id" (click)="avanzar(p, col.accion.hacia)">
                      {{ col.accion.texto }}
                    </button>
                  }
                </app-tarjeta-pedido>
              } @empty {
                <p class="rounded-xl border border-dashed border-brasa-border bg-white px-4 py-8 text-center text-sm text-brasa-muted">Sin pedidos</p>
              }
            </div>
          </section>
        }
      </div>

      <div class="mt-8">
        <app-panel-agotados />
      </div>
    </section>
  `,
})
export class CocinaComponent implements OnInit, OnDestroy {
  protected readonly panel = inject(PanelPersonalService);
  private readonly notificaciones = inject(NotificacionesService);
  protected readonly sonido = inject(AvisoSonoroService);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly aviso = signal<Pedido | null>(null);

  constructor() {
    // Pedido nuevo en vivo: timbre (si está activado) y aviso visible hasta que alguien lo vea.
    effect(() => {
      const nuevo = this.panel.ultimoNuevo();
      // Al volver a esta pantalla no se repite el aviso de un pedido de hace rato.
      if (!nuevo || Date.now() - Date.parse(nuevo.creadoEn) > 120_000) return;
      untracked(() => {
        this.aviso.set(nuevo);
        this.sonido.sonar();
      });
    });
  }
  protected readonly ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;

  /** Cocina confirma pedidos nuevos, los prepara y los marca listos. Entregar es tarea del mesero. */
  protected readonly columnas: {
    estado: EstadoPedido[];
    titulo: string;
    accion?: { hacia: EstadoPedido; texto: string };
    claseBoton: string;
  }[] = [
    { estado: ['PENDIENTE', 'CONFIRMADO'], titulo: 'Por preparar', accion: { hacia: 'EN_PREPARACION', texto: 'Empezar preparación' }, claseBoton: 'bg-amber-500 hover:bg-amber-600' },
    { estado: ['EN_PREPARACION'], titulo: 'En preparación', accion: { hacia: 'LISTO', texto: 'Marcar listo' }, claseBoton: 'bg-green-600 hover:bg-green-700' },
    { estado: ['LISTO'], titulo: 'Listos para servir', claseBoton: '' },
  ];

  ngOnInit(): void {
    this.panel.iniciar();
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 30_000);
  }

  ngOnDestroy(): void {
    this.panel.detener();
    clearInterval(this.reloj);
  }

  protected lista(estados: EstadoPedido[]): Pedido[] {
    return estados.flatMap((e) => this.panel.porEstado()[e] ?? []);
  }

  protected async avanzar(p: Pedido, hacia: EstadoPedido): Promise<void> {
    this.ocupado.set(p.id);
    try {
      // Un pedido pendiente se confirma antes de pasar a preparación (dos pasos de la máquina de estados).
      if (p.estado === 'PENDIENTE' && hacia === 'EN_PREPARACION') await this.panel.cambiarEstado(p.id, 'CONFIRMADO');
      await this.panel.cambiarEstado(p.id, hacia);
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e), 'error');
      this.panel.recargar();
    } finally {
      this.ocupado.set(null);
    }
  }
}
