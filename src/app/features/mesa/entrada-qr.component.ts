import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/services/api.service';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';

/** Destino del QR impreso en cada mesa: /m/:codigo. Valida el código y lleva al menú. */
@Component({
  selector: 'app-entrada-qr',
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-md px-5 py-20 text-center">
      @if (error()) {
        <h1 class="font-heading text-2xl font-bold text-brasa-black">Código de mesa no válido</h1>
        <p class="mt-3 text-sm text-brasa-muted">{{ error() }}</p>
        <a routerLink="/" class="mt-6 inline-block rounded-xl bg-brasa-orange px-6 py-3 text-sm font-semibold text-white">Ingresar el código manualmente</a>
      } @else {
        <p class="text-sm text-brasa-muted" role="status">Ubicando tu mesa...</p>
      }
    </section>
  `,
})
export class EntradaQrComponent implements OnInit {
  private readonly mesa = inject(MesaService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  readonly codigo = input.required<string>();
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const numero = await this.mesa.usarCodigo(this.codigo());
      this.notificaciones.mostrar(`¡Bienvenido! Estás en la mesa ${numero}`);
      this.router.navigate(['/menu'], { replaceUrl: true });
    } catch (e) {
      this.error.set(mensajeError(e, 'Pide ayuda a un mesero o escribe el código impreso en tu mesa.'));
    }
  }
}
