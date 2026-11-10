import { EstadoPedido, Rol } from '../common/dominio';

/**
 * Máquina de estados del pedido:
 *   PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → ENTREGADO
 *   (PENDIENTE | CONFIRMADO) → CANCELADO
 * Para cada transición se indica qué roles del personal pueden ejecutarla.
 * El cliente solo puede cancelar su propio pedido mientras está PENDIENTE (ver PedidosService).
 */
export const TRANSICIONES: Record<EstadoPedido, Partial<Record<EstadoPedido, Rol[]>>> = {
  PENDIENTE: { CONFIRMADO: ['ADMIN', 'MESERO', 'COCINA'], CANCELADO: ['ADMIN', 'MESERO'] },
  CONFIRMADO: { EN_PREPARACION: ['ADMIN', 'COCINA'], CANCELADO: ['ADMIN', 'MESERO'] },
  EN_PREPARACION: { LISTO: ['ADMIN', 'COCINA'] },
  LISTO: { ENTREGADO: ['ADMIN', 'MESERO'] },
  ENTREGADO: {},
  CANCELADO: {},
};

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido, rol: Rol): boolean {
  return TRANSICIONES[desde]?.[hacia]?.includes(rol) ?? false;
}
