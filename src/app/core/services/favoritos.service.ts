import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'brasa.favoritos';

@Injectable({ providedIn: 'root' })
export class FavoritosService {
  private readonly favoritos = signal<string[]>(this.cargar());

  readonly ids = this.favoritos.asReadonly();
  readonly cantidad = computed(() => this.favoritos().length);

  esFavorito(id: string): boolean {
    return this.favoritos().includes(id);
  }

  alternar(id: string): void {
    this.favoritos.update((actuales) => {
      if (actuales.includes(id)) {
        return actuales.filter((f) => f !== id);
      }
      return [...actuales, id];
    });
    this.guardar();
  }

  agregar(id: string): void {
    if (this.esFavorito(id)) return;
    this.favoritos.update((actuales) => [...actuales, id]);
    this.guardar();
  }

  quitar(id: string): void {
    this.favoritos.update((actuales) => actuales.filter((f) => f !== id));
    this.guardar();
  }

  private guardar(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favoritos()));
    } catch {
      // ignorar
    }
  }

  private cargar(): string[] {
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
