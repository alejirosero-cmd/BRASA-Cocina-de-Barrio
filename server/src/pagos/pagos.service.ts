import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Pago, Prisma } from '@prisma/client';
import { UsuarioAutenticado } from '../auth/decoradores';
import { AuditoriaService } from '../common/auditoria.service';
import { EstadoPagoPedido } from '../common/dominio';
import { EventosService } from '../common/eventos.service';
import { generarToken } from '../common/seguridad';
import { CONFIGURACION, Configuracion } from '../config/configuracion';
import { INCLUIR_PEDIDO, PedidosService, serializarPedido } from '../pedidos/pedidos.service';
import { PrismaService } from '../prisma/prisma.service';
import { PROVEEDOR_PAGO, ProveedorPago, ResultadoVerificado } from './proveedores';

/** Pago mínimo por transacción (Wompi exige un monto mínimo; 1.500 COP es un valor conservador). */
export const MONTO_MINIMO = 1500;
/** Un pago pendiente igual creado hace menos de esto se reutiliza (evita cobros duplicados por doble clic). */
const MINUTOS_REUTILIZAR = 30;

export type ResultadoProcesamiento = 'aplicado' | 'duplicado' | 'ignorado' | 'inconsistente' | 'desconocido';

function serializarPago(p: Pago) {
  return {
    id: p.id,
    pedidoId: p.pedidoId,
    proveedor: p.proveedor,
    referencia: p.referencia,
    monto: p.monto,
    moneda: p.moneda,
    estado: p.estado,
    metodo: p.metodo,
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  };
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger('Pagos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidos: PedidosService,
    private readonly eventos: EventosService,
    private readonly auditoria: AuditoriaService,
    @Inject(PROVEEDOR_PAGO) private readonly proveedor: ProveedorPago,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
  ) {}

  get nombreProveedor() {
    return this.proveedor.nombre;
  }

  /** Inicia un pago en línea por el saldo pendiente o por una parte (cuenta dividida). */
  async iniciar(pedidoId: string, monto: number | undefined, token: string | undefined, usuario: UsuarioAutenticado | null) {
    const pedido = await this.pedidos.obtenerConAcceso(pedidoId, token, usuario);
    if (pedido.estado === 'CANCELADO') throw new ConflictException('El pedido está cancelado');

    const saldo = pedido.total - pedido.pagos.filter((p) => p.estado === 'APROBADO').reduce((s, p) => s + p.monto, 0);
    if (saldo <= 0) throw new ConflictException('El pedido ya está pagado');

    const valor = monto ?? saldo;
    if (!Number.isInteger(valor) || valor > saldo) {
      throw new BadRequestException(`El monto debe ser un entero de máximo ${saldo} COP`);
    }
    if (valor < Math.min(MONTO_MINIMO, saldo)) {
      throw new BadRequestException(`El monto mínimo por pago es ${MONTO_MINIMO} COP`);
    }

    const urlRetorno = `${this.config.frontendUrl}/pago/resultado?pedido=${encodeURIComponent(pedidoId)}`;
    const reciente = await this.prisma.pago.findFirst({
      where: {
        pedidoId,
        monto: valor,
        estado: 'PENDIENTE',
        proveedor: this.proveedor.nombre,
        creadoEn: { gte: new Date(Date.now() - MINUTOS_REUTILIZAR * 60_000) },
      },
      orderBy: { creadoEn: 'desc' },
    });
    const pago =
      reciente ??
      (await this.prisma.pago.create({
        data: {
          pedidoId,
          proveedor: this.proveedor.nombre,
          // Referencia impredecible y única: también es la clave de idempotencia ante el proveedor.
          referencia: `BRASA-${pedido.numero}-${generarToken(9)}`,
          monto: valor,
        },
      }));
    if (!reciente) {
      await this.auditoria.registrar('pago.iniciado', 'Pago', pago.id, usuario?.id ?? null, { monto: valor });
    }
    return { pago: serializarPago(pago), urlCheckout: this.proveedor.urlCheckout(pago, urlRetorno) };
  }

  /** Webhook del proveedor: solo se acepta con firma válida. */
  async procesarWebhook(cuerpo: unknown): Promise<ResultadoProcesamiento | 'firma_invalida'> {
    const resultado = this.proveedor.verificarWebhook(cuerpo);
    if (!resultado) return 'firma_invalida';
    return this.aplicarResultado(resultado);
  }

  /** Al volver del checkout, se consulta el estado directamente al proveedor. */
  async verificarTransaccion(pedidoId: string, transaccionId: string, token: string | undefined, usuario: UsuarioAutenticado | null) {
    await this.pedidos.obtenerConAcceso(pedidoId, token, usuario);
    const resultado = await this.proveedor.consultarTransaccion(transaccionId);
    if (resultado) {
      const pago = await this.prisma.pago.findUnique({ where: { referencia: resultado.referencia } });
      // La transacción consultada debe pertenecer a este pedido.
      if (!pago || pago.pedidoId !== pedidoId) throw new NotFoundException('Transacción no encontrada');
      await this.aplicarResultado(resultado);
    }
    return this.estadoPedido(pedidoId);
  }

  /**
   * Aplica un resultado verificado de forma idempotente:
   * 1) registra el evento con una clave única (si ya existía, no hace nada más);
   * 2) comprueba monto y moneda contra lo que se cobró;
   * 3) solo cambia pagos que aún no tienen estado final.
   */
  async aplicarResultado(r: ResultadoVerificado): Promise<ResultadoProcesamiento> {
    const pago = await this.prisma.pago.findUnique({ where: { referencia: r.referencia } });

    try {
      await this.prisma.eventoPago.create({
        data: {
          pagoId: pago?.id ?? null,
          claveIdempotencia: r.claveIdempotencia,
          tipo: r.tipo,
          estadoReportado: r.estado,
          firmaValida: true,
          payload: JSON.stringify(r.payload).slice(0, 20_000),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicado';
      throw e;
    }

    if (!pago) {
      this.logger.warn(`Evento para una referencia desconocida: ${r.referencia}`);
      return 'desconocido';
    }

    if (r.montoCentavos !== pago.monto * 100 || r.moneda !== pago.moneda) {
      await this.prisma.pago.update({ where: { id: pago.id }, data: { estado: 'ERROR' } });
      await this.auditoria.registrar('pago.inconsistente', 'Pago', pago.id, null, {
        esperado: pago.monto * 100,
        recibido: r.montoCentavos,
        moneda: r.moneda,
      });
      return 'inconsistente';
    }

    if (r.estado === 'PENDIENTE') return 'ignorado';
    // Un pago anulado localmente (p. ej. pedido cancelado) puede llegar aprobado más tarde:
    // se registra para no perder dinero del cliente y queda pendiente de reembolso.
    const desdeValidos = r.estado === 'APROBADO' ? ['PENDIENTE', 'ANULADO'] : ['PENDIENTE'];
    const pedido = await this.prisma.pedido.findUniqueOrThrow({ where: { id: pago.pedidoId } });
    const estadoFinal =
      r.estado === 'APROBADO' && pedido.estado === 'CANCELADO' ? 'REEMBOLSO_SOLICITADO' : r.estado;

    const cambio = await this.prisma.pago.updateMany({
      where: { id: pago.id, estado: { in: desdeValidos } },
      data: { estado: estadoFinal, transaccionProveedorId: r.transaccionId, metodo: r.metodo ?? null },
    });
    if (cambio.count === 0) return 'ignorado';

    await this.auditoria.registrar('pago.estado', 'Pago', pago.id, null, { estado: estadoFinal, proveedor: pago.proveedor });
    await this.recalcularEstadoPedido(pago.pedidoId);
    return 'aplicado';
  }

  /** Pago en efectivo o datáfono registrado por el mesero. */
  async registrarEfectivo(pedidoId: string, monto: number | undefined, usuario: UsuarioAutenticado) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, include: { pagos: true } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'CANCELADO') throw new ConflictException('El pedido está cancelado');
    const saldo = pedido.total - pedido.pagos.filter((p) => p.estado === 'APROBADO').reduce((s, p) => s + p.monto, 0);
    const valor = monto ?? saldo;
    if (saldo <= 0) throw new ConflictException('El pedido ya está pagado');
    if (!Number.isInteger(valor) || valor <= 0 || valor > saldo) {
      throw new BadRequestException(`El monto debe estar entre 1 y ${saldo} COP`);
    }
    const pago = await this.prisma.pago.create({
      data: {
        pedidoId,
        proveedor: 'efectivo',
        referencia: `EFE-${pedido.numero}-${generarToken(9)}`,
        monto: valor,
        estado: 'APROBADO',
        metodo: 'EFECTIVO_O_DATAFONO',
        registradoPorId: usuario.id,
      },
    });
    await this.auditoria.registrar('pago.efectivo', 'Pago', pago.id, usuario.id, { monto: valor });
    await this.recalcularEstadoPedido(pedidoId);
    return serializarPago(pago);
  }

  /** Paso 1 del reembolso: se marca para devolver. La devolución se hace en el panel del proveedor. */
  async solicitarReembolso(pagoId: string, usuario: UsuarioAutenticado) {
    return this.cambiarEstadoAdmin(pagoId, 'APROBADO', 'REEMBOLSO_SOLICITADO', usuario);
  }

  /** Paso 2: el administrador confirma que el dinero ya se devolvió. */
  async confirmarReembolso(pagoId: string, usuario: UsuarioAutenticado) {
    return this.cambiarEstadoAdmin(pagoId, 'REEMBOLSO_SOLICITADO', 'REEMBOLSADO', usuario);
  }

  async historial(pagina = 1) {
    const [total, pagos] = await this.prisma.$transaction([
      this.prisma.pago.count(),
      this.prisma.pago.findMany({
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * 50,
        take: 50,
        include: { pedido: { select: { numero: true } } },
      }),
    ]);
    return {
      total,
      pagina,
      pagos: pagos.map((p) => ({ ...serializarPago(p), pedidoNumero: `#${p.pedido.numero}` })),
    };
  }

  async pagosDelPedido(pedidoId: string, token: string | undefined, usuario: UsuarioAutenticado | null) {
    await this.pedidos.obtenerConAcceso(pedidoId, token, usuario);
    const pagos = await this.prisma.pago.findMany({ where: { pedidoId }, orderBy: { creadoEn: 'desc' } });
    return pagos.map(serializarPago);
  }

  private async cambiarEstadoAdmin(pagoId: string, desde: string, hacia: string, usuario: UsuarioAutenticado) {
    const r = await this.prisma.pago.updateMany({ where: { id: pagoId, estado: desde }, data: { estado: hacia } });
    if (r.count === 0) throw new ConflictException(`El pago debe estar en estado ${desde}`);
    const pago = await this.prisma.pago.findUniqueOrThrow({ where: { id: pagoId } });
    await this.auditoria.registrar(`pago.${hacia.toLowerCase()}`, 'Pago', pagoId, usuario.id);
    await this.recalcularEstadoPedido(pago.pedidoId);
    return serializarPago(pago);
  }

  private async recalcularEstadoPedido(pedidoId: string) {
    const pedido = await this.prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { pagos: true } });
    const aprobado = pedido.pagos.filter((p) => p.estado === 'APROBADO').reduce((s, p) => s + p.monto, 0);
    const reembolsado = pedido.pagos.some((p) => p.estado === 'REEMBOLSADO' || p.estado === 'REEMBOLSO_SOLICITADO');
    let estadoPago: EstadoPagoPedido = 'PENDIENTE';
    if (aprobado >= pedido.total) estadoPago = 'PAGADO';
    else if (aprobado > 0) estadoPago = 'PARCIAL';
    else if (reembolsado) estadoPago = 'REEMBOLSADO';
    if (aprobado > pedido.total) {
      await this.auditoria.registrar('pago.excedente', 'Pedido', pedidoId, null, { aprobado, total: pedido.total });
    }
    await this.prisma.pedido.update({ where: { id: pedidoId }, data: { estadoPago } });
    const serializado = await this.estadoPedido(pedidoId);
    this.pedidos.emitir(serializado);
    this.eventos.emitir({ tipo: 'pago.actualizado', pedidoId, datos: { pedidoId, estadoPago } });
  }

  private async estadoPedido(pedidoId: string) {
    return serializarPedido(await this.prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: INCLUIR_PEDIDO }));
  }
}
