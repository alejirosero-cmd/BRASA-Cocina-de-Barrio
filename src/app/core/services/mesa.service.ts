import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TipoPedido, UbicacionCliente } from '../../models/mesa.model';
import { ApiService } from './api.service';

const STORAGE_KEY = 'brasa.mesa';

/** Sin mesa preseleccionada: antes la app asumía la mesa 4 (hallazgo E-05). */
const ESTADO_INICIAL: UbicacionCliente = { tipo: 'mesa', numero: null, codigo: null };

@Injectable({ providedIn: 'root' })
export class MesaService {
  private readonly api = inject(ApiService);
  private readonly estado = signal<UbicacionCliente>(this.cargar());

  readonly tipo = computed(() => this.estado().tipo);
  readonly numero = computed(() => this.estado().numero);
  readonly codigo = computed(() => this.estado().codigo);
  readonly esParaLlevar = computed(() => this.estado().tipo === 'llevar');
  /** Listo para pedir: para llevar, o en una mesa validada por el servidor. */
  readonly configurada = computed(() => this.esParaLlevar() || this.estado().codigo !== null);

  /** Texto para el encabezado, p. ej. "Mesa #04" o "Para llevar". */
  readonly etiqueta = computed(() => {
    const { tipo, numero } = this.estado();
    if (tipo === 'llevar') return 'Para llevar';
    return numero != null ? `Mesa #${String(numero).padStart(2, '0')}` : 'Sin mesa';
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.estado()));
      } catch {
        /* almacenamiento no disponible */
      }
    });
  }

  /** Valida con el servidor el código del QR (o el impreso debajo de él). */
  async usarCodigo(codigo: string): Promise<number> {
    const normalizado = codigo.trim().toUpperCase();
    const mesa = await firstValueFrom(
      this.api.get<{ numero: number; codigo: string }>(`/mesas/codigo/${encodeURIComponent(normalizado)}`),
    );
    this.estado.set({ tipo: 'mesa', numero: mesa.numero, codigo: mesa.codigo });
    return mesa.numero;
  }

  paraLlevar(): void {
    this.estado.set({ tipo: 'llevar', numero: null, codigo: null });
  }

  establecerTipo(tipo: TipoPedido): void {
    if (tipo === 'llevar') this.paraLlevar();
    else if (this.estado().tipo === 'llevar') this.estado.set(ESTADO_INICIAL);
  }

  private cargar(): UbicacionCliente {
    try {
      const crudo = localStorage.getItem(STORAGE_KEY);
      if (!crudo) return ESTADO_INICIAL;
      const p = JSON.parse(crudo) as Partial<UbicacionCliente>;
      if (p.tipo === 'llevar') return { tipo: 'llevar', numero: null, codigo: null };
      const codigoValido = typeof p.codigo === 'string' && /^[A-Z0-9]{6,12}$/.test(p.codigo);
      return codigoValido && typeof p.numero === 'number'
        ? { tipo: 'mesa', numero: p.numero, codigo: p.codigo! }
        : ESTADO_INICIAL;
    } catch {
      return ESTADO_INICIAL;
    }
  }
}
