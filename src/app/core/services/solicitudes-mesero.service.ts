import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MotivoSolicitud, SolicitudMesero } from '../../models/pedido.model';
import { ApiService } from './api.service';
import { MesaService } from './mesa.service';
import { PedidosService } from './pedidos.service';

export const MOTIVOS_SOLICITUD: { id: MotivoSolicitud; titulo: string; descripcion: string }[] = [
  { id: 'cuenta', titulo: 'Solicitar la cuenta', descripcion: 'Pide el recibo para pagar en caja o en la mesa.' },
  { id: 'utensilios', titulo: 'Cubiertos, servilletas o salsas', descripcion: 'Solicita utensilios adicionales para tu mesa.' },
  { id: 'ayuda', titulo: 'Ayuda con el pedido', descripcion: 'Un mesero se acercará para ayudarte con tu pedido.' },
];

/** Envía las solicitudes al servidor; los meseros las reciben en tiempo real en /mesero. */
@Injectable({ providedIn: 'root' })
export class SolicitudesMeseroService {
  private readonly api = inject(ApiService);
  private readonly mesa = inject(MesaService);
  private readonly pedidos = inject(PedidosService);

  /** Se puede llamar al mesero desde una mesa validada o teniendo un pedido para llevar. */
  puedeSolicitar(): boolean {
    return this.mesa.codigo() !== null || this.pedidos.ultimoId() !== null;
  }

  enviar(motivo: MotivoSolicitud): Promise<SolicitudMesero> {
    const codigoMesa = this.mesa.codigo();
    const pedidoId = this.pedidos.ultimoId();
    if (codigoMesa) {
      return firstValueFrom(this.api.post<SolicitudMesero>('/solicitudes', { motivo, codigoMesa }));
    }
    return firstValueFrom(
      this.api.post<SolicitudMesero>('/solicitudes', { motivo, pedidoId }, pedidoId ? this.pedidos.cabeceras(pedidoId) : {}),
    );
  }
}
