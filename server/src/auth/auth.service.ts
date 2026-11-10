import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditoriaService } from '../common/auditoria.service';
import { Rol } from '../common/dominio';
import { generarToken, sha256 } from '../common/seguridad';
import { CONFIGURACION, Configuracion } from '../config/configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { CorreoService } from './correo.service';

const COSTO_BCRYPT = 12;
const MINUTOS_RECUPERACION = 30;
/** Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe. */
const HASH_FICTICIO = bcrypt.hashSync('brasa-usuario-inexistente', COSTO_BCRYPT);

export interface UsuarioPublico {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface Sesion {
  token: string;
  usuario: UsuarioPublico;
}

export function aUsuarioPublico(u: Usuario): UsuarioPublico {
  return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol as Rol };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly correo: CorreoService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
  ) {}

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, COSTO_BCRYPT);
  }

  /** Registro público: siempre crea un CLIENTE. Los roles de personal solo los asigna un administrador. */
  async registrar(email: string, nombre: string, password: string): Promise<Sesion> {
    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    const usuario = await this.prisma.usuario.create({
      data: { email, nombre, passwordHash: await AuthService.hashPassword(password), rol: 'CLIENTE' },
    });
    await this.auditoria.registrar('usuario.registro', 'Usuario', usuario.id, usuario.id);
    return this.crearSesion(usuario);
  }

  async iniciarSesion(email: string, password: string): Promise<Sesion> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    const valida = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_FICTICIO);
    if (!usuario || !valida || !usuario.activo) {
      await this.auditoria.registrar('sesion.fallida', 'Usuario', usuario?.id ?? null, null);
      // Mensaje genérico: no revela si el correo existe (ASVS V6.3).
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    await this.auditoria.registrar('sesion.inicio', 'Usuario', usuario.id, usuario.id);
    return this.crearSesion(usuario);
  }

  /** Siempre responde igual, exista o no el correo, para no permitir enumerar cuentas. */
  async solicitarRecuperacion(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) return;

    const token = generarToken();
    await this.prisma.$transaction([
      // Un solo enlace vigente a la vez.
      this.prisma.tokenRecuperacion.updateMany({
        where: { usuarioId: usuario.id, usadoEn: null },
        data: { usadoEn: new Date() },
      }),
      this.prisma.tokenRecuperacion.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: sha256(token),
          expiraEn: new Date(Date.now() + MINUTOS_RECUPERACION * 60_000),
        },
      }),
    ]);
    const enlace = `${this.config.frontendUrl}/restablecer?token=${encodeURIComponent(token)}`;
    await this.correo.enviarRecuperacion(usuario.email, enlace);
    await this.auditoria.registrar('password.recuperacion_solicitada', 'Usuario', usuario.id, null);
  }

  async restablecerPassword(token: string, password: string): Promise<void> {
    const registro = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
      throw new BadRequestException('El enlace no es válido o ya expiró');
    }
    const passwordHash = await AuthService.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.tokenRecuperacion.update({ where: { id: registro.id }, data: { usadoEn: new Date() } }),
      this.prisma.usuario.update({
        where: { id: registro.usuarioId },
        data: { passwordHash, versionSesion: { increment: 1 } },
      }),
    ]);
    await this.auditoria.registrar('password.restablecida', 'Usuario', registro.usuarioId, registro.usuarioId);
  }

  async cambiarPassword(usuarioId: string, actual: string, nueva: string): Promise<Sesion> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!(await bcrypt.compare(actual, usuario.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: await AuthService.hashPassword(nueva), versionSesion: { increment: 1 } },
    });
    await this.auditoria.registrar('password.cambiada', 'Usuario', usuarioId, usuarioId);
    // Las demás sesiones quedan invalidadas; esta recibe un token nuevo.
    return this.crearSesion(actualizado);
  }

  async perfil(usuarioId: string): Promise<UsuarioPublico> {
    return aUsuarioPublico(await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } }));
  }

  async actualizarPerfil(usuarioId: string, nombre: string): Promise<UsuarioPublico> {
    return aUsuarioPublico(await this.prisma.usuario.update({ where: { id: usuarioId }, data: { nombre } }));
  }

  private async crearSesion(usuario: Usuario): Promise<Sesion> {
    const token = await this.jwt.signAsync({ sub: usuario.id, rol: usuario.rol, v: usuario.versionSesion });
    return { token, usuario: aUsuarioPublico(usuario) };
  }
}
