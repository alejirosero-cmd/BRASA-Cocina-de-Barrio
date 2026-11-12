import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, mensajeError } from '../../../core/services/api.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { ProductosService } from '../../../core/services/productos.service';

interface ProductoDisponibilidad {
  id: string;
  nombre: string;
  categoria: string;
  imagenUrl: string;
  disponible: boolean;
}

/**
 * Disponibilidad del menú para cocina y meseros: marcar un producto como agotado lo oculta
 * del menú de los clientes al instante, y se vuelve a activar con un toque.
 */
@Component({
  selector: 'app-panel-agotados',
  template: `
    <details class="group rounded-2xl border border-brasa-border bg-white shadow-card" (toggle)="alAbrir($event)">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span>
          <span class="font-heading text-base font-semibold text-brasa-black">Disponibilidad del menú</span>
          <span class="ml-2 text-sm text-brasa-muted">
            @if (cargado()) {
              {{ agotados().length === 0 ? 'Todo disponible' : agotados().length + ' agotado' + (agotados().length === 1 ? '' : 's') }}
            } @else {
              Toca para ver y marcar productos agotados
            }
          </span>
        </span>
        <span class="text-sm font-semibold text-brasa-orange group-open:hidden">Abrir</span>
        <span class="hidden text-sm font-semibold text-brasa-orange group-open:inline">Cerrar</span>
      </summary>

      <div class="border-t border-brasa-border px-5 py-4">
        <input
          type="search"
          class="w-full rounded-xl border border-brasa-border px-4 py-2.5 text-sm outline-none focus:border-brasa-orange"
          placeholder="Buscar producto..."
          aria-label="Buscar producto"
          [value]="busqueda()"
          (input)="busqueda.set($any($event.target).value)"
        />
        @if (error()) {
          <p class="mt-3 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <ul class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          @for (p of filtrados(); track p.id) {
            <li class="flex items-center gap-3 rounded-xl border px-3 py-2" [class]="p.disponible ? 'border-brasa-border' : 'border-red-200 bg-red-50'">
              <img [src]="p.imagenUrl" alt="" width="40" height="40" class="h-10 w-10 shrink-0 rounded-lg object-cover" [class.grayscale]="!p.disponible" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-brasa-black">{{ p.nombre }}</span>
                <span class="text-xs" [class]="p.disponible ? 'text-green-700' : 'font-semibold text-red-600'">
                  {{ p.disponible ? 'Disponible' : 'Agotado' }}
                </span>
              </span>
              <button
                type="button"
                class="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                [class]="p.disponible ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-600 bg-green-600 text-white hover:bg-green-700'"
                [disabled]="ocupado() === p.id"
                (click)="alternar(p)"
              >
                {{ p.disponible ? 'Marcar agotado' : 'Volver a ofrecer' }}
              </button>
            </li>
          } @empty {
            <li class="text-sm text-brasa-muted">{{ cargado() ? 'Sin resultados.' : 'Cargando...' }}</li>
          }
        </ul>
      </div>
    </details>
  `,
})
export class PanelAgotadosComponent {
  private readonly api = inject(ApiService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly menu = inject(ProductosService);

  private readonly productos = signal<ProductoDisponibilidad[]>([]);
  protected readonly cargado = signal(false);
  protected readonly busqueda = signal('');
  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal('');

  protected readonly agotados = computed(() => this.productos().filter((p) => !p.disponible));
  /** Primero los agotados, luego el resto por nombre. */
  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    return this.productos()
      .filter((p) => !termino || p.nombre.toLowerCase().includes(termino))
      .sort((a, b) => Number(a.disponible) - Number(b.disponible) || a.nombre.localeCompare(b.nombre));
  });

  protected alAbrir(evento: Event): void {
    if ((evento.target as HTMLDetailsElement).open && !this.cargado()) this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.productos.set(await firstValueFrom(this.api.get<ProductoDisponibilidad[]>('/productos/admin/todos')));
      this.cargado.set(true);
      this.error.set('');
    } catch (e) {
      this.error.set(mensajeError(e, 'No se pudo cargar el menú.'));
    }
  }

  protected async alternar(p: ProductoDisponibilidad): Promise<void> {
    this.ocupado.set(p.id);
    try {
      const disponible = !p.disponible;
      await firstValueFrom(this.api.patch(`/productos/${p.id}/disponibilidad`, { disponible }));
      this.productos.update((lista) => lista.map((x) => (x.id === p.id ? { ...x, disponible } : x)));
      this.notificaciones.mostrar(disponible ? `${p.nombre} vuelve a estar en el menú` : `${p.nombre} marcado como agotado`);
      this.menu.cargarDesdeApi();
    } catch (e) {
      this.notificaciones.mostrar(mensajeError(e), 'error');
    } finally {
      this.ocupado.set(null);
    }
  }
}
