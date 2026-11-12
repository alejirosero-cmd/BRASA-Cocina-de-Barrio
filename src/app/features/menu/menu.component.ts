import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideFlame,
  LucideFlameKindling,
  LucideHeart,
  LucideLeaf,
  LucideSearch,
  LucideSlidersHorizontal,
  LucideUsers,
  LucideWheatOff,
} from '@lucide/angular';
import { CarritoService } from '../../core/services/carrito.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ProductosService } from '../../core/services/productos.service';
import { Producto } from '../../models/producto.model';
import { EtiquetaProducto } from '../../models/producto.model';
import { CarritoPanelComponent } from '../../shared/components/carrito-panel/carrito-panel.component';
import { ProductoCardComponent } from '../../shared/components/producto-card/producto-card.component';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';
import { ProductoDetalleComponent } from '../../shared/components/producto-detalle/producto-detalle.component';
import { FavoritosService } from '../../core/services/favoritos.service';
import { AuthService } from '../../core/services/auth.service';
import { MesaService } from '../../core/services/mesa.service';

@Component({
  selector: 'app-menu',
  imports: [
    FormsModule,
    RouterLink,
    ProductoCardComponent,
    CarritoPanelComponent,
    PrecioCopPipe,
    ProductoDetalleComponent,
    LucideSearch,
    LucideSlidersHorizontal,
    LucideLeaf,
    LucideWheatOff,
    LucideFlame,
    LucideFlameKindling,
    LucideUsers,
    LucideHeart,
  ],
  template: `
    @if (auth.esPersonal() && mesa.codigo()) {
      <!-- Un mesero está tomando el pedido por el cliente. -->
      <div class="bg-brasa-black text-white">
        <div class="mx-auto flex max-w-[1760px] flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm md:px-10 xl:px-20">
          <p><strong>Tomando pedido para la {{ mesa.etiqueta() }}.</strong> Agrega los productos y envíalo desde el carrito.</p>
          <a routerLink="/mesero" class="font-semibold text-brasa-orange hover:underline">Volver a Meseros</a>
        </div>
      </div>
    }

    <section class="mx-auto max-w-[1760px] px-5 pb-5 pt-8 md:px-10 md:pt-10 xl:px-20">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black sm:text-4xl">
            Menú digital
          </h1>
          <p class="mt-2 text-sm text-brasa-muted sm:text-base">
            Busca, filtra y personaliza tu pedido para enviarlo directo a cocina.
          </p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div
          class="flex w-full items-center gap-3 rounded-2xl border border-brasa-border bg-white px-4 py-3 shadow-card"
        >
          <svg lucideSearch [size]="18" class="text-brasa-muted"></svg>
          <input
            type="search"
            class="w-full bg-transparent text-sm outline-none placeholder:text-brasa-muted"
            placeholder="Buscar por nombre, ingrediente o descripción..."
            [ngModel]="productos.estadoFiltros().busqueda"
            (ngModelChange)="productos.establecerBusqueda($event)"
            aria-label="Buscar en el menú"
          />
        </div>

        <div
          class="sin-barra -mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 md:-mx-10 md:px-10 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0"
          role="group"
          aria-label="Filtros del menú"
        >
          @for (etiqueta of opcionesEtiqueta; track etiqueta.id) {
            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition"
              [class]="
                estaActiva(etiqueta.id)
                  ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black'
                  : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'
              "
              [attr.aria-pressed]="estaActiva(etiqueta.id)"
              (click)="productos.alternarEtiqueta(etiqueta.id)"
            >
              @switch (etiqueta.id) {
                @case ('vegetariano') {
                  <svg lucideLeaf [size]="15" class="text-green-600"></svg>
                }
                @case ('sin-gluten') {
                  <svg lucideWheatOff [size]="15" class="text-amber-600"></svg>
                }
                @case ('mas-vendido') {
                  <svg lucideFlame [size]="15" class="text-brasa-orange"></svg>
                }
                @case ('picante') {
                  <svg lucideFlameKindling [size]="15" class="text-red-600"></svg>
                }
                @case ('para-compartir') {
                  <svg lucideUsers [size]="15" class="text-sky-600"></svg>
                }
              }
              {{ etiqueta.titulo }}
            </button>
          }
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition"
            [attr.aria-pressed]="soloFavoritos()"
            [class]="soloFavoritos() ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black' : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'"
            (click)="soloFavoritos.set(!soloFavoritos())"
          >
            <svg lucideHeart [size]="15"></svg>
            Favoritos
          </button>
          @if (filtrosActivos() > 0) {
            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-brasa-orange hover:text-brasa-orange-dark sm:text-sm"
              (click)="limpiar()"
            >
              <svg lucideSlidersHorizontal [size]="16"></svg>
              Quitar filtros ({{ filtrosActivos() }})
            </button>
          }
        </div>
      </div>
    </section>

    <!-- Categorías: franja fija bajo el encabezado, con foto, que se desliza en el celular. -->
    <nav
      class="sticky top-20 z-30 border-y border-brasa-border bg-white/95 backdrop-blur"
      aria-label="Categorías del menú"
    >
      <div
        class="sin-barra mx-auto flex max-w-[1760px] snap-x scroll-px-5 gap-2 overflow-x-auto px-5 py-3 md:scroll-px-10 md:px-10 xl:scroll-px-20 xl:px-20"
      >
        @for (categoria of productos.categorias(); track categoria.id) {
          <button
            type="button"
            class="group inline-flex shrink-0 snap-start items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold whitespace-nowrap transition"
            [class]="
              productos.estadoFiltros().categoria === categoria.id
                ? 'bg-brasa-black text-white shadow-soft'
                : 'border border-brasa-border bg-white text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'
            "
            [attr.aria-pressed]="productos.estadoFiltros().categoria === categoria.id"
            (click)="elegirCategoria(categoria.id)"
          >
            @if (fotoCategoria()[categoria.id]; as foto) {
              <img [src]="foto" alt="" width="32" height="32" class="h-8 w-8 rounded-full object-cover" />
            } @else {
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brasa-orange text-white">
                <svg lucideFlame [size]="16"></svg>
              </span>
            }
            {{ categoria.id === 'populares' ? 'Todo el menú' : categoria.nombre }}
            <span class="text-xs font-normal opacity-70">{{ conteoPorCategoria()[categoria.id] ?? 0 }}</span>
          </button>
        }
      </div>
    </nav>

    <section id="productos" class="mx-auto max-w-[1760px] scroll-mt-36 px-5 pb-28 pt-8 md:px-10 lg:pb-12 xl:px-20">
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div class="lg:col-span-8 xl:col-span-8">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="font-heading text-xl font-semibold text-brasa-black">
                {{ tituloCategoria() }}
              </h2>
              <p class="mt-1 text-sm text-brasa-muted">
                Mostrando {{ productosMostrados().length }} productos
                @if (productos.cargando()) {
                  <span role="status"> · actualizando menú...</span>
                }
              </p>
            </div>
            <label class="flex items-center gap-2 text-sm text-brasa-muted">
              Ordenar
              <select
                class="rounded-xl border border-brasa-border bg-white px-3 py-2 text-sm text-brasa-black outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                [ngModel]="orden()"
                (ngModelChange)="orden.set($event)"
                aria-label="Ordenar productos"
              >
                <option value="recomendados">Recomendados</option>
                <option value="menor-precio">Menor precio</option>
                <option value="mayor-precio">Mayor precio</option>
                <option value="mas-rapido">Más rápido</option>
              </select>
            </label>
          </div>
          @if (productos.error()) {
            <p class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
              {{ productos.error() }}
            </p>
          }

          @if (productosMostrados().length === 0) {
            <div class="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brasa-border px-6 py-16 text-center">
              <p class="font-heading text-base font-semibold text-brasa-black">
                No encontramos productos con esos filtros
              </p>
              <p class="text-sm text-brasa-muted">
                Ajusta la búsqueda, las etiquetas o quita el filtro de favoritos.
              </p>
              <button
                type="button"
                class="mt-2 rounded-xl border border-brasa-border px-5 py-2.5 text-sm font-semibold text-brasa-black transition hover:bg-brasa-gray-light"
                (click)="limpiar()"
              >
                Limpiar filtros
              </button>
            </div>
          } @else if (secciones().length > 0) {
            <!-- "Todo el menú" sin filtros: una sección por categoría, como la carta de un restaurante. -->
            @for (grupo of secciones(); track grupo.id) {
              <section class="mt-10 first:mt-6 scroll-mt-40" [attr.aria-labelledby]="'seccion-' + grupo.id">
                <div class="flex items-baseline justify-between gap-3 border-b border-brasa-border pb-3">
                  <h3 [id]="'seccion-' + grupo.id" class="font-heading text-lg font-bold text-brasa-black sm:text-xl">
                    {{ grupo.nombre }}
                    <span class="ml-1 text-sm font-medium text-brasa-muted">{{ grupo.productos.length }}</span>
                  </h3>
                  <button
                    type="button"
                    class="shrink-0 text-sm font-semibold text-brasa-orange hover:text-brasa-orange-dark"
                    (click)="elegirCategoria(grupo.id)"
                  >
                    Ver solo {{ grupo.nombre.toLowerCase() }}
                  </button>
                </div>
                <div class="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  @for (producto of grupo.productos; track producto.id) {
                    <app-producto-card [producto]="producto" (abrirDetalle)="abrirDetalle(producto)"></app-producto-card>
                  }
                </div>
              </section>
            }
          } @else {
            <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              @for (producto of productosMostrados(); track producto.id) {
                <app-producto-card
                  [producto]="producto"
                  (abrirDetalle)="abrirDetalle(producto)"
                ></app-producto-card>
              }
            </div>
          }
        </div>

        <div class="lg:col-span-4 xl:col-span-4">
          <div class="hidden lg:block lg:sticky lg:top-40">
            <app-carrito-panel></app-carrito-panel>
          </div>
        </div>
      </div>
    </section>

    @if (!carrito.estaVacio()) {
      <div class="fixed inset-x-0 bottom-0 z-40 border-t border-brasa-border bg-white px-5 py-3 shadow-lg lg:hidden">
        <div class="mx-auto flex max-w-[1760px] items-center justify-between">
          <div>
            <p class="text-xs text-brasa-muted">{{ carrito.cantidadTotal() }} ítems</p>
            <p class="font-heading text-lg font-bold text-brasa-black">
              {{ carrito.total() | precioCop }}
            </p>
          </div>
          <a
            routerLink="/carrito"
            class="flex items-center gap-2 rounded-xl bg-brasa-orange px-5 py-3 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark"
          >
            Ver carrito
          </a>
        </div>
      </div>
    }

    <app-producto-detalle
      [producto]="productoSeleccionado()"
      [abierto]="detalleAbierto()"
      (cerrar)="cerrarDetalle()"
    ></app-producto-detalle>
  `,
})
export class MenuComponent {
  protected readonly productos = inject(ProductosService);
  protected readonly carrito = inject(CarritoService);
  protected readonly notificaciones = inject(NotificacionesService);
  protected readonly favoritos = inject(FavoritosService);
  protected readonly auth = inject(AuthService);
  protected readonly mesa = inject(MesaService);

  protected readonly productoSeleccionado = signal<Producto | null>(null);
  protected readonly detalleAbierto = signal(false);
  protected readonly soloFavoritos = signal(false);
  protected readonly orden = signal<'recomendados' | 'menor-precio' | 'mayor-precio' | 'mas-rapido'>('recomendados');

  protected readonly productosMostrados = computed(() => {
    let lista = this.productos.productosFiltrados();
    if (this.soloFavoritos()) lista = lista.filter((p) => this.favoritos.esFavorito(p.id));
    switch (this.orden()) {
      case 'menor-precio':
        return [...lista].sort((a, b) => a.precio - b.precio);
      case 'mayor-precio':
        return [...lista].sort((a, b) => b.precio - a.precio);
      case 'mas-rapido':
        return [...lista].sort((a, b) => a.tiempoPreparacionMin - b.tiempoPreparacionMin);
      default:
        // Recomendados: los más vendidos primero, sin alterar el resto del orden.
        return [...lista].sort(
          (a, b) => Number(b.etiquetas.includes('mas-vendido')) - Number(a.etiquetas.includes('mas-vendido')),
        );
    }
  });

  /** Cuántos productos hay en cada categoría (para mostrarlo en los botones). */
  protected readonly conteoPorCategoria = computed(() => {
    const conteo: Record<string, number> = { populares: this.productos.lista().length };
    for (const p of this.productos.lista()) conteo[p.categoria] = (conteo[p.categoria] ?? 0) + 1;
    return conteo;
  });

  protected readonly opcionesEtiqueta: { id: EtiquetaProducto; titulo: string }[] = [
    { id: 'mas-vendido', titulo: 'Más vendidos' },
    { id: 'vegetariano', titulo: 'Vegetariano' },
    { id: 'sin-gluten', titulo: 'Sin gluten' },
    { id: 'picante', titulo: 'Picante' },
    { id: 'para-compartir', titulo: 'Para compartir' },
  ];

  /** Foto de cada categoría: la del primer producto (preferiblemente un más vendido). */
  protected readonly fotoCategoria = computed(() => {
    const lista = this.productos.lista();
    const fotos: Record<string, string> = {};
    for (const c of this.productos.categorias()) {
      const deLaCategoria = lista.filter((p) => p.categoria === c.id);
      const elegido = deLaCategoria.find((p) => p.etiquetas.includes('mas-vendido')) ?? deLaCategoria[0];
      if (elegido) fotos[c.id] = elegido.imagenUrl;
    }
    return fotos;
  });

  protected readonly filtrosActivos = computed(
    () => this.productos.estadoFiltros().etiquetas.length + (this.soloFavoritos() ? 1 : 0),
  );

  /**
   * Con "Todo el menú" y sin búsqueda ni filtros, el menú se muestra por secciones (una por categoría).
   * En cualquier otro caso se devuelve una lista vacía y se usa la cuadrícula normal.
   */
  protected readonly secciones = computed(() => {
    const { categoria, busqueda } = this.productos.estadoFiltros();
    if (categoria !== 'populares' || busqueda.trim() || this.filtrosActivos() > 0 || this.orden() !== 'recomendados') {
      return [];
    }
    const lista = this.productosMostrados();
    return this.productos
      .categorias()
      .filter((c) => c.id !== 'populares')
      .map((c) => ({ id: c.id, nombre: c.nombre, productos: lista.filter((p) => p.categoria === c.id) }))
      .filter((g) => g.productos.length > 0);
  });

  /** Enlaces desde el inicio: /menu?categoria=pollo o /menu?producto=doble-brasa */
  readonly categoriaInicial = input<string | undefined>(undefined, { alias: 'categoria' });
  readonly productoInicial = input<string | undefined>(undefined, { alias: 'producto' });

  constructor() {
    effect(() => {
      const categoria = this.categoriaInicial();
      if (categoria) untracked(() => this.productos.establecerCategoria(categoria));
    });
    effect(() => {
      const id = this.productoInicial();
      const encontrado = id ? this.productos.obtenerPorId(id) : undefined;
      if (encontrado) untracked(() => this.abrirDetalle(encontrado));
    });
  }

  protected tituloCategoria(): string {
    const actual = this.productos.estadoFiltros().categoria;
    if (actual === 'populares') return 'Todo el menú';
    return this.productos.categorias().find((c) => c.id === actual)?.nombre ?? 'Catálogo';
  }

  protected estaActiva(id: EtiquetaProducto): boolean {
    return this.productos.estadoFiltros().etiquetas.includes(id);
  }

  protected elegirCategoria(id: string): void {
    this.productos.establecerCategoria(id);
    // Si el cliente ya bajó por la lista, vuelve al inicio de los productos (bajo la franja de categorías).
    const seccion = document.getElementById('productos');
    if (seccion && seccion.getBoundingClientRect().top < 0) seccion.scrollIntoView({ block: 'start' });
  }

  protected limpiar(): void {
    this.productos.limpiarFiltros();
    this.soloFavoritos.set(false);
  }

  protected abrirDetalle(producto: Producto): void {
    this.productoSeleccionado.set(producto);
    this.detalleAbierto.set(true);
  }

  protected cerrarDetalle(): void {
    this.detalleAbierto.set(false);
  }
}
