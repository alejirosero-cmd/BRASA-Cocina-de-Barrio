import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { Pedido } from '../../models/pedido.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CarritoService } from './carrito.service';
import { MesaService } from './mesa.service';
import { TiempoRealService } from './tiempo-real.service';

export type { Pedido } from '../../models/pedido.model';

/** Pedidos que este navegador puede consultar: id + token de seguimiento entregado por el servidor. */
interface PedidoSeguido {
  id: string;
  token: string;
  creadoEn: string;
}

const STORAGE_KEY = 'brasa.pedidos-seguidos';
const MAX_SEGUIDOS = 20;

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly carrito = inject(CarritoService);
  private readonly mesa = inject(MesaService);
  private readonly tiempoReal = inject(TiempoRealService);

  private readonly seguidos = signal<PedidoSeguido[]>(this.cargarSeguidos());
  private readonly pedidoActual = signal<Pedido | null>(null);
  private suscripcion?: Subscription;

  readonly pedido = this.pedidoActual.asReadonly();
  readonly conectado = signal(false);
  /** Id del pedido más reciente de este navegador (para el enlace "Seguimiento"). */
  readonly ultimoId = computed(() => this.seguidos()[0]?.id ?? null);
  readonly hayPedidoActivo = computed(() => {
    const p = this.pedidoActual();
    return p !== null && !['ENTREGADO', 'CANCELADO'].includes(p.estado);
  });

  /** Cabecera de acceso al pedido para clientes sin cuenta. */
  cabeceras(pedidoId: string): Record<string, string> {
    const token = this.seguidos().find((s) => s.id === pedidoId)?.token;
    return token ? { 'X-Pedido-Token': token } : {};
  }

  /**
   * Envía el carrito al servidor. Si falla, el error llega a la pantalla: nunca se simula
   * un pedido local que la cocina no recibiría.
   */
  async enviarCarrito(notasCocina: string): Promise<Pedido> {
    const respuesta = await firstValueFrom(
      this.api.post<{ pedido: Pedido; tokenSeguimiento: string }>('/pedidos', {
        tipo: this.mesa.tipo(),
        ...(this.mesa.tipo() === 'mesa' ? { codigoMesa: this.mesa.codigo() } : {}),
        items: this.carrito.itemsParaApi(),
        propinaPorcentaje: this.carrito.propinaEntera(),
        ...(notasCocina.trim() ? { notasCocina: notasCocina.trim() } : {}),
        ...(this.carrito.cupon() ? { cupon: this.carrito.cupon() } : {}),
      }),
    );
    this.recordar(respuesta.pedido.id, respuesta.tokenSeguimiento);
    this.pedidoActual.set(respuesta.pedido);
    this.carrito.limpiar();
    return respuesta.pedido;
  }

  async cargar(id: string): Promise<Pedido> {
    const pedido = await firstValueFrom(this.api.get<Pedido>(`/pedidos/${encodeURIComponent(id)}`, undefined, this.cabeceras(id)));
    this.pedidoActual.set(pedido);
    return pedido;
  }

  /** Escucha los cambios del pedido en tiempo real (reemplaza la simulación con temporizadores). */
  seguir(id: string): void {
    this.dejarDeSeguir();
    this.suscripcion = this.tiempoReal.escuchar(`/pedidos/${encodeURIComponent(id)}/eventos`, this.cabeceras(id)).subscribe({
      next: (evento) => {
        if (evento.tipo === 'conectado') {
          this.conectado.set(true);
          // Al reconectar se recarga por si hubo cambios mientras no había conexión.
          this.cargar(id).catch(() => undefined);
        } else if (evento.tipo === 'desconectado') {
          this.conectado.set(false);
        } else if (evento.tipo === 'pedido.actualizado') {
          this.pedidoActual.set(evento.datos as Pedido);
        }
      },
      error: () => this.conectado.set(false),
    });
  }

  dejarDeSeguir(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = undefined;
    this.conectado.set(false);
  }

  async cancelar(id: string): Promise<Pedido> {
    const p = await firstValueFrom(this.api.post<Pedido>(`/pedidos/${id}/cancelar`, {}, this.cabeceras(id)));
    this.pedidoActual.set(p);
    return p;
  }

  async cambiarPropina(id: string, porcentaje: number): Promise<Pedido> {
    const p = await firstValueFrom(this.api.patch<Pedido>(`/pedidos/${id}/propina`, { porcentaje }, this.cabeceras(id)));
    this.pedidoActual.set(p);
    return p;
  }

  async guardarFactura(id: string, datos: Record<string, unknown>): Promise<void> {
    await firstValueFrom(this.api.post(`/pedidos/${id}/factura`, datos, this.cabeceras(id)));
  }

  /** Historial: los pedidos de la cuenta (si hay sesión de cliente) más los seguidos en este navegador. */
  async historial(): Promise<Pedido[]> {
    const propios = this.auth.tieneRol('CLIENTE')
      ? await firstValueFrom(this.api.get<Pedido[]>('/pedidos/mios')).catch(() => [] as Pedido[])
      : [];
    const ids = new Set(propios.map((p) => p.id));
    const locales = await Promise.all(
      this.seguidos()
        .filter((s) => !ids.has(s.id))
        .map((s) => firstValueFrom(this.api.get<Pedido>(`/pedidos/${s.id}`, undefined, { 'X-Pedido-Token': s.token })).catch(() => null)),
    );
    return [...propios, ...locales.filter((p): p is Pedido => p !== null)].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  olvidarHistorialLocal(): void {
    this.seguidos.set([]);
    this.guardarSeguidos();
  }

  private recordar(id: string, token: string): void {
    this.seguidos.update((lista) => [{ id, token, creadoEn: new Date().toISOString() }, ...lista.filter((s) => s.id !== id)].slice(0, MAX_SEGUIDOS));
    this.guardarSeguidos();
  }

  private guardarSeguidos(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.seguidos()));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private cargarSeguidos(): PedidoSeguido[] {
    try {
      const lista = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(lista)
        ? lista.filter((s): s is PedidoSeguido => typeof s?.id === 'string' && typeof s?.token === 'string').slice(0, MAX_SEGUIDOS)
        : [];
    } catch {
      return [];
    }
  }
}
