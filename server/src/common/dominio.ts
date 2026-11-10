/** Valores del dominio que SQLite guarda como texto. Única fuente de verdad del backend. */

export const ROLES = ['ADMIN', 'CLIENTE', 'MESERO', 'COCINA'] as const;
export type Rol = (typeof ROLES)[number];

export const ROLES_PERSONAL: Rol[] = ['ADMIN', 'MESERO', 'COCINA'];

export const ESTADOS_PEDIDO = [
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'LISTO',
  'ENTREGADO',
  'CANCELADO',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ESTADOS_ACTIVOS: EstadoPedido[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO'];

export type EstadoPagoPedido = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'REEMBOLSADO';

export const ESTADOS_PAGO = [
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO',
  'ANULADO',
  'ERROR',
  'REEMBOLSO_SOLICITADO',
  'REEMBOLSADO',
] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const ESTADOS_PAGO_FINALES: EstadoPago[] = ['APROBADO', 'RECHAZADO', 'ANULADO', 'ERROR'];

export const TIPOS_PEDIDO = ['mesa', 'llevar'] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

export const MOTIVOS_SOLICITUD = ['cuenta', 'utensilios', 'ayuda'] as const;
export type MotivoSolicitud = (typeof MOTIVOS_SOLICITUD)[number];
