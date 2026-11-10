import { ItemCarrito } from './carrito.model';
import { MesaConfig } from './mesa.model';

/** Estados del pedido definidos por el servidor (ver server/src/pedidos/transiciones.ts). */
export type EstadoPedido = 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
export type EstadoPagoPedido = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'REEMBOLSADO';

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  PENDIENTE: 'Recibido',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo para servir',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPagoPedido, string> = {
  PENDIENTE: 'Sin pagar',
  PARCIAL: 'Pago parcial',
  PAGADO: 'Pagado',
  REEMBOLSADO: 'Reembolsado',
};

export type MotivoSolicitud = 'cuenta' | 'utensilios' | 'ayuda';

export interface SolicitudMesero {
  id: string;
  motivo: MotivoSolicitud;
  mesa: number | null;
  estado: 'PENDIENTE' | 'ATENDIDA';
  creadaEn: string;
  repetida?: boolean;
}

export interface ResumenPedido {
  subtotal: number;
  impuestos: number;
  propina: number;
  descuento: number;
  total: number;
}

/** Pedido tal como lo devuelve la API. */
export interface Pedido {
  id: string;
  numero: string;
  tipo: 'mesa' | 'llevar';
  mesa: MesaConfig;
  estado: EstadoPedido;
  estadoPago: EstadoPagoPedido;
  items: ItemCarrito[];
  resumen: ResumenPedido;
  propinaPorcentaje: number;
  cupon: string | null;
  pagado: number;
  saldo: number;
  notasCocina: string;
  tiempoEstimadoMin: number;
  facturaSolicitada: boolean;
  calificado: boolean;
  motivoCancelacion: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface Cotizacion extends ResumenPedido {
  cupon: string | null;
  descuentoPorcentaje: number;
  impuestoPorcentaje: number;
  tiempoEstimadoMin: number;
}
