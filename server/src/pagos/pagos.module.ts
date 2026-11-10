import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Publico, Roles, UsuarioActual, UsuarioAutenticado } from '../auth/decoradores';
import { CONFIGURACION, Configuracion } from '../config/configuracion';
import { PedidosModule } from '../pedidos/pedidos.module';
import { PrismaService } from '../prisma/prisma.service';
import { PagosService } from './pagos.service';
import { PROVEEDOR_PAGO, ProveedorSimulado, ProveedorWompi } from './proveedores';

class IniciarPagoDto {
  @IsString() @MaxLength(40) pedidoId: string;
  @IsOptional() @IsInt() @Min(1) @Max(100_000_000) monto?: number;
}

class VerificarPagoDto {
  @IsString() @MaxLength(40) pedidoId: string;
  @Matches(/^[\w-]{5,64}$/) transaccionId: string;
}

class EfectivoDto {
  @IsString() @MaxLength(40) pedidoId: string;
  @IsOptional() @IsInt() @Min(1) @Max(100_000_000) monto?: number;
}

class SimularDto {
  @IsBoolean() aprobar: boolean;
}

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly pagos: PagosService,
    private readonly simulado: ProveedorSimulado,
    private readonly prisma: PrismaService,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
  ) {}

  @Publico()
  @Get('proveedor')
  proveedor() {
    return { proveedor: this.pagos.nombreProveedor };
  }

  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  iniciar(
    @Body() dto: IniciarPagoDto,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.pagos.iniciar(dto.pedidoId, dto.monto, token, usuario);
  }

  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('verificar')
  verificar(
    @Body() dto: VerificarPagoDto,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.pagos.verificarTransaccion(dto.pedidoId, dto.transaccionId, token, usuario);
  }

  /** Notificaciones de Wompi. Configura esta URL en el panel de Wompi (Desarrolladores → Eventos). */
  @Publico()
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhook/wompi')
  async webhook(@Body() cuerpo: unknown) {
    if (this.pagos.nombreProveedor !== 'wompi') throw new NotFoundException();
    const resultado = await this.pagos.procesarWebhook(cuerpo);
    if (resultado === 'firma_invalida') throw new BadRequestException('Firma inválida');
    return { recibido: true, resultado };
  }

  /** Solo existe con el proveedor simulado y fuera de producción. */
  @Publico()
  @HttpCode(200)
  @Post('simulado/:referencia')
  async simular(@Param('referencia') referencia: string, @Body() dto: SimularDto) {
    if (this.pagos.nombreProveedor !== 'simulado' || this.config.esProduccion) {
      throw new ForbiddenException('El simulador de pagos no está habilitado');
    }
    const pago = await this.prisma.pago.findUnique({ where: { referencia } });
    if (!pago || pago.proveedor !== 'simulado') throw new NotFoundException('Pago no encontrado');
    const resultado = await this.pagos.aplicarResultado(this.simulado.resultado(referencia, pago.monto, dto.aprobar));
    return { resultado, pedidoId: pago.pedidoId };
  }

  @Publico()
  @Get('pedido/:pedidoId')
  delPedido(
    @Param('pedidoId') pedidoId: string,
    @Headers('x-pedido-token') token: string | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado | null,
  ) {
    return this.pagos.pagosDelPedido(pedidoId, token, usuario);
  }

  @Roles('ADMIN', 'MESERO')
  @Post('efectivo')
  efectivo(@Body() dto: EfectivoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pagos.registrarEfectivo(dto.pedidoId, dto.monto, usuario);
  }

  @Roles('ADMIN')
  @Get()
  historial(@Query('pagina') pagina?: string) {
    return this.pagos.historial(Math.max(1, Math.min(1000, Number(pagina) || 1)));
  }

  @Roles('ADMIN')
  @Patch(':id/reembolso')
  reembolso(@Param('id') id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pagos.solicitarReembolso(id, usuario);
  }

  @Roles('ADMIN')
  @Patch(':id/reembolsado')
  reembolsado(@Param('id') id: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pagos.confirmarReembolso(id, usuario);
  }
}

@Module({
  imports: [PedidosModule],
  controllers: [PagosController],
  providers: [
    PagosService,
    ProveedorWompi,
    ProveedorSimulado,
    {
      provide: PROVEEDOR_PAGO,
      inject: [CONFIGURACION, ProveedorWompi, ProveedorSimulado],
      useFactory: (config: Configuracion, wompi: ProveedorWompi, simulado: ProveedorSimulado) =>
        config.pagos.proveedor === 'wompi' ? wompi : simulado,
    },
  ],
})
export class PagosModule {}
