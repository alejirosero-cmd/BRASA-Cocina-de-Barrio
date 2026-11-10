import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

export type TipoEvento = 'pedido.actualizado' | 'solicitud.actualizada' | 'pago.actualizado';

export interface EventoTiempoReal {
  tipo: TipoEvento;
  /** Id del pedido afectado (para que el cliente solo reciba los de su pedido). */
  pedidoId?: string;
  datos: unknown;
}

/**
 * Bus de eventos en memoria para Server-Sent Events.
 * Funciona con una sola instancia del servidor; para varias instancias habría que usar Redis u otro broker.
 */
@Injectable()
export class EventosService {
  private readonly bus = new Subject<EventoTiempoReal>();

  emitir(evento: EventoTiempoReal): void {
    this.bus.next(evento);
  }

  flujo(predicado: (e: EventoTiempoReal) => boolean): Observable<MessageEvent> {
    return this.bus.pipe(
      filter(predicado),
      map((e) => ({ type: e.tipo, data: e.datos as object })),
    );
  }
}
