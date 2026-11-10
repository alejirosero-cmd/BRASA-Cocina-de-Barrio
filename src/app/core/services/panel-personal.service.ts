import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { EstadoPedido, Pedido, SolicitudMesero } from '../../models/pedido.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TiempoRealService } from './tiempo-real.service';

const ACTIVOS: EstadoPedido[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO'];

/** Estado compartido de los paneles de cocina y meseros, actualizado por SSE. */
@Injectable({ providedIn: 'root' })
export class PanelPersonalService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly tiempoReal = inject(TiempoRealService);

  private readonly pedidosSignal = signal<Pedido[]>([]);
  private readonly solicitudesSignal = signal<SolicitudMesero[]>([]);
  private suscripcion?: Subscription;
  private usuarios = 0;

  readonly pedidos = this.pedidosSignal.asReadonly();
  readonly solicitudes = this.solicitudesSignal.asReadonly();
  readonly conectado = signal(false);
  readonly error = signal('');

  readonly porEstado = computed(() => {
    const grupos: Record<string, Pedido[]> = {};
    for (const e of ACTIVOS) grupos[e] = [];
    for (const p of this.pedidosSignal()) grupos[p.estado]?.push(p);
    return grupos as Record<EstadoPedido, Pedido[]>;
  });

  /** Cada pantalla que lo usa llama a iniciar() y detener(); la conexión se comparte. */
  iniciar(): void {
    this.usuarios++;
    if (this.suscripcion) return;
    this.recargar();
    this.suscripcion = this.tiempoReal.escuchar('/pedidos/eventos').subscribe({
      next: (e) => {
        if (e.tipo === 'conectado') {
          this.conectado.set(true);
          this.recargar();
        } else if (e.tipo === 'desconectado') {
          this.conectado.set(false);
        } else if (e.tipo === 'pedido.actualizado') {
          this.aplicarPedido(e.datos as Pedido);
        } else if (e.tipo === 'solicitud.actualizada') {
          this.aplicarSolicitud(e.datos as SolicitudMesero);
        }
      },
      error: () => {
        this.conectado.set(false);
        this.error.set('Se perdió el acceso al canal en tiempo real. Vuelve a iniciar sesión.');
      },
    });
  }

  detener(): void {
    this.usuarios = Math.max(0, this.usuarios - 1);
    if (this.usuarios === 0) {
      this.suscripcion?.unsubscribe();
      this.suscripcion = undefined;
      this.conectado.set(false);
    }
  }

  async recargar(): Promise<void> {
    try {
      this.pedidosSignal.set(await firstValueFrom(this.api.get<Pedido[]>('/pedidos/activos')));
      if (this.auth.tieneRol('ADMIN', 'MESERO')) {
        this.solicitudesSignal.set(await firstValueFrom(this.api.get<SolicitudMesero[]>('/solicitudes')));
      }
      this.error.set('');
    } catch {
      this.error.set('No se pudieron cargar los pedidos. Reintentando...');
    }
  }

  async cambiarEstado(id: string, estado: EstadoPedido, nota?: string): Promise<void> {
    const p = await firstValueFrom(this.api.patch<Pedido>(`/pedidos/${id}/estado`, { estado, ...(nota ? { nota } : {}) }));
    this.aplicarPedido(p);
  }

  async atenderSolicitud(id: string): Promise<void> {
    await firstValueFrom(this.api.patch(`/solicitudes/${id}/atender`, {}));
    this.solicitudesSignal.update((l) => l.filter((s) => s.id !== id));
  }

  async cobrarEfectivo(pedidoId: string): Promise<void> {
    await firstValueFrom(this.api.post('/pagos/efectivo', { pedidoId }));
  }

  async marcarAgotado(productoId: string): Promise<void> {
    await firstValueFrom(this.api.patch(`/productos/${productoId}/disponibilidad`, { disponible: false }));
  }

  private aplicarPedido(p: Pedido): void {
    this.pedidosSignal.update((lista) => {
      const resto = lista.filter((x) => x.id !== p.id);
      // Se conserva si sigue en curso o si se entregó pero falta cobrarlo.
      const sigue = ACTIVOS.includes(p.estado) || (p.estado === 'ENTREGADO' && p.saldo > 0);
      return sigue ? [...resto, p].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)) : resto;
    });
  }

  private aplicarSolicitud(s: SolicitudMesero): void {
    if (!this.auth.tieneRol('ADMIN', 'MESERO')) return;
    this.solicitudesSignal.update((lista) => {
      const resto = lista.filter((x) => x.id !== s.id);
      return s.estado === 'PENDIENTE' ? [...resto, s] : resto;
    });
  }
}
