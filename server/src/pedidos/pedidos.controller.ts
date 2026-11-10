import {
  Body,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Observable, interval, map, merge } from 'rxjs';
import { Publico, Roles, UsuarioActual, UsuarioAutenticado } from '../auth/decoradores';
import { ESTADOS_PEDIDO } from '../common/dominio';
import { EventosService } from '../common/eventos.service';
import { leerJson } from '../common/seguridad';
import { PrismaService } from '../prisma/prisma.service';
import { CambiarEstadoDto, CrearPedidoDto, DatosFacturaDto, PropinaDto } from './dto';
import { PedidosService, serializarPedido } from './pedidos.service';

/** Mantiene viva la conexión SSE a través de proxies. */
const latido = () => interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));

function fecha(valor?: string): Date | undefined {
  if (!valor) return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidos: PedidosService,
    private readonly eventos: EventosService,
    private readonly prisma: PrismaService,
  ) {}

  /** Crear pedido: cliente anónimo (con QR) o con sesión. Límite contra abuso: 10 por minuto por IP. */
  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  crear(@Body() dto: CrearPedidoDto, @UsuarioActual() usuario: UsuarioAutenticado | null) {
    return this.pedidos.crear(dto, usuario);
  }

  @Roles('ADMIN', 'MESERO', 'COCINA')
  @Get('activos')
  activos() {
    return this.pedidos.listarActivos();
  }

  @Roles('ADMIN')
  @Get()
  listar(
    @Query('estado') estado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('pagina') pagina?: string,
  ) {
    const estadoValido = ESTADOS_PEDIDO.includes(estado as never) ? estado : undefined;
    const numPagina = Math.max(1, Math.min(1000, Number(pagina) || 1));
    return this.pedidos.listar({ estado: estadoValido, desde: fecha(desde), hasta: fecha(hasta) }, numPagina);
  }

  @Roles('CLIENTE')
  @Get('mios')
  mios(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pedidos.listarDelCliente(usuario.id);
  }

  /** Flujo en tiempo real para el personal: todos los cambios de pedidos, solicitudes y pagos. */
  @Roles('ADMIN', 'MESERO', 'COCINA')
  @Sse('eventos')
  eventosPersonal(): Observable<MessageEvent> {
    return merge(this.eventos.flujo(() => true), latido());
  }

  @Publico()
  @Get(':id')
  async obtener(
    @Param('id') id: string,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return serializarPedido(await this.pedidos.obtenerConAcceso(id, token, usuario));
  }

  /** Flujo en tiempo real de un solo pedido (lo usa la pantalla de seguimiento del cliente). */
  @Publico()
  @Sse(':id/eventos')
  async eventosPedido(
    @Param('id') id: string,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ): Promise<Observable<MessageEvent>> {
    await this.pedidos.obtenerConAcceso(id, token, usuario);
    return merge(
      this.eventos.flujo((e) => e.pedidoId === id && e.tipo === 'pedido.actualizado'),
      latido(),
    );
  }

  @Roles('ADMIN', 'MESERO', 'COCINA')
  @Patch(':id/estado')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pedidos.cambiarEstado(id, dto, usuario);
  }

  @Publico()
  @Post(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.pedidos.cancelarPorCliente(id, token, usuario);
  }

  @Publico()
  @Patch(':id/propina')
  propina(
    @Param('id') id: string,
    @Body() dto: PropinaDto,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.pedidos.cambiarPropina(id, dto.porcentaje, token, usuario);
  }

  @Publico()
  @Post(':id/factura')
  factura(
    @Param('id') id: string,
    @Body() dto: DatosFacturaDto,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.pedidos.guardarDatosFactura(id, dto, token, usuario);
  }

  /** Datos de facturación (personales): solo el administrador puede leerlos. */
  @Roles('ADMIN')
  @Get(':id/factura')
  async verFactura(@Param('id') id: string) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, select: { datosFactura: true } });
    return leerJson(pedido?.datosFactura, null);
  }
}
