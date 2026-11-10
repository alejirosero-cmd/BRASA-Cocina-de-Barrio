import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideClock } from '@lucide/angular';
import { ETIQUETA_ESTADO, ETIQUETA_ESTADO_PAGO, Pedido } from '../../../models/pedido.model';
import { PrecioCopPipe } from '../../pipes/precio-cop.pipe';

/** Tarjeta de pedido para cocina y meseros. Las acciones se proyectan desde el padre. */
@Component({
  selector: 'app-tarjeta-pedido',
  imports: [DatePipe, PrecioCopPipe, LucideClock],
  template: `
    <article class="flex h-full flex-col rounded-2xl border bg-white shadow-card" [class]="urgente() ? 'border-red-300' : 'border-brasa-border'">
      <header class="flex items-start justify-between gap-2 border-b border-brasa-border px-5 py-3">
        <div>
          <p class="font-heading text-lg font-bold text-brasa-black">{{ pedido().numero }}</p>
          <p class="text-sm font-semibold text-brasa-orange">{{ ubicacion() }}</p>
        </div>
        <div class="text-right text-xs text-brasa-muted">
          <p class="flex items-center justify-end gap-1" [class.text-red-600]="urgente()">
            <svg lucideClock [size]="12"></svg> {{ minutos() }} min
          </p>
          <p>{{ pedido().creadoEn | date: 'h:mm a' }}</p>
          @if (mostrarPago()) {
            <p class="mt-1 font-semibold" [class]="pedido().estadoPago === 'PAGADO' ? 'text-green-600' : 'text-brasa-black'">{{ etiquetaPago[pedido().estadoPago] }}</p>
          }
        </div>
      </header>
      <ul class="flex flex-1 flex-col gap-2 px-5 py-3">
        @for (item of pedido().items; track item.id) {
          <li class="text-sm">
            <span class="font-semibold">{{ item.cantidad }} × {{ item.nombre }}</span>
            @if (item.personalizacion.tamano) { <span class="text-brasa-muted"> · {{ item.personalizacion.tamano.nombre }}</span> }
            @if (item.personalizacion.extras.length) { <p class="text-xs text-brasa-muted">+ {{ nombres(item.personalizacion.extras) }}</p> }
            @if (item.personalizacion.salsas.length) { <p class="text-xs text-brasa-muted">Salsas: {{ nombres(item.personalizacion.salsas) }}</p> }
            @if (item.personalizacion.retirados.length) { <p class="text-xs font-semibold text-red-600">Sin {{ item.personalizacion.retirados.join(', ').toLowerCase() }}</p> }
            @if (item.personalizacion.instrucciones) { <p class="text-xs text-brasa-orange">Nota: {{ item.personalizacion.instrucciones }}</p> }
          </li>
        }
        @if (pedido().notasCocina) {
          <li class="rounded-lg bg-brasa-orange/10 px-3 py-2 text-xs text-brasa-black"><strong>Notas:</strong> {{ pedido().notasCocina }}</li>
        }
      </ul>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-brasa-border px-5 py-3">
        <span class="rounded-full bg-brasa-gray-light px-2.5 py-1 text-xs font-semibold text-brasa-muted">{{ etiquetaEstado[pedido().estado] }}</span>
        @if (mostrarPago()) { <span class="text-sm font-semibold">{{ pedido().resumen.total | precioCop }}</span> }
        <div class="flex w-full flex-wrap gap-2"><ng-content /></div>
      </footer>
    </article>
  `,
})
export class TarjetaPedidoComponent {
  readonly pedido = input.required<Pedido>();
  readonly mostrarPago = input(false);
  /** Hora actual, para recalcular la antigüedad sin un temporizador por tarjeta. */
  readonly ahora = input(Date.now());

  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly etiquetaPago = ETIQUETA_ESTADO_PAGO;
  protected readonly minutos = computed(() => Math.max(0, Math.floor((this.ahora() - Date.parse(this.pedido().creadoEn)) / 60_000)));
  protected readonly urgente = computed(() => this.minutos() > this.pedido().tiempoEstimadoMin && this.pedido().estado !== 'LISTO');
  protected readonly ubicacion = computed(() =>
    this.pedido().mesa.tipo === 'llevar' ? 'Para llevar' : `Mesa ${this.pedido().mesa.numero}`,
  );

  protected nombres(lista: { nombre: string }[]): string {
    return lista.map((x) => x.nombre).join(', ');
  }
}
