import { cargarConfiguracion } from './configuracion';

const base = { DATABASE_URL: 'file:./x.db', JWT_SECRET: 'x'.repeat(40) };

describe('cargarConfiguracion', () => {
  it('carga valores por defecto seguros', () => {
    const c = cargarConfiguracion(base);
    expect(c.pagos.proveedor).toBe('simulado');
    expect(c.impuestoPorcentaje).toBe(19);
    expect(c.esProduccion).toBe(false);
  });

  it('rechaza un JWT_SECRET corto o el de ejemplo', () => {
    expect(() => cargarConfiguracion({ ...base, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
    expect(() => cargarConfiguracion({ ...base, JWT_SECRET: 'cambia-esto-por-un-secreto-largo-y-aleatorio' })).toThrow(/JWT_SECRET/);
  });

  it('prohíbe el proveedor simulado en producción', () => {
    expect(() => cargarConfiguracion({ ...base, NODE_ENV: 'production' })).toThrow(/simulado/);
  });

  it('exige todas las llaves de Wompi y solo de pruebas fuera de producción', () => {
    expect(() => cargarConfiguracion({ ...base, PAGOS_PROVEEDOR: 'wompi' })).toThrow(/Faltan variables/);
    const llaves = {
      PAGOS_PROVEEDOR: 'wompi',
      WOMPI_PUBLIC_KEY: 'pub_prod_x',
      WOMPI_PRIVATE_KEY: 'prv_prod_x',
      WOMPI_EVENTS_SECRET: 'e',
      WOMPI_INTEGRITY_SECRET: 'i',
    };
    expect(() => cargarConfiguracion({ ...base, ...llaves })).toThrow(/pruebas/);
    expect(cargarConfiguracion({ ...base, ...llaves, WOMPI_PUBLIC_KEY: 'pub_test_x' }).pagos.proveedor).toBe('wompi');
  });

  it('valida rangos numéricos', () => {
    expect(() => cargarConfiguracion({ ...base, IMPUESTO_PORCENTAJE: '150' })).toThrow(/IMPUESTO/);
  });
});
