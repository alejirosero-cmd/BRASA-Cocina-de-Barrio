export type EstadoPedido = 'recibido' | 'preparando' | 'listo';

export type MotivoSolicitud = 'cuenta' | 'utensilios' | 'ayuda';

export interface SolicitudMesero {
  id: string;
  motivo: MotivoSolicitud;
  mesa: number | null;
  tipoPedido: 'mesa' | 'llevar';
  creadaEn: string;
  estado: 'enviada' | 'confirmada';
}

export interface ResumenPedido {
  subtotal: number;
  impuestos: number;
  propina: number;
  descuento: number;
  total: number;
}

export interface CalificacionPedido {
  id: string;
  pedidoId: string;
  pedidoNumero: string;
  estrellas: number;
  comentario: string;
  calificacionesPorItem?: { productoId: string; estrellas: number }[];
  fecha: string;
}
