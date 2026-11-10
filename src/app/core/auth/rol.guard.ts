import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Rol } from '../services/auth.service';

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
