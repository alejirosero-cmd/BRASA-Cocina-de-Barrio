import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Registro de acciones sensibles (ASVS V16 – Registro de seguridad). Nunca guarda secretos. */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger('Auditoria');

  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    accion: string,
    entidad: string,
    entidadId: string | null,
    actorId: string | null,
    detalle?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.registroAuditoria.create({
        data: { accion, entidad, entidadId, actorId, detalle: detalle ? JSON.stringify(detalle) : null },
      });
    } catch (error) {
      // La auditoría no debe tumbar la operación principal, pero sí dejar rastro.
      this.logger.error(`No se pudo registrar ${accion} sobre ${entidad}`, error as Error);
    }
  }
}
