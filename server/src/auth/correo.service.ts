import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIGURACION, Configuracion } from '../config/configuracion';

/**
 * Envío de correos. Por ahora solo hay un transporte de desarrollo que escribe el mensaje
 * en la consola del servidor. Para producción debe implementarse un transporte SMTP o de
 * un proveedor (pendiente documentado en docs/PENDIENTES.md).
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger('Correo');

  constructor(@Inject(CONFIGURACION) private readonly config: Configuracion) {}

  async enviarRecuperacion(destino: string, enlace: string): Promise<void> {
    if (this.config.esProduccion) {
      this.logger.error('No hay transporte de correo configurado para producción');
      return;
    }
    this.logger.log(`[DESARROLLO] Correo de recuperación para ${destino}: ${enlace}`);
  }
}
