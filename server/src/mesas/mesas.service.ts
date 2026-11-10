import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { AuditoriaService } from '../common/auditoria.service';
import { generarCodigoMesa } from '../common/seguridad';
import { CONFIGURACION, Configuracion } from '../config/configuracion';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MesasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
  ) {}

  /** URL que codifica el QR impreso en la mesa. */
  urlMesa(codigo: string): string {
    return `${this.config.frontendUrl}/m/${codigo}`;
  }

  async listar() {
    const mesas = await this.prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
    return mesas.map((m) => ({ id: m.id, numero: m.numero, codigo: m.codigo, activa: m.activa, url: this.urlMesa(m.codigo) }));
  }

  /** Consulta pública a partir del código del QR. No revela nada más que el número. */
  async resolverCodigo(codigo: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { codigo: codigo.trim().toUpperCase() } });
    if (!mesa || !mesa.activa) throw new NotFoundException('El código de mesa no es válido');
    return { numero: mesa.numero, codigo: mesa.codigo };
  }

  async crear(numero: number, actorId: string) {
    if (await this.prisma.mesa.findUnique({ where: { numero } })) {
      throw new ConflictException(`La mesa ${numero} ya existe`);
    }
    const mesa = await this.prisma.mesa.create({ data: { numero, codigo: generarCodigoMesa() } });
    await this.auditoria.registrar('mesa.creada', 'Mesa', mesa.id, actorId, { numero });
    return { ...mesa, url: this.urlMesa(mesa.codigo) };
  }

  async actualizar(id: string, activa: boolean, actorId: string) {
    const mesa = await this.prisma.mesa.update({ where: { id }, data: { activa } }).catch(() => {
      throw new NotFoundException('Mesa no encontrada');
    });
    await this.auditoria.registrar('mesa.actualizada', 'Mesa', id, actorId, { activa });
    return { ...mesa, url: this.urlMesa(mesa.codigo) };
  }

  /** Invalida el QR anterior (p. ej. si alguien lo fotografió y hace pedidos falsos). */
  async regenerarCodigo(id: string, actorId: string) {
    const mesa = await this.prisma.mesa
      .update({ where: { id }, data: { codigo: generarCodigoMesa() } })
      .catch(() => {
        throw new NotFoundException('Mesa no encontrada');
      });
    await this.auditoria.registrar('mesa.qr_regenerado', 'Mesa', id, actorId);
    return { ...mesa, url: this.urlMesa(mesa.codigo) };
  }

  async qrSvg(id: string): Promise<string> {
    const mesa = await this.prisma.mesa.findUnique({ where: { id } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    return QRCode.toString(this.urlMesa(mesa.codigo), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  }
}
