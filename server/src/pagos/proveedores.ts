import { Inject, Injectable, Logger } from '@nestjs/common';
import { EstadoPago } from '../common/dominio';
import { iguales, sha256 } from '../common/seguridad';
import { CONFIGURACION, Configuracion } from '../config/configuracion';

/** Resultado de una transacción ya verificado (firma válida o consulta directa al proveedor). */
export interface ResultadoVerificado {
  /** Identificador único del evento: la misma notificación nunca se procesa dos veces. */
  claveIdempotencia: string;
  referencia: string;
  transaccionId: string;
  estado: EstadoPago;
  montoCentavos: number;
  moneda: string;
  metodo?: string;
  tipo: string;
  payload: unknown;
}

export interface ProveedorPago {
  readonly nombre: 'wompi' | 'simulado';
  urlCheckout(pago: { referencia: string; monto: number }, urlRetorno: string): string;
  /** Devuelve null si la firma no es válida. */
  verificarWebhook(cuerpo: unknown): ResultadoVerificado | null;
  /** Consulta el estado directamente al proveedor (no confía en datos del navegador). */
  consultarTransaccion(transaccionId: string): Promise<ResultadoVerificado | null>;
}

export const PROVEEDOR_PAGO = Symbol('PROVEEDOR_PAGO');

const ESTADOS_WOMPI: Record<string, EstadoPago> = {
  APPROVED: 'APROBADO',
  DECLINED: 'RECHAZADO',
  VOIDED: 'ANULADO',
  ERROR: 'ERROR',
  PENDING: 'PENDIENTE',
};

interface TransaccionWompi {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
}

/** Lee una ruta tipo "transaction.amount_in_cents" dentro de un objeto. */
function leerRuta(objeto: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>(
    (actual, clave) => (actual && typeof actual === 'object' ? (actual as Record<string, unknown>)[clave] : undefined),
    objeto,
  );
}

/**
 * Wompi (Bancolombia). Documentación: https://docs.wompi.co
 * - Checkout web con firma de integridad: SHA256(referencia + montoEnCentavos + moneda + secretoIntegridad).
 * - Eventos: SHA256(valores de signature.properties + timestamp + secretoEventos) == signature.checksum.
 */
@Injectable()
export class ProveedorWompi implements ProveedorPago {
  readonly nombre = 'wompi' as const;
  private readonly logger = new Logger('Wompi');

  constructor(@Inject(CONFIGURACION) private readonly config: Configuracion) {}

  private get w() {
    return this.config.pagos.wompi;
  }

  firmaIntegridad(referencia: string, montoCentavos: number, moneda = 'COP'): string {
    return sha256(`${referencia}${montoCentavos}${moneda}${this.w.integritySecret}`);
  }

  urlCheckout(pago: { referencia: string; monto: number }, urlRetorno: string): string {
    const centavos = pago.monto * 100;
    const params = new URLSearchParams({
      'public-key': this.w.publicKey,
      currency: 'COP',
      'amount-in-cents': String(centavos),
      reference: pago.referencia,
      'signature:integrity': this.firmaIntegridad(pago.referencia, centavos),
      'redirect-url': urlRetorno,
    });
    return `${this.w.checkoutUrl}?${params.toString()}`;
  }

  verificarWebhook(cuerpo: unknown): ResultadoVerificado | null {
    const evento = cuerpo as {
      event?: string;
      data?: { transaction?: TransaccionWompi };
      signature?: { properties?: unknown; checksum?: unknown };
      timestamp?: unknown;
    };
    const propiedades = evento?.signature?.properties;
    const checksum = evento?.signature?.checksum;
    const tx = evento?.data?.transaction;
    if (!Array.isArray(propiedades) || typeof checksum !== 'string' || !tx || evento.timestamp === undefined) {
      return null;
    }
    const concatenado =
      propiedades.map((p) => String(leerRuta(evento.data, String(p)) ?? '')).join('') +
      String(evento.timestamp) +
      this.w.eventsSecret;
    if (!iguales(sha256(concatenado), checksum.toLowerCase())) {
      this.logger.warn(`Evento de Wompi con firma inválida (referencia ${tx.reference})`);
      return null;
    }
    return this.normalizar(tx, `wompi:${tx.id}:${tx.status}:${evento.timestamp}`, evento.event ?? 'transaction.updated', cuerpo);
  }

  async consultarTransaccion(transaccionId: string): Promise<ResultadoVerificado | null> {
    if (!/^[\w-]{5,64}$/.test(transaccionId)) return null;
    const respuesta = await fetch(`${this.w.apiUrl}/transactions/${encodeURIComponent(transaccionId)}`, {
      headers: { Authorization: `Bearer ${this.w.privateKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) {
      this.logger.warn(`Wompi respondió ${respuesta.status} al consultar ${transaccionId}`);
      return null;
    }
    const cuerpo = (await respuesta.json()) as { data?: TransaccionWompi };
    if (!cuerpo.data) return null;
    return this.normalizar(cuerpo.data, `wompi:${cuerpo.data.id}:${cuerpo.data.status}:consulta`, 'consulta', cuerpo);
  }

  private normalizar(tx: TransaccionWompi, clave: string, tipo: string, payload: unknown): ResultadoVerificado | null {
    const estado = ESTADOS_WOMPI[tx.status];
    if (!estado) return null;
    return {
      claveIdempotencia: clave,
      referencia: tx.reference,
      transaccionId: tx.id,
      estado,
      montoCentavos: tx.amount_in_cents,
      moneda: tx.currency,
      metodo: tx.payment_method_type,
      tipo,
      payload,
    };
  }
}

/**
 * Proveedor de pruebas: no mueve dinero. La "pasarela" es una página del propio frontend
 * (/pago/simulado) donde se elige aprobar o rechazar. Está prohibido en producción
 * (ver cargarConfiguracion).
 */
@Injectable()
export class ProveedorSimulado implements ProveedorPago {
  readonly nombre = 'simulado' as const;

  constructor(@Inject(CONFIGURACION) private readonly config: Configuracion) {}

  urlCheckout(pago: { referencia: string; monto: number }, urlRetorno: string): string {
    const params = new URLSearchParams({ ref: pago.referencia, monto: String(pago.monto), retorno: urlRetorno });
    return `${this.config.frontendUrl}/pago/simulado?${params.toString()}`;
  }

  verificarWebhook(): ResultadoVerificado | null {
    return null;
  }

  async consultarTransaccion(): Promise<ResultadoVerificado | null> {
    return null;
  }

  resultado(referencia: string, monto: number, aprobar: boolean): ResultadoVerificado {
    const estado: EstadoPago = aprobar ? 'APROBADO' : 'RECHAZADO';
    return {
      claveIdempotencia: `simulado:${referencia}:${estado}`,
      referencia,
      transaccionId: `SIM-${referencia}`,
      estado,
      montoCentavos: monto * 100,
      moneda: 'COP',
      metodo: 'SIMULADO',
      tipo: 'simulado',
      payload: { referencia, aprobar },
    };
  }
}
