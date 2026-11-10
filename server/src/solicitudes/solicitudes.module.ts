import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SolicitudMesero } from '@prisma/client';
import { Publico, Roles, UsuarioActual, UsuarioAutenticado } from '../auth/decoradores';
import { MOTIVOS_SOLICITUD, MotivoSolicitud } from '../common/dominio';
import { EventosService } from '../common/eventos.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { PedidosService } from '../pedidos/pedidos.service';
import { PrismaService } from '../prisma/prisma.service';

class CrearSolicitudDto {
  @IsIn(MOTIVOS_SOLICITUD as unknown as string[]) motivo: MotivoSolicitud;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[A-Za-z0-9]{6,12}$/, { message: 'Código de mesa no válido' })
  codigoMesa?: string;
  /** Alternativa para pedidos para llevar: el pedido y su token de seguimiento. */
  @IsOptional() @IsString() @MaxLength(40) pedidoId?: string;
}

type SolicitudConMesa = SolicitudMesero & { mesa: { numero: number } | null };

function serializar(s: SolicitudConMesa) {
  return {
    id: s.id,
    motivo: s.motivo,
    mesa: s.mesa?.numero ?? null,
    estado: s.estado,
    creadaEn: s.creadoEn.toISOString(),
    atendidaEn: s.atendidaEn?.toISOString() ?? null,
  };
}

@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly pedidos: PedidosService,
  ) {}

  async crear(dto: CrearSolicitudDto, token: string | undefined, usuario: UsuarioAutenticado | null) {
    let mesaId: string | null = null;
    if (dto.codigoMesa) {
      const mesa = await this.prisma.mesa.findUnique({ where: { codigo: dto.codigoMesa.toUpperCase() } });
      if (!mesa || !mesa.activa) throw new BadRequestException('El código de mesa no es válido');
      mesaId = mesa.id;
    } else if (dto.pedidoId) {
      const pedido = await this.pedidos.obtenerConAcceso(dto.pedidoId, token, usuario);
      mesaId = pedido.mesaId;
    } else {
      throw new BadRequestException('Escanea el QR de tu mesa para llamar al mesero');
    }

    // Evita duplicados: si ya hay una solicitud igual sin atender, se devuelve la misma.
    const pendiente = await this.prisma.solicitudMesero.findFirst({
      where: { mesaId, motivo: dto.motivo, estado: 'PENDIENTE' },
      include: { mesa: { select: { numero: true } } },
    });
    if (pendiente) return { ...serializar(pendiente), repetida: true };

    const solicitud = await this.prisma.solicitudMesero.create({
      data: { mesaId, motivo: dto.motivo },
      include: { mesa: { select: { numero: true } } },
    });
    const datos = serializar(solicitud);
    this.eventos.emitir({ tipo: 'solicitud.actualizada', datos });
    return { ...datos, repetida: false };
  }

  async pendientes() {
    const lista = await this.prisma.solicitudMesero.findMany({
      where: { estado: 'PENDIENTE' },
      include: { mesa: { select: { numero: true } } },
      orderBy: { creadoEn: 'asc' },
    });
    return lista.map(serializar);
  }

  async atender(id: string, usuario: UsuarioAutenticado) {
    const r = await this.prisma.solicitudMesero.updateMany({
      where: { id, estado: 'PENDIENTE' },
      data: { estado: 'ATENDIDA', atendidaPorId: usuario.id, atendidaEn: new Date() },
    });
    if (r.count === 0) {
      const existe = await this.prisma.solicitudMesero.findUnique({ where: { id } });
      if (!existe) throw new NotFoundException('Solicitud no encontrada');
      throw new ConflictException('La solicitud ya fue atendida');
    }
    const s = await this.prisma.solicitudMesero.findUniqueOrThrow({
      where: { id },
      include: { mesa: { select: { numero: true } } },
    });
    const datos = serializar(s);
    this.eventos.emitir({ tipo: 'solicitud.actualizada', datos });
    return datos;
  }
}

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  @Publico()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post()
  crear(
    @Body() dto: CrearSolicitudDto,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.solicitudes.crear(dto, token, usuario);
  }

  @Roles('ADMIN', 'MESERO')
  @Get()
  pendientes() {
    return this.solicitudes.pendientes();
  }

  @Roles('ADMIN', 'MESERO')
  @Patch(':id/atender')
  atender(@Param('id') id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.solicitudes.atender(id, usuario);
  }
}

@Module({
  imports: [PedidosModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
