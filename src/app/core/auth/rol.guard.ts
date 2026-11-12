import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, INICIO_POR_ROL, Rol } from '../services/auth.service';

/**
 * Protege rutas de la interfaz por rol. Es solo una comodidad de navegación:
 * la autorización real la hace el servidor en cada petición.
 */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return (_ruta, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.autenticado()) {
      return router.createUrlTree(['/login'], { queryParams: { volver: estado.url } });
    }
    return auth.tieneRol(...roles) ? true : router.createUrlTree(['/']);
  };
}

/**
 * Rutas que ciertos roles no usan (por ejemplo, la cocina no arma carritos ni paga):
 * se les devuelve a su pantalla de inicio. El servidor igualmente rechaza la acción.
 */
export function sinRolGuard(...roles: Rol[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const rol = auth.rol();
    return rol !== null && roles.includes(rol) ? inject(Router).createUrlTree([INICIO_POR_ROL[rol]]) : true;
  };
}
