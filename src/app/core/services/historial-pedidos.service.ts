import { Injectable, signal } from '@angular/core';
import { Pedido } from './pedidos.service';

const STORAGE_KEY = 'brasa.historial-pedidos';

@Injectable({ providedIn: 'root' })
export class HistorialPedidosService {
  private readonly historial = signal<Pedido[]>(this.cargar());

  readonly lista = this.historial.asReadonly();

  agregar(pedido: Pedido): void {
    this.historial.update((actuales) => {
      const sinDuplicado = actuales.filter((p) => p.id !== pedido.id);
      return [pedido, ...sinDuplicado].slice(0, 20);
    });
    this.guardar();
  }

  limpiar(): void {
    this.historial.set([]);
    this.guardar();
  }

  private guardar(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.historial()));
    } catch {
      // ignorar
    }
  }

  private cargar(): Pedido[] {
    try {
      const crudo = localStorage.getItem(STORAGE_KEY);
      if (!crudo) return [];
      const parseado = JSON.parse(crudo);
      return Array.isArray(parseado) ? parseado : [];
    } catch {
      return [];
    }
  }
}
