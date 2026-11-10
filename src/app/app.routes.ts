import { Routes } from '@angular/router';
import { rolGuard } from './core/auth/rol.guard';

const auth = () => import('./features/auth/auth-paginas');
const admin = () => import('./features/admin/admin-secciones');

export const routes: Routes = [
  // ---- Clientes (sin cuenta obligatoria) ----
  { path: '', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent), title: 'BRASA' },
  { path: 'm/:codigo', loadComponent: () => import('./features/mesa/entrada-qr.component').then((m) => m.EntradaQrComponent), title: 'Tu mesa - BRASA' },
  { path: 'menu', loadComponent: () => import('./features/menu/menu.component').then((m) => m.MenuComponent), title: 'Menú - BRASA' },
  { path: 'carrito', loadComponent: () => import('./features/cart/carrito.component').then((m) => m.CarritoComponent), title: 'Mi Carrito - BRASA' },
  { path: 'pedido', loadComponent: () => import('./features/orders/seguimiento.component').then((m) => m.SeguimientoComponent), title: 'Seguimiento del pedido - BRASA' },
  { path: 'pedido/:id', loadComponent: () => import('./features/orders/seguimiento.component').then((m) => m.SeguimientoComponent), title: 'Seguimiento del pedido - BRASA' },
  { path: 'pagar/:id', loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent), title: 'Pagar la cuenta - BRASA' },
  { path: 'pago/resultado', loadComponent: () => import('./features/pagos/pago-resultado.component').then((m) => m.PagoResultadoComponent), title: 'Resultado del pago - BRASA' },
  { path: 'pago/simulado', loadComponent: () => import('./features/pagos/pago-simulado.component').then((m) => m.PagoSimuladoComponent), title: 'Pasarela de pruebas - BRASA' },
  { path: 'historial', loadComponent: () => import('./features/history/historial.component').then((m) => m.HistorialComponent), title: 'Historial de pedidos - BRASA' },
  // La antigua ruta /checkout ahora es el pago de un pedido ya enviado.
  { path: 'checkout', redirectTo: 'carrito' },

  // ---- Cuenta ----
  { path: 'login', loadComponent: () => auth().then((m) => m.LoginComponent), title: 'Iniciar sesión - BRASA' },
  { path: 'registro', loadComponent: () => auth().then((m) => m.RegistroComponent), title: 'Crear cuenta - BRASA' },
  { path: 'recuperar', loadComponent: () => auth().then((m) => m.RecuperarComponent), title: 'Recuperar contraseña - BRASA' },
  { path: 'restablecer', loadComponent: () => auth().then((m) => m.RestablecerComponent), title: 'Nueva contraseña - BRASA' },
  { path: 'cuenta', canActivate: [rolGuard('ADMIN', 'CLIENTE', 'MESERO', 'COCINA')], loadComponent: () => auth().then((m) => m.CuentaComponent), title: 'Mi cuenta - BRASA' },

  // ---- Personal ----
  { path: 'cocina', canActivate: [rolGuard('COCINA', 'ADMIN')], loadComponent: () => import('./features/kitchen/cocina.component').then((m) => m.CocinaComponent), title: 'Cocina - BRASA' },
  { path: 'mesero', canActivate: [rolGuard('MESERO', 'ADMIN')], loadComponent: () => import('./features/mesero/mesero.component').then((m) => m.MeseroComponent), title: 'Meseros - BRASA' },
  {
    path: 'admin',
    canActivate: [rolGuard('ADMIN')],
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    children: [
      { path: '', loadComponent: () => admin().then((m) => m.AdminResumenComponent), title: 'Administración - BRASA' },
      { path: 'pedidos', loadComponent: () => admin().then((m) => m.AdminPedidosComponent), title: 'Pedidos - BRASA' },
      { path: 'pagos', loadComponent: () => admin().then((m) => m.AdminPagosComponent), title: 'Pagos - BRASA' },
      { path: 'productos', loadComponent: () => admin().then((m) => m.AdminProductosComponent), title: 'Menú - BRASA' },
      { path: 'mesas', loadComponent: () => admin().then((m) => m.AdminMesasComponent), title: 'Mesas y QR - BRASA' },
      { path: 'usuarios', loadComponent: () => admin().then((m) => m.AdminUsuariosComponent), title: 'Usuarios - BRASA' },
      { path: 'calificaciones', loadComponent: () => admin().then((m) => m.AdminCalificacionesComponent), title: 'Calificaciones - BRASA' },
    ],
  },

  { path: '**', redirectTo: '' },
];
