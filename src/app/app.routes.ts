import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
    title: 'BRASA',
  },
  {
    path: 'menu',
    loadComponent: () =>
      import('./features/menu/menu.component').then((m) => m.MenuComponent),
    title: 'Menú - BRASA',
  },
  {
    path: 'carrito',
    loadComponent: () =>
      import('./features/cart/carrito.component').then((m) => m.CarritoComponent),
    title: 'Mi Carrito - BRASA',
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
    title: 'Pago y facturación - BRASA',
  },
  {
    path: 'pedido',
    loadComponent: () =>
      import('./features/orders/seguimiento.component').then((m) => m.SeguimientoComponent),
    title: 'Seguimiento del pedido - BRASA',
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./features/history/historial.component').then((m) => m.HistorialComponent),
    title: 'Historial de pedidos - BRASA',
  },
  {
    path: 'cocina',
    loadComponent: () =>
      import('./features/kitchen/cocina.component').then((m) => m.CocinaComponent),
    title: 'Panel Cocina - BRASA',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
