import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoBrasaComponent } from '../logo-brasa/logo-brasa.component';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, LogoBrasaComponent],
  template: `
    <footer class="mt-8 border-t border-brasa-border bg-brasa-gray-light">
      <div class="mx-auto grid max-w-[1760px] grid-cols-2 gap-8 px-5 py-12 md:grid-cols-4 md:px-10 xl:px-20">
        <div class="col-span-2 md:col-span-1">
          <app-logo-brasa />
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-brasa-muted">
            Cocina de barrio hecha a la brasa. Pide desde tu mesa, sigue tu pedido y paga sin esperar la cuenta.
          </p>
        </div>

        <nav aria-label="Pedidos">
          <h2 class="font-heading text-sm font-semibold text-brasa-black">Pide</h2>
          <ul class="mt-3 space-y-2 text-sm text-brasa-muted">
            <li><a routerLink="/menu" class="hover:text-brasa-orange">Menú</a></li>
            <li><a routerLink="/pedido" class="hover:text-brasa-orange">Seguimiento</a></li>
            <li><a routerLink="/historial" class="hover:text-brasa-orange">Mis pedidos</a></li>
          </ul>
        </nav>

        <nav aria-label="Cuenta">
          <h2 class="font-heading text-sm font-semibold text-brasa-black">Tu cuenta</h2>
          <ul class="mt-3 space-y-2 text-sm text-brasa-muted">
            <li><a routerLink="/login" class="hover:text-brasa-orange">Ingresar</a></li>
            <li><a routerLink="/registro" class="hover:text-brasa-orange">Crear cuenta</a></li>
            <li><a routerLink="/recuperar" class="hover:text-brasa-orange">Recuperar contraseña</a></li>
          </ul>
        </nav>

        <div>
          <h2 class="font-heading text-sm font-semibold text-brasa-black">Personal</h2>
          <ul class="mt-3 space-y-2 text-sm text-brasa-muted">
            <li><a routerLink="/login" class="hover:text-brasa-orange">Acceso de cocina, meseros y administración</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-brasa-border">
        <p class="mx-auto max-w-[1760px] px-5 py-5 text-xs text-brasa-muted md:px-10 xl:px-20">
          © {{ anio }} BRASA · Cocina de Barrio. Pagos procesados por Wompi.
        </p>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected readonly anio = new Date().getFullYear();
}
