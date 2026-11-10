import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../common/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, aUsuarioPublico } from './auth.service';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto';

/** Gestión de usuarios por parte del administrador. */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar() {
    const usuarios = await this.prisma.usuario.findMany({ orderBy: { creadoEn: 'desc' } });
    return usuarios.map((u) => ({ ...aUsuarioPublico(u), activo: u.activo, creadoEn: u.creadoEn }));
  }

  async crear(dto: CrearUsuarioDto, actorId: string) {
    if (await this.prisma.usuario.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        rol: dto.rol,
        passwordHash: await AuthService.hashPassword(dto.password),
      },
    });
    await this.auditoria.registrar('usuario.creado', 'Usuario', usuario.id, actorId, { rol: dto.rol });
    return aUsuarioPublico(usuario);
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, actorId: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (id === actorId && (dto.rol && dto.rol !== 'ADMIN' || dto.activo === false)) {
      // Evita que el administrador se quite su propio acceso por error.
      throw new BadRequestException('No puedes quitarte el rol de administrador ni desactivarte');
    }
    const cambiaAcceso = (dto.rol !== undefined && dto.rol !== usuario.rol) || dto.activo === false;
    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        rol: dto.rol,
        activo: dto.activo,
        nombre: dto.nombre,
        ...(cambiaAcceso ? { versionSesion: { increment: 1 } } : {}),
      },
    });
    await this.auditoria.registrar('usuario.actualizado', 'Usuario', id, actorId, {
      rol: dto.rol,
      activo: dto.activo,
    });
    return { ...aUsuarioPublico(actualizado), activo: actualizado.activo };
  }
}
