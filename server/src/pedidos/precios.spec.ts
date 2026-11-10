import { ErrorDePedido, ProductoParaPrecio, calcularLinea, calcularTotales, estimarTiempo } from './precios';

const hamburguesa: ProductoParaPrecio = {
  slug: 'brasa-original',
  nombre: 'Brasa Original',
  precio: 18900,
  disponible: true,
  tiempoPreparacionMin: 15,
  tamanos: [
    { id: 'sencilla', nombre: 'Sencilla', diferenciaPrecio: 0 },
    { id: 'doble', nombre: 'Doble carne', diferenciaPrecio: 6000 },
  ],
  extras: [
    { id: 'queso', nombre: 'Queso extra', precio: 2500 },
    { id: 'tocino', nombre: 'Tocino', precio: 3500 },
  ],
  salsas: [{ id: 'ajo', nombre: 'Alioli de ajo', precio: 1000 }],
  retirables: [{ id: 'cebolla', nombre: 'Cebolla' }],
};

describe('calcularLinea', () => {
  it('usa el primer tamaño por defecto y el precio del catálogo', () => {
    const l = calcularLinea(hamburguesa, { productoId: 'brasa-original', cantidad: 2 });
    expect(l.precioUnitario).toBe(18900);
    expect(l.personalizacion.tamano?.id).toBe('sencilla');
    expect(l.cantidad).toBe(2);
  });

  it('suma tamaño, extras y salsas', () => {
    const l = calcularLinea(hamburguesa, {
      productoId: 'brasa-original',
      cantidad: 1,
      tamanoId: 'doble',
      extras: ['queso', 'tocino'],
      salsas: ['ajo'],
    });
    expect(l.precioUnitario).toBe(18900 + 6000 + 2500 + 3500 + 1000);
  });

  it('ignora extras repetidos (no se cobran dos veces)', () => {
    const l = calcularLinea(hamburguesa, { productoId: 'brasa-original', cantidad: 1, extras: ['queso', 'queso'] });
    expect(l.precioUnitario).toBe(18900 + 2500);
  });

  it('acepta retirar ingredientes por id o por nombre', () => {
    expect(calcularLinea(hamburguesa, { productoId: 'x', cantidad: 1, retirados: ['cebolla'] }).personalizacion.retirados).toEqual(['Cebolla']);
    expect(calcularLinea(hamburguesa, { productoId: 'x', cantidad: 1, retirados: ['Cebolla'] }).personalizacion.retirados).toEqual(['Cebolla']);
  });

  it.each([
    ['tamaño inexistente', { tamanoId: 'triple' }],
    ['extra inexistente', { extras: ['caviar'] }],
    ['ingrediente no retirable', { retirados: ['Carne'] }],
    ['cantidad cero', { cantidad: 0 }],
    ['cantidad excesiva', { cantidad: 21 }],
    ['cantidad decimal', { cantidad: 1.5 }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(() => calcularLinea(hamburguesa, { productoId: 'brasa-original', cantidad: 1, ...cambio })).toThrow(ErrorDePedido);
  });

  it('rechaza productos agotados', () => {
    expect(() => calcularLinea({ ...hamburguesa, disponible: false }, { productoId: 'x', cantidad: 1 })).toThrow(
      /no está disponible/,
    );
  });
});

describe('calcularTotales', () => {
  it('reproduce la fórmula del carrito: impuestos y propina sobre (subtotal − descuento)', () => {
    const t = calcularTotales([{ precioUnitario: 10000, cantidad: 2 }], 10, 19, 10);
    expect(t).toEqual({ subtotal: 20000, descuento: 2000, impuestos: 3420, propina: 1800, total: 23220 });
  });

  it('sin descuento ni propina', () => {
    expect(calcularTotales([{ precioUnitario: 18900, cantidad: 1 }], 0, 19, 0).total).toBe(18900 + 3591);
  });
});

describe('estimarTiempo', () => {
  it('toma el plato más demorado más 2 minutos por unidad adicional, con tope de 90', () => {
    const linea = calcularLinea(hamburguesa, { productoId: 'x', cantidad: 3 });
    expect(estimarTiempo([hamburguesa], [linea])).toBe(15 + 4);
    const muchas = calcularLinea(hamburguesa, { productoId: 'x', cantidad: 20 });
    expect(estimarTiempo([hamburguesa], [muchas, muchas, muchas])).toBe(90);
  });
});
