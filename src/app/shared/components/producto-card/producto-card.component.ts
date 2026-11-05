import { Component, inject, input, output } from '@angular/core';
import { LucideFlame, LucideHeart, LucideLeaf, LucideSettings, LucideWheatOff } from '@lucide/angular';
import { Producto } from '../../../models/producto.model';
import { PrecioCopPipe } from '../../pipes/precio-cop.pipe';
import { FavoritosService } from '../../../core/services/favoritos.service';

@Component({
  selector: 'app-producto-card',
  imports: [PrecioCopPipe, LucideSettings, LucideLeaf, LucideWheatOff, LucideFlame, LucideHeart],
  template: `
    <article
      class="group flex h-full flex-col overflow-hidden rounded-2xl border border-brasa-border bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-soft"
    >
      <div class="relative aspect-[4/3] overflow-hidden bg-brasa-gray-light">
        <button
          type="button"
          class="absolute inset-0 h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
          (click)="abrirDetalle.emit(producto())"
          [attr.aria-label]="'Personalizar ' + producto().nombre"
        >
        <img
          [src]="producto().imagenUrl"
          [alt]="producto().nombre"
          width="600"
          height="480"
          loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />

        @if (producto().etiquetas.length > 0) {
          <div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
            @for (etiqueta of producto().etiquetas; track etiqueta) {
              <span
                class="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-brasa-black shadow-card"
              >
                @switch (etiqueta) {
                  @case ('vegetariano') {
                    <svg lucideLeaf [size]="13" class="text-green-600"></svg>
                    Vegetariano
                  }
                  @case ('sin-gluten') {
                    <svg lucideWheatOff [size]="13" class="text-amber-600"></svg>
                    Sin gluten
                  }
                  @case ('mas-vendido') {
                    <svg lucideFlame [size]="13" class="text-brasa-orange"></svg>
                    Más vendido
                  }
                }
              </span>
            }
          </div>
        }
        </button>

        <button
          type="button"
          class="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-card transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
          [attr.aria-label]="favoritos.esFavorito(producto().id) ? 'Quitar de favoritos' : 'Agregar a favoritos'"
          (click)="$event.stopPropagation(); favoritos.alternar(producto().id)"
        >
          <svg
            lucideHeart
            [size]="18"
            [attr.fill]="favoritos.esFavorito(producto().id) ? '#FF6B00' : 'none'"
            [attr.stroke]="favoritos.esFavorito(producto().id) ? '#FF6B00' : '#1A1A1A'"
            [strokeWidth]="1.8"
          ></svg>
        </button>
      </div>

      <div class="flex flex-1 flex-col p-5">
        <button
          type="button"
          class="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
          (click)="abrirDetalle.emit(producto())"
        >
          <h3 class="font-heading text-base font-semibold text-brasa-black">{{ producto().nombre }}</h3>
          <p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-brasa-muted">
            {{ producto().descripcion }}
          </p>
        </button>

        <div class="mt-auto flex items-center justify-between gap-3 pt-4">
          <span class="font-heading text-lg font-bold text-brasa-black">
            {{ producto().precio | precioCop }}
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl bg-brasa-orange px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2"
            [attr.aria-label]="'Personalizar ' + producto().nombre"
            (click)="abrirDetalle.emit(producto())"
          >
            <svg lucideSettings [size]="16" [strokeWidth]="2"></svg>
            Personalizar
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductoCardComponent {
  protected readonly favoritos = inject(FavoritosService);

  readonly producto = input.required<Producto>();
  readonly abrirDetalle = output<Producto>();
  readonly agregar = output<Producto>();
}
