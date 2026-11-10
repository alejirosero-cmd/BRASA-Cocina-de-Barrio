import { puedeTransicionar } from './transiciones';

describe('máquina de estados del pedido', () => {
  it('permite el flujo completo con los roles correctos', () => {
    expect(puedeTransicionar('PENDIENTE', 'CONFIRMADO', 'MESERO')).toBe(true);
    expect(puedeTransicionar('CONFIRMADO', 'EN_PREPARACION', 'COCINA')).toBe(true);
    expect(puedeTransicionar('EN_PREPARACION', 'LISTO', 'COCINA')).toBe(true);
    expect(puedeTransicionar('LISTO', 'ENTREGADO', 'MESERO')).toBe(true);
  });

  it('impide saltarse pasos', () => {
    expect(puedeTransicionar('PENDIENTE', 'LISTO', 'ADMIN')).toBe(false);
    expect(puedeTransicionar('CONFIRMADO', 'ENTREGADO', 'ADMIN')).toBe(false);
  });

  it('impide retroceder o reabrir pedidos terminados', () => {
    expect(puedeTransicionar('LISTO', 'EN_PREPARACION', 'COCINA')).toBe(false);
    expect(puedeTransicionar('ENTREGADO', 'PENDIENTE', 'ADMIN')).toBe(false);
    expect(puedeTransicionar('CANCELADO', 'CONFIRMADO', 'ADMIN')).toBe(false);
  });

  it('respeta las responsabilidades de cada rol', () => {
    expect(puedeTransicionar('LISTO', 'ENTREGADO', 'COCINA')).toBe(false);
    expect(puedeTransicionar('EN_PREPARACION', 'LISTO', 'MESERO')).toBe(false);
    expect(puedeTransicionar('PENDIENTE', 'CANCELADO', 'COCINA')).toBe(false);
    expect(puedeTransicionar('PENDIENTE', 'CONFIRMADO', 'CLIENTE')).toBe(false);
  });

  it('no permite cancelar un pedido que ya está en preparación', () => {
    expect(puedeTransicionar('EN_PREPARACION', 'CANCELADO', 'ADMIN')).toBe(false);
  });
});
