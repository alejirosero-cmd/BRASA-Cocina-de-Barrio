import { Component, computed, inject, signal } from '@angular/core';
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
    <section class="mx-auto max-w-[1760px] px-5 py-10 md:px-10 xl:px-20">
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

        <div class="flex flex-wrap items-center gap-2">
          @for (etiqueta of opcionesEtiqueta; track etiqueta.id) {
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition"
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
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition"
            [class]="soloFavoritos() ? 'border-brasa-orange bg-brasa-orange/10 text-brasa-black' : 'border-brasa-border text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'"
            (click)="soloFavoritos.set(!soloFavoritos())"
          >
            <svg lucideHeart [size]="15"></svg>
            Favoritos
          </button>
          <span class="flex items-center gap-1 text-xs text-brasa-muted sm:text-sm">
            <svg lucideSlidersHorizontal [size]="16"></svg>
            Filtros activos: {{ productos.estadoFiltros().etiquetas.length + (soloFavoritos() ? 1 : 0) }}
          </span>
        </div>
      </div>

      <nav class="mt-6 flex flex-wrap gap-2" aria-label="Categorías del menú">
        @for (categoria of productos.categorias(); track categoria.id) {
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
            [class]="
              productos.estadoFiltros().categoria === categoria.id
                ? 'bg-brasa-black text-white shadow-soft'
                : 'border border-brasa-border bg-white text-brasa-muted hover:border-brasa-muted hover:text-brasa-black'
            "
            [attr.aria-pressed]="productos.estadoFiltros().categoria === categoria.id"
            (click)="productos.establecerCategoria(categoria.id)"
          >
            {{ categoria.id === 'populares' ? 'Todo el menú' : categoria.nombre }}
            <span class="text-xs font-normal opacity-70">{{ conteoPorCategoria()[categoria.id] ?? 0 }}</span>
          </button>
        }
      </nav>

      <div class="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div class="lg:col-span-8 xl:col-span-8">
          <div class="flex items-center justify-between">
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
                (click)="productos.limpiarFiltros(); soloFavoritos.set(false)"
              >
                Limpiar filtros
              </button>
            </div>
          } @else {
            <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
          <div class="hidden lg:block lg:sticky lg:top-24">
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

  protected tituloCategoria(): string {
    const actual = this.productos.estadoFiltros().categoria;
    if (actual === 'populares') return 'Todo el menú';
    return this.productos.categorias().find((c) => c.id === actual)?.nombre ?? 'Catálogo';
  }

  protected estaActiva(id: EtiquetaProducto): boolean {
    return this.productos.estadoFiltros().etiquetas.includes(id);
  }

  protected abrirDetalle(producto: Producto): void {
    this.productoSeleccionado.set(producto);
    this.detalleAbierto.set(true);
  }

  protected cerrarDetalle(): void {
    this.detalleAbierto.set(false);
  }
}
