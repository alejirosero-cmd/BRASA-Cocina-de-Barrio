import { Injectable, computed, signal } from '@angular/core';
import { CalificacionPedido } from '../../models/pedido.model';

const STORAGE_KEY = 'brasa.calificaciones';

@Injectable({ providedIn: 'root' })
export class CalificacionesService {
  private readonly calificaciones = signal<CalificacionPedido[]>(this.cargar());

  readonly lista = this.calificaciones.asReadonly();
  readonly cantidad = computed(() => this.calificaciones().length);

  constructor() {
    // Guardar en localStorage cuando cambie
    const original = this.calificaciones.set.bind(this.calificaciones);
    // Usar efecto simple: actualizamos manualmente al guardar
  }

  guardar(calificacion: Omit<CalificacionPedido, 'id' | 'fecha'>): CalificacionPedido {
    const nueva: CalificacionPedido = {
      ...calificacion,
      id: `CAL-${Date.now().toString(36).toUpperCase()}`,
      fecha: new Date().toISOString(),
    };
    this.calificaciones.update((actuales) => [nueva, ...actuales]);
    this.guardarEnStorage();
    return nueva;
  }

  yaCalificado(pedidoId: string): boolean {
    return this.calificaciones().some((c) => c.pedidoId === pedidoId);
  }

  obtenerPorPedido(pedidoId: string): CalificacionPedido | undefined {
    return this.calificaciones().find((c) => c.pedidoId === pedidoId);
  }

  private guardarEnStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.calificaciones()));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  private cargar(): CalificacionPedido[] {
    try {
      const crudo = localStorage.getItem(STORAGE_KEY);
      if (!crudo) {
        return [];
      }
      const parseado = JSON.parse(crudo);
      return Array.isArray(parseado) ? (parseado as CalificacionPedido[]) : [];
    } catch {
      return [];
    }
  }
}
