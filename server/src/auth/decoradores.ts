import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Rol } from '../common/dominio';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export const CLAVE_PUBLICO = 'brasa:publico';
export const CLAVE_ROLES = 'brasa:roles';

/** La ruta no exige sesión (si llega un token válido, igual se identifica al usuario). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Solo los roles indicados pueden usar la ruta. Se valida en el servidor (RolesGuard). */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

/** Usuario autenticado de la petición, o null en rutas públicas sin sesión. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioAutenticado | null =>
    ctx.switchToHttp().getRequest().usuario ?? null,
);
