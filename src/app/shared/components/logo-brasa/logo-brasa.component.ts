import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-logo-brasa',
  imports: [RouterLink],
  template: `
    <a
      routerLink="/"
      class="group inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange rounded-lg"
      [attr.aria-label]="'BRASA, ir al inicio'"
    >
      <span
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-brasa-orange text-white shadow-soft transition group-hover:scale-105"
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      </span>
      <span class="flex flex-col leading-none">
        <span class="font-heading text-xl font-bold tracking-tight text-brasa-black">BRASA</span>
        @if (mostrarEslogan()) {
          <span class="text-[11px] font-medium uppercase tracking-[0.18em] text-brasa-muted">
            Cocina de Barrio
          </span>
        }
      </span>
    </a>
  `,
})
export class LogoBrasaComponent {
  readonly mostrarEslogan = input(true);
}
