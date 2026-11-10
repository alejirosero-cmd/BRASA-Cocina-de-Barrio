import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Injectable,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Publico, Roles, UsuarioActual, UsuarioAutenticado } from '../auth/decoradores';
import { AuditoriaService } from '../common/auditoria.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { PedidosService } from '../pedidos/pedidos.service';
import { PrismaService } from '../prisma/prisma.service';

class CrearCalificacionDto {
  @IsString() @MaxLength(40) pedidoId: string;
  @IsInt({ message: 'La calificación debe ser un número entero' })
  @Min(1, { message: 'La calificación mínima es 1 estrella' })
  @Max(5, { message: 'La calificación máxima es 5 estrellas' })
  estrellas: number;
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500, { message: 'El comentario admite máximo 500 caracteres' })
  comentario?: string;
}

@Injectable()
export class CalificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidos: PedidosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async crear(dto: CrearCalificacionDto, token: string | undefined, usuario: UsuarioAutenticado | null) {
    const pedido = await this.pedidos.obtenerConAcceso(dto.pedidoId, token, usuario);
    if (pedido.estado !== 'ENTREGADO') {
      throw new ConflictException('Solo puedes calificar pedidos que ya fueron entregados');
    }
    try {
      // La restricción UNIQUE(pedidoId) de la base de datos impide calificaciones duplicadas,
      // incluso si llegan dos peticiones simultáneas.
      const c = await this.prisma.calificacion.create({
        data: { pedidoId: pedido.id, estrellas: dto.estrellas, comentario: dto.comentario ?? '' },
      });
      await this.auditoria.registrar('calificacion.creada', 'Pedido', pedido.id, usuario?.id ?? null);
      return { id: c.id, pedidoId: c.pedidoId, estrellas: c.estrellas, comentario: c.comentario, creadoEn: c.creadoEn };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Este pedido ya fue calificado');
      }
      throw e;
    }
  }

  async resumen() {
    const [agregado, grupos] = await this.prisma.$transaction([
      this.prisma.calificacion.aggregate({ _avg: { estrellas: true }, _count: { _all: true } }),
      this.prisma.calificacion.groupBy({ by: ['estrellas'], _count: { _all: true }, orderBy: { estrellas: 'asc' } }),
    ]);
    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of grupos) distribucion[g.estrellas] = (g._count as { _all: number })._all;
    return {
      promedio: agregado._avg.estrellas ? Math.round(agregado._avg.estrellas * 10) / 10 : null,
      total: agregado._count._all,
      distribucion,
    };
  }

  async listar(pagina: number) {
    const lista = await this.prisma.calificacion.findMany({
      orderBy: { creadoEn: 'desc' },
      skip: (pagina - 1) * 50,
      take: 50,
      include: { pedido: { select: { numero: true } } },
    });
    return lista.map((c) => ({
      id: c.id,
      pedidoNumero: `#${c.pedido.numero}`,
      estrellas: c.estrellas,
      comentario: c.comentario,
      creadoEn: c.creadoEn,
    }));
  }
}

@Controller('calificaciones')
export class CalificacionesController {
  constructor(private readonly calificaciones: CalificacionesService) {}

  @Publico()
  @Post()
  crear(
    @Body() dto: CrearCalificacionDto,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.calificaciones.crear(dto, token, usuario);
  }

  @Publico()
  @Get('resumen')
  resumen() {
    return this.calificaciones.resumen();
  }

  @Roles('ADMIN')
  @Get()
  listar(@Query('pagina') pagina?: string) {
    return this.calificaciones.listar(Math.max(1, Math.min(1000, Number(pagina) || 1)));
  }
}

@Module({
  imports: [PedidosModule],
  controllers: [CalificacionesController],
  providers: [CalificacionesService],
})
export class CalificacionesModule {}
