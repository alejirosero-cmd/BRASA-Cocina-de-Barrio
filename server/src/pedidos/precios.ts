/**
 * Cálculo de precios del pedido. Función pura: no confía en ningún precio enviado por el cliente,
 * todo se recalcula a partir del catálogo guardado en la base de datos.
 */
import { IngredienteRetirable, OpcionExtra, OpcionTamano } from '../catalogo/catalogo.service';

export interface ProductoParaPrecio {
  slug: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  tiempoPreparacionMin: number;
  tamanos: OpcionTamano[];
  extras: OpcionExtra[];
  salsas: OpcionExtra[];
  retirables: IngredienteRetirable[];
}

export interface ItemSolicitado {
  productoId: string;
  cantidad: number;
  tamanoId?: string | null;
  extras?: string[];
  salsas?: string[];
  /** Ids o nombres de los ingredientes a retirar. */
  retirados?: string[];
  instrucciones?: string;
}

export interface PersonalizacionValidada {
  tamano?: OpcionTamano;
  extras: OpcionExtra[];
  salsas: OpcionExtra[];
  retirados: string[];
  instrucciones: string;
}

export interface LineaCalculada {
  productoSlug: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  personalizacion: PersonalizacionValidada;
}

export interface Totales {
  subtotal: number;
  descuento: number;
  impuestos: number;
  propina: number;
  total: number;
}

export class ErrorDePedido extends Error {}

export const CANTIDAD_MAX_POR_ITEM = 20;
export const ITEMS_MAX_POR_PEDIDO = 30;

function elegir<T extends { id: string }>(disponibles: T[], ids: string[] | undefined, grupo: string, producto: string): T[] {
  const unicos = [...new Set(ids ?? [])];
  return unicos.map((id) => {
    const opcion = disponibles.find((o) => o.id === id);
    if (!opcion) throw new ErrorDePedido(`La opción "${id}" no existe en ${grupo} de ${producto}`);
    return opcion;
  });
}

export function calcularLinea(producto: ProductoParaPrecio, item: ItemSolicitado): LineaCalculada {
  if (!producto.disponible) {
    throw new ErrorDePedido(`${producto.nombre} no está disponible en este momento`);
  }
  if (!Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > CANTIDAD_MAX_POR_ITEM) {
    throw new ErrorDePedido(`La cantidad de ${producto.nombre} debe estar entre 1 y ${CANTIDAD_MAX_POR_ITEM}`);
  }

  let tamano: OpcionTamano | undefined;
  if (producto.tamanos.length > 0) {
    tamano = item.tamanoId
      ? producto.tamanos.find((t) => t.id === item.tamanoId)
      : producto.tamanos[0];
    if (!tamano) throw new ErrorDePedido(`El tamaño "${item.tamanoId}" no existe para ${producto.nombre}`);
  } else if (item.tamanoId) {
    throw new ErrorDePedido(`${producto.nombre} no tiene tamaños`);
  }

  const extras = elegir(producto.extras, item.extras, 'los extras', producto.nombre);
  const salsas = elegir(producto.salsas, item.salsas, 'las salsas', producto.nombre);
  const retirados = [...new Set(item.retirados ?? [])].map((valor) => {
    const r = producto.retirables.find((x) => x.id === valor || x.nombre === valor);
    if (!r) throw new ErrorDePedido(`"${valor}" no se puede retirar de ${producto.nombre}`);
    return r.nombre;
  });

  const precioUnitario =
    producto.precio +
    (tamano?.diferenciaPrecio ?? 0) +
    extras.reduce((s, e) => s + e.precio, 0) +
    salsas.reduce((s, e) => s + e.precio, 0);

  if (precioUnitario < 0) throw new ErrorDePedido(`Precio inválido para ${producto.nombre}`);

  return {
    productoSlug: producto.slug,
    nombre: producto.nombre,
    precioUnitario,
    cantidad: item.cantidad,
    personalizacion: {
      tamano,
      extras,
      salsas,
      retirados,
      instrucciones: (item.instrucciones ?? '').trim(),
    },
  };
}

/**
 * Misma fórmula que usaba el carrito del frontend:
 * base = subtotal − descuento; impuestos y propina se calculan sobre la base.
 */
export function calcularTotales(
  lineas: { precioUnitario: number; cantidad: number }[],
  descuentoPorcentaje: number,
  impuestoPorcentaje: number,
  propinaPorcentaje: number,
): Totales {
  const subtotal = lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0);
  const descuento = Math.round((subtotal * descuentoPorcentaje) / 100);
  const base = subtotal - descuento;
  const impuestos = Math.round((base * impuestoPorcentaje) / 100);
  const propina = Math.round((base * propinaPorcentaje) / 100);
  return { subtotal, descuento, impuestos, propina, total: base + impuestos + propina };
}

/** Tiempo estimado: el plato más demorado más 2 minutos por cada unidad adicional (máx. 90). */
export function estimarTiempo(productos: ProductoParaPrecio[], lineas: LineaCalculada[]): number {
  const maximo = Math.max(...lineas.map((l) => productos.find((p) => p.slug === l.productoSlug)?.tiempoPreparacionMin ?? 15));
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  return Math.min(90, maximo + 2 * (unidades - 1));
}
