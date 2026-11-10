import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { PedidosService } from './pedidos.service';

export interface ResumenCalificaciones {
  promedio: number | null;
  total: number;
  distribucion: Record<number, number>;
}

/** Las calificaciones se guardan en el servidor: solo de pedidos entregados y una por pedido. */
@Injectable({ providedIn: 'root' })
export class CalificacionesService {
  private readonly api = inject(ApiService);
  private readonly pedidos = inject(PedidosService);

  async calificar(pedidoId: string, estrellas: number, comentario: string): Promise<void> {
    await firstValueFrom(
      this.api.post('/calificaciones', { pedidoId, estrellas, comentario }, this.pedidos.cabeceras(pedidoId)),
    );
  }

  resumen(): Promise<ResumenCalificaciones> {
    return firstValueFrom(this.api.get<ResumenCalificaciones>('/calificaciones/resumen'));
  }
}
