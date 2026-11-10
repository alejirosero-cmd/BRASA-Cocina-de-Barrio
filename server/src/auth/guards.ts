import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Rol } from '../common/dominio';
import { CLAVE_PUBLICO, CLAVE_ROLES, UsuarioAutenticado } from './decoradores';

interface CargaJwt {
  sub: string;
  rol: Rol;
  v: number;
}

/**
 * Guard global: toda ruta exige un JWT válido salvo que esté marcada con @Publico().
 * El usuario se vuelve a leer de la base de datos para que un usuario desactivado o
 * con rol cambiado pierda acceso de inmediato (no se confía solo en el contenido del token).
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const peticion = ctx.switchToHttp().getRequest();
    const token = this.extraerToken(peticion.headers?.authorization);

    if (!token) {
      if (esPublico) return true;
      throw new UnauthorizedException('Debes iniciar sesión');
    }

    let carga: CargaJwt;
    try {
      carga = await this.jwt.verifyAsync<CargaJwt>(token);
    } catch {
      if (esPublico) return true;
      throw new UnauthorizedException('La sesión expiró o no es válida');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: carga.sub } });
    if (!usuario || !usuario.activo || usuario.versionSesion !== carga.v) {
      if (esPublico) return true;
      throw new UnauthorizedException('La sesión expiró o no es válida');
    }

    const autenticado: UsuarioAutenticado = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol as Rol,
    };
    peticion.usuario = autenticado;
    return true;
  }

  private extraerToken(cabecera: unknown): string | null {
    if (typeof cabecera !== 'string') return null;
    const [tipo, valor] = cabecera.split(' ');
    return tipo === 'Bearer' && valor ? valor : null;
  }
}

/** Verifica @Roles(). Se ejecuta después de AutenticacionGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const usuario: UsuarioAutenticado | undefined = ctx.switchToHttp().getRequest().usuario;
    if (!usuario) throw new UnauthorizedException('Debes iniciar sesión');
    if (!roles.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }
    return true;
  }
}
