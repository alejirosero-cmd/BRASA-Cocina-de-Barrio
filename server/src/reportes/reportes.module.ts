import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { Roles } from '../auth/decoradores';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(desde: Date, hasta: Date) {
    const rangoPedidos = { creadoEn: { gte: desde, lte: hasta } };
    const [porEstado, ventas, entregados, masVendidos, calificacion, porDia] = await Promise.all([
      this.prisma.pedido.groupBy({ by: ['estado'], where: rangoPedidos, _count: { _all: true } }),
      // Ventas = dinero efectivamente cobrado (pagos aprobados), no pedidos creados.
      this.prisma.pago.aggregate({
        where: { estado: 'APROBADO', creadoEn: { gte: desde, lte: hasta } },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.pedido.aggregate({
        where: { ...rangoPedidos, estado: 'ENTREGADO' },
        _avg: { total: true },
        _count: { _all: true },
      }),
      this.prisma.pedidoItem.groupBy({
        by: ['nombre'],
        where: { pedido: { ...rangoPedidos, estado: { not: 'CANCELADO' } } },
        _sum: { cantidad: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 5,
      }),
      this.prisma.calificacion.aggregate({
        where: { creadoEn: { gte: desde, lte: hasta } },
        _avg: { estrellas: true },
        _count: { _all: true },
      }),
      this.prisma.pago.findMany({
        where: { estado: 'APROBADO', creadoEn: { gte: desde, lte: hasta } },
        select: { monto: true, creadoEn: true },
      }),
    ]);

    const ventasPorDia = new Map<string, number>();
    for (const p of porDia) {
      const dia = p.creadoEn.toISOString().slice(0, 10);
      ventasPorDia.set(dia, (ventasPorDia.get(dia) ?? 0) + p.monto);
    }

    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      ventasTotales: ventas._sum.monto ?? 0,
      pagosAprobados: ventas._count._all,
      pedidosPorEstado: Object.fromEntries(porEstado.map((g) => [g.estado, g._count._all])),
      pedidosEntregados: entregados._count._all,
      ticketPromedio: Math.round(entregados._avg.total ?? 0),
      masVendidos: masVendidos.map((m) => ({ nombre: m.nombre, cantidad: m._sum.cantidad ?? 0 })),
      calificacionPromedio: calificacion._avg.estrellas ? Math.round(calificacion._avg.estrellas * 10) / 10 : null,
      calificaciones: calificacion._count._all,
      ventasPorDia: [...ventasPorDia.entries()].sort().map(([dia, total]) => ({ dia, total })),
    };
  }
}

@Controller('reportes')
@Roles('ADMIN')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('resumen')
  resumen(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const fin = hasta && !Number.isNaN(Date.parse(hasta)) ? new Date(hasta) : new Date();
    const inicio =
      desde && !Number.isNaN(Date.parse(desde)) ? new Date(desde) : new Date(fin.getTime() - 30 * 86_400_000);
    return this.reportes.resumen(inicio, fin);
  }
}

@Module({ controllers: [ReportesController], providers: [ReportesService] })
export class ReportesModule {}
