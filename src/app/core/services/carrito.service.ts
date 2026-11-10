import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ItemCarrito, PersonalizacionItem } from '../../models/carrito.model';
import { Producto } from '../../models/producto.model';
import { CONFIGURACION } from '../config/configuracion';
import { Cotizacion } from '../../models/pedido.model';
import { ApiService, mensajeError } from './api.service';

const STORAGE_KEY = 'brasa.carrito';

export interface EntradaCarrito {
  producto: Producto;
  personalizacion: PersonalizacionItem;
  cantidad: number;
}

export function personalizacionPorDefecto(producto: Producto): PersonalizacionItem {
  return {
    tamano: producto.tamanos && producto.tamanos.length > 0 ? producto.tamanos[0] : undefined,
    extras: [],
    salsas: [],
    retirados: [],
    instrucciones: '',
  };
}

export function calcularPrecioUnitario(
  producto: Producto,
  personalizacion: PersonalizacionItem,
): number {
  const diferenciaTamano = personalizacion.tamano?.diferenciaPrecio ?? 0;
  const extras = personalizacion.extras.reduce((total, extra) => total + extra.precio, 0);
  const salsas = personalizacion.salsas.reduce((total, salsa) => total + salsa.precio, 0);
  return producto.precio + diferenciaTamano + extras + salsas;
}

function firmaPersonalizacion(personalizacion: PersonalizacionItem): string {
  return JSON.stringify({
    tamano: personalizacion.tamano?.id ?? null,
    extras: personalizacion.extras.map((e) => e.id).sort(),
    salsas: personalizacion.salsas.map((s) => s.id).sort(),
    retirados: [...personalizacion.retirados].sort(),
    instrucciones: personalizacion.instrucciones.trim(),
  });
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly api = inject(ApiService);
  /** Última cotización del servidor; mientras llega se muestra la estimación local. */
  private readonly cotizacionServidor = signal<Cotizacion | null>(null);
  readonly cotizacion = this.cotizacionServidor.asReadonly();
  readonly errorCotizacion = signal('');
  private readonly items = signal<ItemCarrito[]>(this.cargar());
  private readonly descuentoPorcentaje = signal(0);
  private readonly propinaPorcentaje = signal(CONFIGURACION.propinaSugerida);
  private readonly cuponAplicado = signal<string | null>(null);

  readonly lineas = this.items.asReadonly();
  readonly cupon = this.cuponAplicado.asReadonly();

  readonly cantidadTotal = computed(() =>
    this.items().reduce((total, item) => total + item.cantidad, 0),
  );

  readonly estaVacio = computed(() => this.items().length === 0);

  readonly subtotal = computed(() =>
    this.items().reduce((total, item) => total + item.precioUnitario * item.cantidad, 0),
  );

  readonly descuento = computed(() => Math.round(this.subtotal() * this.descuentoPorcentaje()));

  readonly baseGravable = computed(() => this.subtotal() - this.descuento());

  readonly impuestos = computed(() => Math.round(this.baseGravable() * CONFIGURACION.iva));

  readonly propina = computed(() => Math.round(this.baseGravable() * this.propinaPorcentaje()));

  readonly total = computed(() => this.baseGravable() + this.impuestos() + this.propina());

  /** Totales a mostrar: los del servidor si ya llegaron, si no la estimación local. */
  readonly resumen = computed(() =>
    this.cotizacionServidor() ?? {
      subtotal: this.subtotal(),
      descuento: this.descuento(),
      impuestos: this.impuestos(),
      propina: this.propina(),
      total: this.total(),
    },
  );

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
      } catch {
        /* almacenamiento no disponible */
      }
    });

    // Cada cambio del carrito pide al servidor el total real (con 400 ms de espera para no saturarlo).
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const vacio = this.items().length === 0;
      this.propinaPorcentaje();
      this.cuponAplicado();
      this.cotizacionServidor.set(null);
      clearTimeout(temporizador);
      if (vacio) return;
      temporizador = setTimeout(async () => {
        try {
          this.cotizacionServidor.set(await this.pedirCotizacion());
          this.errorCotizacion.set('');
        } catch (error) {
          this.errorCotizacion.set(mensajeError(error, 'No se pudo calcular el total.'));
        }
      }, 400);
    });
  }

  agregar({ producto, personalizacion, cantidad }: EntradaCarrito): void {
    const precioUnitario = calcularPrecioUnitario(producto, personalizacion);
    const firma = firmaPersonalizacion(personalizacion);

    this.items.update((actuales) => {
      const indice = actuales.findIndex(
        (item) =>
          item.productoId === producto.id &&
          firmaPersonalizacion(item.personalizacion) === firma,
      );

      if (indice >= 0) {
        const copia = [...actuales];
        copia[indice] = { ...copia[indice], cantidad: copia[indice].cantidad + cantidad };
        return copia;
      }

      const nuevo: ItemCarrito = {
        id: `${producto.id}-${firma}-${Date.now()}`,
        productoId: producto.id,
        nombre: producto.nombre,
        imagenUrl: producto.imagenUrl,
        precioBase: producto.precio,
        precioUnitario,
        cantidad,
        personalizacion,
      };
      return [...actuales, nuevo];
    });
  }

  agregarProducto(producto: Producto, cantidad = 1): void {
    this.agregar({ producto, personalizacion: personalizacionPorDefecto(producto), cantidad });
  }

  actualizarCantidad(itemId: string, cantidad: number): void {
    if (cantidad <= 0) {
      this.eliminar(itemId);
      return;
    }
    this.items.update((actuales) =>
      actuales.map((item) => (item.id === itemId ? { ...item, cantidad } : item)),
    );
  }

  incrementar(itemId: string): void {
    const item = this.items().find((i) => i.id === itemId);
    if (item) {
      this.actualizarCantidad(itemId, item.cantidad + 1);
    }
  }

  reducir(itemId: string): void {
    const item = this.items().find((i) => i.id === itemId);
    if (item) {
      this.actualizarCantidad(itemId, item.cantidad - 1);
    }
  }

  eliminar(itemId: string): void {
    this.items.update((actuales) => actuales.filter((item) => item.id !== itemId));
  }

  limpiar(): void {
    this.items.set([]);
    this.cuponAplicado.set(null);
    this.descuentoPorcentaje.set(0);
  }

  establecerPropina(porcentaje: number): void {
    this.propinaPorcentaje.set(Math.max(0, porcentaje));
  }

  porcentajePropina(): number {
    return this.propinaPorcentaje();
  }

  /**
   * Valida el cupón con el servidor (único lugar donde existen los cupones).
   * Devuelve el mensaje de error, o null si quedó aplicado.
   */
  async aplicarCupon(codigo: string): Promise<string | null> {
    const normalizado = codigo.trim().toUpperCase();
    try {
      const cotizacion = await this.pedirCotizacion(normalizado);
      this.cuponAplicado.set(normalizado);
      this.descuentoPorcentaje.set(cotizacion.descuentoPorcentaje / 100);
      this.cotizacionServidor.set(cotizacion);
      return null;
    } catch (error) {
      return mensajeError(error, 'No se pudo validar el cupón.');
    }
  }

  quitarCupon(): void {
    this.cuponAplicado.set(null);
    this.descuentoPorcentaje.set(0);
  }

  /** Ítems en el formato que espera la API: solo identificadores, nunca precios. */
  itemsParaApi() {
    return this.items().map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      ...(item.personalizacion.tamano ? { tamanoId: item.personalizacion.tamano.id } : {}),
      extras: item.personalizacion.extras.map((e) => e.id),
      salsas: item.personalizacion.salsas.map((s) => s.id),
      retirados: item.personalizacion.retirados,
      instrucciones: item.personalizacion.instrucciones,
    }));
  }

  /** Propina en porcentaje entero, como la espera la API. */
  propinaEntera(): number {
    return Math.round(this.propinaPorcentaje() * 100);
  }

  private pedirCotizacion(cupon = this.cuponAplicado()): Promise<Cotizacion> {
    return firstValueFrom(
      this.api.post<Cotizacion>('/pedidos/cotizar', {
        items: this.itemsParaApi(),
        propinaPorcentaje: this.propinaEntera(),
        ...(cupon ? { cupon } : {}),
      }),
    );
  }

  private cargar(): ItemCarrito[] {
    try {
      const crudo = localStorage.getItem(STORAGE_KEY);
      if (!crudo) {
        return [];
      }
      const parseado = JSON.parse(crudo);
      return Array.isArray(parseado) ? (parseado as ItemCarrito[]) : [];
    } catch {
      return [];
    }
  }
}
