import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Contenedor del panel de administración. Todas sus rutas exigen rol ADMIN (cliente y servidor). */
@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="mx-auto max-w-[1600px] px-5 py-8 md:px-10">
      <h1 class="font-heading text-3xl font-bold tracking-tight text-brasa-black">Administración</h1>
      <nav class="mt-4 flex gap-1 overflow-x-auto border-b border-brasa-border" aria-label="Secciones de administración">
        @for (s of secciones; track s.ruta) {
          <a [routerLink]="s.ruta" routerLinkActive="border-brasa-orange text-brasa-black" [routerLinkActiveOptions]="{ exact: s.ruta === '/admin' }"
            class="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-brasa-muted transition hover:text-brasa-black">
            {{ s.titulo }}
          </a>
        }
      </nav>
      <div class="pt-6"><router-outlet /></div>
    </div>
  `,
})
export class AdminComponent {
  protected readonly secciones = [
    { ruta: '/admin', titulo: 'Resumen' },
    { ruta: '/admin/pedidos', titulo: 'Pedidos' },
    { ruta: '/admin/pagos', titulo: 'Pagos' },
    { ruta: '/admin/caja', titulo: 'Caja' },
    { ruta: '/admin/productos', titulo: 'Menú' },
    { ruta: '/admin/mesas', titulo: 'Mesas y QR' },
    { ruta: '/admin/usuarios', titulo: 'Usuarios' },
    { ruta: '/admin/calificaciones', titulo: 'Calificaciones' },
  ];
}
