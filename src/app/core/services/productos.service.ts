import { Injectable, computed, inject, signal } from '@angular/core';
import { Categoria, EtiquetaProducto, Producto } from '../../models/producto.model';
import { CATEGORIAS, PRODUCTOS } from '../data/productos.data';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface FiltrosMenu {
  categoria: string;
  busqueda: string;
  etiquetas: EtiquetaProducto[];
}

const FILTROS_INICIALES: FiltrosMenu = {
  categoria: 'populares',
  busqueda: '',
  etiquetas: [],
};

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly api = inject(ApiService);

  private readonly productos = signal<Producto[]>(PRODUCTOS);
  private readonly filtros = signal<FiltrosMenu>(FILTROS_INICIALES);

  readonly categorias: Categoria[] = CATEGORIAS;
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly lista = this.productos.asReadonly();
  readonly estadoFiltros = this.filtros.asReadonly();

  constructor() {
    if (environment.integracionActiva) {
      this.cargarDesdeApi();
    }
  }

  async cargarDesdeApi(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [productos, categorias] = await Promise.all([
        firstValueFrom(this.api.get<any[]>('/productos')),
        firstValueFrom(this.api.get<any[]>('/productos/categorias'))
      ]);
      if (productos?.length) {
        const normalizados = productos.map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio: p.precio,
          categoria: p.categoria?.slug || p.categoriaId || p.categoria,
          imagenUrl: p.imagenUrl,
          etiquetas: Array.isArray(p.etiquetas) ? p.etiquetas : JSON.parse(p.etiquetas || '[]'),
          ingredientes: p.ingredientes || [],
          tamanos: Array.isArray(p.tamanos) ? p.tamanos : JSON.parse(p.tamanos || '[]'),
          extras: Array.isArray(p.extras) ? p.extras : JSON.parse(p.extras || '[]'),
          salsas: Array.isArray(p.salsas) ? p.salsas : JSON.parse(p.salsas || '[]'),
          retirables: Array.isArray(p.retirables) ? p.retirables : JSON.parse(p.retirables || '[]'),
          tiempoPreparacionMin: p.tiempoPreparacionMin || 15,
        })) as Producto[];
        this.productos.set(normalizados);
      }
      if (categorias?.length) {
        (this as any).categorias = categorias.map((c: any) => ({
          id: c.slug || c.id,
          nombre: c.nombre
        }));
      }
    } catch (err) {
      console.error('Error al cargar desde API, usando datos locales', err);
      this.error.set('No se pudo conectar con la API');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Productos que coinciden con la búsqueda y los filtros, limitados a la categoría activa. */
  readonly productosFiltrados = computed<Producto[]>(() => {
    const { categoria, busqueda, etiquetas } = this.filtros();
    const termino = busqueda.trim().toLowerCase();

    return this.productos().filter((producto) => {
      const coincideCategoria =
        categoria === 'populares'
          ? producto.etiquetas.includes('mas-vendido')
          : producto.categoria === categoria;

      const coincideBusqueda =
        termino.length === 0 ||
        producto.nombre.toLowerCase().includes(termino) ||
        producto.descripcion.toLowerCase().includes(termino) ||
        (producto.ingredientes || []).some((ing) => ing.toLowerCase().includes(termino));

      const coincideEtiquetas =
        etiquetas.length === 0 || etiquetas.every((etiqueta) => producto.etiquetas.includes(etiqueta));

      return coincideCategoria && coincideBusqueda && coincideEtiquetas;
    });
  });

  obtenerPorId(id: string): Producto | undefined {
    return this.productos().find((producto) => producto.id === id);
  }

  establecerCategoria(categoria: string): void {
    this.filtros.update((actuales) => ({ ...actuales, categoria }));
  }

  establecerBusqueda(busqueda: string): void {
    this.filtros.update((actuales) => ({ ...actuales, busqueda }));
  }

  alternarEtiqueta(etiqueta: EtiquetaProducto): void {
    this.filtros.update((actuales) => {
      const activa = actuales.etiquetas.includes(etiqueta);
      return {
        ...actuales,
        etiquetas: activa
          ? actuales.etiquetas.filter((e) => e !== etiqueta)
          : [...actuales.etiquetas, etiqueta],
      };
    });
  }

  limpiarFiltros(): void {
    this.filtros.set(FILTROS_INICIALES);
  }
}
