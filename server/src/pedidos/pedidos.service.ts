import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsuarioAutenticado } from '../auth/decoradores';
import { AuditoriaService } from '../common/auditoria.service';
import { ESTADOS_ACTIVOS, EstadoPedido, ROLES_PERSONAL } from '../common/dominio';
import { EventosService } from '../common/eventos.service';
import { generarToken, iguales, leerJson, sha256 } from '../common/seguridad';
import { CONFIGURACION, Configuracion } from '../config/configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { CambiarEstadoDto, CrearPedidoDto, DatosFacturaDto } from './dto';
import {
  ErrorDePedido,
  ProductoParaPrecio,
  calcularLinea,
  calcularTotales,
  estimarTiempo,
} from './precios';
import { puedeTransicionar } from './transiciones';

export const INCLUIR_PEDIDO = {
  items: { include: { producto: { select: { imagenUrl: true, slug: true } } } },
  mesa: { select: { numero: true } },
  pagos: { select: { monto: true, estado: true } },
  calificacion: { select: { id: true } },
} satisfies Prisma.PedidoInclude;

export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof INCLUIR_PEDIDO }>;

/** Representación pública del pedido; compatible con el modelo `Pedido` del frontend. */
export function serializarPedido(p: PedidoCompleto) {
  const pagado = p.pagos.filter((x) => x.estado === 'APROBADO').reduce((s, x) => s + x.monto, 0);
  return {
    id: p.id,
    numero: `#${p.numero}`,
    tipo: p.tipo,
    mesa: { tipo: p.tipo, numero: p.mesa?.numero ?? null },
    estado: p.estado,
    estadoPago: p.estadoPago,
    items: p.items.map((i) => {
      const pers = leerJson<Record<string, unknown>>(i.personalizacion, {});
      return {
        id: i.id,
        productoId: i.producto.slug,
        nombre: i.nombre,
        imagenUrl: i.producto.imagenUrl,
        precioUnitario: i.precioUnitario,
        precioBase: i.precioUnitario,
        cantidad: i.cantidad,
        personalizacion: { extras: [], salsas: [], retirados: [], instrucciones: '', ...pers },
      };
    }),
    resumen: {
      subtotal: p.subtotal,
      descuento: p.descuento,
      impuestos: p.impuestos,
      propina: p.propina,
      total: p.total,
    },
    propinaPorcentaje: p.propinaPorcentaje,
    cupon: p.cuponCodigo,
    pagado,
    saldo: Math.max(0, p.total - pagado),
    notasCocina: p.notasCocina,
    tiempoEstimadoMin: p.tiempoEstimadoMin,
    facturaSolicitada: p.datosFactura !== null,
    calificado: p.calificacion !== null,
    motivoCancelacion: p.motivoCancelacion,
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  };
}

export type PedidoSerializado = ReturnType<typeof serializarPedido>;

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
  ) {}

  async crear(dto: CrearPedidoDto, usuario: UsuarioAutenticado | null) {
    if ((dto.propinaPorcentaje ?? 0) > this.config.propinaMaxPorcentaje) {
      throw new BadRequestException(`La propina no puede superar el ${this.config.propinaMaxPorcentaje} %`);
    }

    // Mesa: se identifica por el código del QR, nunca por un número escrito a mano.
    let mesaId: string | null = null;
    if (dto.tipo === 'mesa') {
      if (!dto.codigoMesa) throw new BadRequestException('Escanea el código QR de tu mesa');
      const mesa = await this.prisma.mesa.findUnique({ where: { codigo: dto.codigoMesa.toUpperCase() } });
      if (!mesa || !mesa.activa) throw new BadRequestException('El código de mesa no es válido');
      mesaId = mesa.id;
    }

    // Precios: siempre del catálogo de la base de datos.
    const slugs = [...new Set(dto.items.map((i) => i.productoId))];
    const registros = await this.prisma.producto.findMany({ where: { slug: { in: slugs } } });
    const productos: (ProductoParaPrecio & { id: string })[] = registros.map((r) => ({
      id: r.id,
      slug: r.slug,
      nombre: r.nombre,
      precio: r.precio,
      disponible: r.disponible,
      tiempoPreparacionMin: r.tiempoPreparacionMin,
      tamanos: leerJson(r.tamanos, []),
      extras: leerJson(r.extras, []),
      salsas: leerJson(r.salsas, []),
      retirables: leerJson(r.retirables, []),
    }));

    let lineas;
    try {
      lineas = dto.items.map((item) => {
        const producto = productos.find((p) => p.slug === item.productoId);
        if (!producto) throw new ErrorDePedido(`El producto "${item.productoId}" no existe`);
        return calcularLinea(producto, item);
      });
    } catch (e) {
      if (e instanceof ErrorDePedido) throw new BadRequestException(e.message);
      throw e;
    }

    const tokenSeguimiento = generarToken();
    const pedido = await this.prisma.$transaction(async (tx) => {
      let descuentoPorcentaje = 0;
      let cuponCodigo: string | null = null;
      if (dto.cupon) {
        const codigo = dto.cupon.toUpperCase();
        const cupon = await tx.cupon.findUnique({ where: { codigo } });
        const vigente =
          cupon &&
          cupon.activo &&
          (!cupon.venceEn || cupon.venceEn > new Date()) &&
          (cupon.usosMax === null || cupon.usos < cupon.usosMax);
        if (!vigente) throw new BadRequestException('El cupón no es válido o está vencido');
        descuentoPorcentaje = cupon.porcentaje;
        cuponCodigo = codigo;
        await tx.cupon.update({ where: { codigo }, data: { usos: { increment: 1 } } });
      }

      const propinaPorcentaje = dto.propinaPorcentaje ?? 0;
      const totales = calcularTotales(lineas, descuentoPorcentaje, this.config.impuestoPorcentaje, propinaPorcentaje);
      const ultimo = await tx.pedido.aggregate({ _max: { numero: true } });

      return tx.pedido.create({
        data: {
          numero: (ultimo._max.numero ?? 1000) + 1,
          tipo: dto.tipo,
          mesaId,
          clienteId: usuario?.rol === 'CLIENTE' ? usuario.id : null,
          ...totales,
          propinaPorcentaje,
          cuponCodigo,
          notasCocina: dto.notasCocina ?? '',
          tiempoEstimadoMin: estimarTiempo(productos, lineas),
          tokenSeguimientoHash: sha256(tokenSeguimiento),
          items: {
            create: lineas.map((l) => ({
              productoId: productos.find((p) => p.slug === l.productoSlug)!.id,
              nombre: l.nombre,
              precioUnitario: l.precioUnitario,
              cantidad: l.cantidad,
              personalizacion: JSON.stringify(l.personalizacion),
            })),
          },
          eventos: { create: { estado: 'PENDIENTE', actorId: usuario?.id ?? null } },
        },
        include: INCLUIR_PEDIDO,
      });
    });

    const serializado = serializarPedido(pedido);
    this.emitir(serializado);
    // El token en claro solo se entrega una vez; el servidor guarda su hash.
    return { pedido: serializado, tokenSeguimiento };
  }

  /**
   * Devuelve el pedido si quien consulta tiene derecho: personal del restaurante, el cliente
   * dueño, o quien presente el token de seguimiento. En otro caso responde 404 para no revelar
   * que el pedido existe (protección contra IDOR, ASVS V8.2).
   */
  async obtenerConAcceso(id: string, token: string | undefined, usuario: UsuarioAutenticado | null): Promise<PedidoCompleto> {
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, include: INCLUIR_PEDIDO });
    if (!pedido || !this.tieneAcceso(pedido, token, usuario)) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return pedido;
  }

  tieneAcceso(
    pedido: { clienteId: string | null; tokenSeguimientoHash: string },
    token: string | undefined,
    usuario: UsuarioAutenticado | null,
  ): boolean {
    if (usuario && ROLES_PERSONAL.includes(usuario.rol)) return true;
    if (usuario && pedido.clienteId === usuario.id) return true;
    return !!token && iguales(sha256(token), pedido.tokenSeguimientoHash);
  }

  async listarActivos() {
    const pedidos = await this.prisma.pedido.findMany({
      where: { estado: { in: ESTADOS_ACTIVOS } },
      include: INCLUIR_PEDIDO,
      orderBy: { creadoEn: 'asc' },
    });
    return pedidos.map(serializarPedido);
  }

  async listar(filtro: { estado?: string; desde?: Date; hasta?: Date }, pagina = 1) {
    const where: Prisma.PedidoWhereInput = {
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      creadoEn: { gte: filtro.desde, lte: filtro.hasta },
    };
    const [total, pedidos] = await this.prisma.$transaction([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({
        where,
        include: INCLUIR_PEDIDO,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * 50,
        take: 50,
      }),
    ]);
    return { total, pagina, pedidos: pedidos.map(serializarPedido) };
  }

  async listarDelCliente(clienteId: string) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { clienteId },
      include: INCLUIR_PEDIDO,
      orderBy: { creadoEn: 'desc' },
      take: 50,
    });
    return pedidos.map(serializarPedido);
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto, usuario: UsuarioAutenticado) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, include: { pagos: true } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    const desde = pedido.estado as EstadoPedido;

    if (!puedeTransicionar(desde, dto.estado, usuario.rol)) {
      throw new ForbiddenException(`No puedes pasar el pedido de ${desde} a ${dto.estado}`);
    }
    if (dto.estado === 'CANCELADO') {
      return this.cancelar(pedido.id, usuario, dto.nota ?? 'Cancelado por el restaurante');
    }
    return this.aplicarEstado(pedido.id, desde, dto.estado, usuario.id, dto.nota);
  }

  /** Cancelación por el cliente: solo mientras el pedido no ha sido confirmado. */
  async cancelarPorCliente(id: string, token: string | undefined, usuario: UsuarioAutenticado | null) {
    const pedido = await this.obtenerConAcceso(id, token, usuario);
    if (pedido.estado !== 'PENDIENTE') {
      throw new ConflictException('El pedido ya fue confirmado por el restaurante; pide ayuda al mesero');
    }
    return this.cancelar(id, usuario, 'Cancelado por el cliente');
  }

  private async cancelar(id: string, usuario: UsuarioAutenticado | null, motivo: string) {
    const pedido = await this.prisma.pedido.findUniqueOrThrow({ where: { id }, include: { pagos: true } });
    const aprobados = pedido.pagos.filter((p) => p.estado === 'APROBADO');
    if (aprobados.length > 0 && usuario?.rol !== 'ADMIN') {
      throw new ConflictException('El pedido tiene pagos aprobados: solo un administrador puede cancelarlo');
    }
    await this.prisma.$transaction([
      // Los pagos aprobados quedan marcados para reembolso; los pendientes se anulan.
      this.prisma.pago.updateMany({ where: { pedidoId: id, estado: 'APROBADO' }, data: { estado: 'REEMBOLSO_SOLICITADO' } }),
      this.prisma.pago.updateMany({ where: { pedidoId: id, estado: 'PENDIENTE' }, data: { estado: 'ANULADO' } }),
    ]);
    if (aprobados.length > 0) {
      await this.auditoria.registrar('pago.reembolso_solicitado', 'Pedido', id, usuario?.id ?? null, {
        pagos: aprobados.map((p) => p.referencia),
      });
    }
    return this.aplicarEstado(id, pedido.estado as EstadoPedido, 'CANCELADO', usuario?.id ?? null, motivo, motivo);
  }

  private async aplicarEstado(
    id: string,
    desde: EstadoPedido,
    hacia: EstadoPedido,
    actorId: string | null,
    nota?: string,
    motivoCancelacion?: string,
  ) {
    // Actualización condicionada al estado actual: si dos personas cambian el pedido a la vez,
    // solo una gana (evita saltos de estado por condiciones de carrera).
    const resultado = await this.prisma.pedido.updateMany({
      where: { id, estado: desde },
      data: { estado: hacia, ...(motivoCancelacion ? { motivoCancelacion } : {}) },
    });
    if (resultado.count === 0) {
      throw new ConflictException('El pedido cambió mientras tanto; actualiza la pantalla');
    }
    await this.prisma.eventoPedido.create({ data: { pedidoId: id, estado: hacia, actorId, nota } });
    await this.auditoria.registrar('pedido.estado', 'Pedido', id, actorId, { desde, hacia });
    const pedido = serializarPedido(
      await this.prisma.pedido.findUniqueOrThrow({ where: { id }, include: INCLUIR_PEDIDO }),
    );
    this.emitir(pedido);
    return pedido;
  }

  /** Cambia la propina mientras no haya pagos aprobados. Recalcula el total en el servidor. */
  async cambiarPropina(id: string, porcentaje: number, token: string | undefined, usuario: UsuarioAutenticado | null) {
    if (porcentaje > this.config.propinaMaxPorcentaje) {
      throw new BadRequestException(`La propina no puede superar el ${this.config.propinaMaxPorcentaje} %`);
    }
    const pedido = await this.obtenerConAcceso(id, token, usuario);
    if (pedido.estado === 'CANCELADO') throw new ConflictException('El pedido está cancelado');
    if (pedido.pagos.some((p) => p.estado === 'APROBADO' || p.estado === 'PENDIENTE')) {
      throw new ConflictException('No se puede cambiar la propina con pagos en curso o aprobados');
    }
    const base = pedido.subtotal - pedido.descuento;
    const propina = Math.round((base * porcentaje) / 100);
    await this.prisma.pedido.update({
      where: { id },
      data: { propinaPorcentaje: porcentaje, propina, total: base + pedido.impuestos + propina },
    });
    const actualizado = serializarPedido(
      await this.prisma.pedido.findUniqueOrThrow({ where: { id }, include: INCLUIR_PEDIDO }),
    );
    this.emitir(actualizado);
    return actualizado;
  }

  async guardarDatosFactura(id: string, dto: DatosFacturaDto, token: string | undefined, usuario: UsuarioAutenticado | null) {
    if (!dto.aceptaTratamientoDatos) {
      throw new BadRequestException('Debes autorizar el tratamiento de tus datos para emitir la factura');
    }
    await this.obtenerConAcceso(id, token, usuario);
    const { aceptaTratamientoDatos, ...datos } = dto;
    await this.prisma.pedido.update({
      where: { id },
      data: { datosFactura: JSON.stringify({ ...datos, autorizacionDatosEn: new Date().toISOString() }) },
    });
    await this.auditoria.registrar('pedido.factura_solicitada', 'Pedido', id, usuario?.id ?? null);
    return { mensaje: 'Datos de facturación registrados' };
  }

  emitir(pedido: PedidoSerializado): void {
    this.eventos.emitir({ tipo: 'pedido.actualizado', pedidoId: pedido.id, datos: pedido });
  }
}
