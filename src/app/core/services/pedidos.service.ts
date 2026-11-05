import { Injectable, computed, inject, signal } from '@angular/core';
import { ItemCarrito } from '../../models/carrito.model';
import { EstadoPedido, ResumenPedido } from '../../models/pedido.model';
import { MesaConfig } from '../../models/mesa.model';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { HistorialPedidosService } from './historial-pedidos.service';

export interface Pedido {
  id: string;
  numero: string;
  items: ItemCarrito[];
  resumen: ResumenPedido;
  mesa: MesaConfig;
  notasCocina: string;
  creadoEn: string;
  tiempoEstimadoMin: number;
  estado: EstadoPedido;
}

export interface NuevoPedido {
  items: ItemCarrito[];
  resumen: ResumenPedido;
  mesa: MesaConfig;
  notasCocina: string;
}

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly api = inject(ApiService);
  private readonly historial = inject(HistorialPedidosService);
  private readonly pedidoActual = signal<Pedido | null>(null);

  readonly integracionActiva = signal(environment.integracionActiva);
  readonly pedido = this.pedidoActual.asReadonly();
  readonly hayPedidoActivo = computed(() => this.pedidoActual() !== null);

  async crearPedido(nuevo: NuevoPedido): Promise<Pedido> {
    if (this.integracionActiva()) {
      try {
        const body = {
          items: nuevo.items.map((item) => ({
            productoId: item.productoId,
            nombre: item.nombre,
            imagenUrl: item.imagenUrl,
            precioBase: item.precioBase,
            precioUnitario: item.precioUnitario,
            cantidad: item.cantidad,
            personalizacion: item.personalizacion
          })),
          resumen: nuevo.resumen,
          mesa: nuevo.mesa,
          notasCocina: nuevo.notasCocina,
          tipoPedido: nuevo.mesa?.tipo || 'mesa'
        };

        const respuesta = await firstValueFrom(this.api.post<any>('/pedidos', body));
        const pedido: Pedido = {
          id: respuesta.id,
          numero: respuesta.numero,
          items: respuesta.items,
          resumen: respuesta.resumen || nuevo.resumen,
          mesa: respuesta.mesa || nuevo.mesa,
          notasCocina: respuesta.notasCocina,
          creadoEn: respuesta.creadoEn,
          tiempoEstimadoMin: respuesta.tiempoEstimadoMin,
          estado: respuesta.estado
        };
        this.pedidoActual.set(pedido);
        this.historial.agregar(pedido);
        return pedido;
      } catch (error) {
        console.error('Error al crear pedido en API, usando modo local', error);
      }
    }

    const tiempoEstimadoMin = 10 + nuevo.items.reduce((total, item) => total + item.cantidad * 4, 0);
    const pedido: Pedido = {
      id: `PED-${Date.now().toString(36).toUpperCase()}`,
      numero: `#${Math.floor(1000 + Math.random() * 9000)}`,
      items: nuevo.items,
      resumen: nuevo.resumen,
      mesa: nuevo.mesa,
      notasCocina: nuevo.notasCocina,
      creadoEn: new Date().toISOString(),
      tiempoEstimadoMin,
      estado: 'recibido'
    };
    this.pedidoActual.set(pedido);
    this.historial.agregar(pedido);
    return pedido;
  }

  actualizarEstado(estado: EstadoPedido): void {
    this.pedidoActual.update((actual) => (actual ? { ...actual, estado } : actual));
  }

  limpiar(): void {
    this.pedidoActual.set(null);
  }
}
