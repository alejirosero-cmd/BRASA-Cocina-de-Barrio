import { Component, inject } from '@angular/core';
import { CarritoService } from '../../../core/services/carrito.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-boton-mesero',
  template: `
    <!-- En el celular sube cuando aparece la barra del carrito, para no taparla. -->
    <button
      type="button"
      class="fixed right-5 z-40 inline-flex items-center gap-2.5 rounded-full bg-brasa-black px-5 py-3.5 text-sm font-semibold text-white shadow-2xl transition-[background-color,bottom] hover:bg-brasa-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 md:right-8 lg:bottom-8"
      [class]="carrito.estaVacio() ? 'bottom-5' : 'bottom-24'"
      (click)="ui.abrirModalMesero()"
      aria-label="Llamar al mesero para pedir asistencia"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span class="hidden sm:inline">Llamar Mesero</span>
      <span class="sm:hidden">Mesero</span>
    </button>
  `,
})
export class BotonMeseroComponent {
  protected readonly ui = inject(UiService);
  protected readonly carrito = inject(CarritoService);
}
