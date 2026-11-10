import { createHash } from 'node:crypto';
import { Configuracion } from '../config/configuracion';
import { ProveedorWompi } from './proveedores';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const config = {
  frontendUrl: 'http://localhost:4200',
  pagos: {
    proveedor: 'wompi',
    wompi: {
      publicKey: 'pub_test_abc',
      privateKey: 'prv_test_abc',
      eventsSecret: 'test_events_secreto',
      integritySecret: 'test_integrity_secreto',
      apiUrl: 'https://sandbox.wompi.co/v1',
      checkoutUrl: 'https://checkout.wompi.co/p/',
    },
  },
} as unknown as Configuracion;

function eventoFirmado(estado = 'APPROVED', secreto = 'test_events_secreto') {
  const transaction = { id: '1234-1610641025-49201', reference: 'BRASA-1001-abc', status: estado, amount_in_cents: 2522000, currency: 'COP', payment_method_type: 'NEQUI' };
  const timestamp = 1730000000;
  const checksum = sha(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${secreto}`);
  return {
    event: 'transaction.updated',
    data: { transaction },
    environment: 'test',
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum },
    timestamp,
  };
}

describe('ProveedorWompi', () => {
  const wompi = new ProveedorWompi(config);

  it('genera la firma de integridad: SHA256(referencia + centavos + moneda + secreto)', () => {
    expect(wompi.firmaIntegridad('REF1', 2522000)).toBe(sha('REF12522000COPtest_integrity_secreto'));
  });

  it('arma la URL del checkout con monto en centavos y firma', () => {
    const url = new URL(wompi.urlCheckout({ referencia: 'REF1', monto: 25220 }, 'http://localhost:4200/pago/resultado'));
    expect(url.searchParams.get('amount-in-cents')).toBe('2522000');
    expect(url.searchParams.get('currency')).toBe('COP');
    expect(url.searchParams.get('public-key')).toBe('pub_test_abc');
    expect(url.searchParams.get('signature:integrity')).toBe(wompi.firmaIntegridad('REF1', 2522000));
  });

  it('acepta un evento con firma válida y lo normaliza', () => {
    const r = wompi.verificarWebhook(eventoFirmado());
    expect(r).toMatchObject({ referencia: 'BRASA-1001-abc', estado: 'APROBADO', montoCentavos: 2522000, metodo: 'NEQUI' });
  });

  it('rechaza un evento firmado con otro secreto', () => {
    expect(wompi.verificarWebhook(eventoFirmado('APPROVED', 'otro'))).toBeNull();
  });

  it('rechaza un evento alterado después de firmado (monto cambiado)', () => {
    const evento = eventoFirmado();
    evento.data.transaction.amount_in_cents = 100;
    expect(wompi.verificarWebhook(evento)).toBeNull();
  });

  it('rechaza cuerpos sin firma', () => {
    expect(wompi.verificarWebhook({ data: {} })).toBeNull();
    expect(wompi.verificarWebhook(null)).toBeNull();
  });

  it('usa una clave de idempotencia distinta por estado', () => {
    expect(wompi.verificarWebhook(eventoFirmado('APPROVED'))!.claveIdempotencia).not.toBe(
      wompi.verificarWebhook(eventoFirmado('DECLINED'))!.claveIdempotencia,
    );
  });
});
