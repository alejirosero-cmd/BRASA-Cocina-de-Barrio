/**
 * Lectura y validación de variables de entorno. La aplicación no arranca si falta
 * algo obligatorio o si un valor es inseguro (ASVS V13 – Configuración).
 */
export interface Configuracion {
  entorno: string;
  esProduccion: boolean;
  puerto: number;
  frontendUrl: string;
  jwtSecret: string;
  jwtExpiraEn: string;
  impuestoPorcentaje: number;
  propinaMaxPorcentaje: number;
  pagos: {
    proveedor: 'simulado' | 'wompi';
    wompi: {
      publicKey: string;
      privateKey: string;
      eventsSecret: string;
      integritySecret: string;
      apiUrl: string;
      checkoutUrl: string;
    };
  };
}

function numero(nombre: string, valor: string | undefined, porDefecto: number, min: number, max: number): number {
  const n = valor === undefined || valor === '' ? porDefecto : Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${nombre} debe ser un número entre ${min} y ${max}`);
  }
  return n;
}

export function cargarConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  const entorno = env.NODE_ENV ?? 'development';
  const esProduccion = entorno === 'production';

  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32 || jwtSecret.startsWith('cambia-esto')) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres aleatorios (ver .env.example)');
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatoria');
  }

  const proveedor = (env.PAGOS_PROVEEDOR ?? 'simulado') as 'simulado' | 'wompi';
  if (proveedor !== 'simulado' && proveedor !== 'wompi') {
    throw new Error('PAGOS_PROVEEDOR debe ser "simulado" o "wompi"');
  }
  if (proveedor === 'simulado' && esProduccion) {
    throw new Error('El proveedor de pagos simulado no puede usarse en producción');
  }

  const wompi = {
    publicKey: env.WOMPI_PUBLIC_KEY ?? '',
    privateKey: env.WOMPI_PRIVATE_KEY ?? '',
    eventsSecret: env.WOMPI_EVENTS_SECRET ?? '',
    integritySecret: env.WOMPI_INTEGRITY_SECRET ?? '',
    apiUrl: env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1',
    checkoutUrl: env.WOMPI_CHECKOUT_URL || 'https://checkout.wompi.co/p/',
  };
  if (proveedor === 'wompi') {
    const faltantes = Object.entries(wompi)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (faltantes.length) {
      throw new Error(`Faltan variables de Wompi: ${faltantes.join(', ')}`);
    }
    if (!esProduccion && !wompi.publicKey.startsWith('pub_test_')) {
      throw new Error('Fuera de producción solo se permiten llaves de pruebas de Wompi (pub_test_...)');
    }
  }

  return {
    entorno,
    esProduccion,
    puerto: numero('PORT', env.PORT, 3000, 1, 65535),
    frontendUrl: env.FRONTEND_URL || 'http://localhost:4200',
    jwtSecret,
    jwtExpiraEn: env.JWT_EXPIRES_IN || '2h',
    impuestoPorcentaje: numero('IMPUESTO_PORCENTAJE', env.IMPUESTO_PORCENTAJE, 19, 0, 100),
    propinaMaxPorcentaje: numero('PROPINA_MAX_PORCENTAJE', env.PROPINA_MAX_PORCENTAJE, 20, 0, 100),
    pagos: { proveedor, wompi },
  };
}

export const CONFIGURACION = Symbol('CONFIGURACION');
