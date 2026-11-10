import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Producto } from '../../models/producto.model';
import { CarritoService, calcularPrecioUnitario, personalizacionPorDefecto } from './carrito.service';

const hamburguesa: Producto = {
  id: 'brasa-original',
  nombre: 'Brasa Original',
  descripcion: '',
  precio: 18900,
  categoria: 'hamburguesas',
  imagenUrl: 'img/x.svg',
  etiquetas: [],
  ingredientes: [],
  tamanos: [
    { id: 'sencilla', nombre: 'Sencilla', diferenciaPrecio: 0 },
    { id: 'doble', nombre: 'Doble', diferenciaPrecio: 6000 },
  ],
  extras: [{ id: 'tocino', nombre: 'Tocino', precio: 3500 }],
  salsas: [],
  retirables: [{ id: 'cebolla', nombre: 'Cebolla' }],
  tiempoPreparacionMin: 15,
};

describe('calcularPrecioUnitario', () => {
  it('suma tamaño y extras al precio base', () => {
    const p = { ...personalizacionPorDefecto(hamburguesa), tamano: hamburguesa.tamanos![1], extras: [hamburguesa.extras![0]] };
    expect(calcularPrecioUnitario(hamburguesa, p)).toBe(18900 + 6000 + 3500);
  });
});

describe('CarritoService', () => {
  let carrito: CarritoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    carrito = TestBed.inject(CarritoService);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));

  it('agrupa el mismo producto con la misma personalización', () => {
    carrito.agregarProducto(hamburguesa);
    carrito.agregarProducto(hamburguesa, 2);
    expect(carrito.lineas().length).toBe(1);
    expect(carrito.cantidadTotal()).toBe(3);
  });

  it('separa el mismo producto con personalizaciones distintas', () => {
    carrito.agregarProducto(hamburguesa);
    carrito.agregar({ producto: hamburguesa, cantidad: 1, personalizacion: { ...personalizacionPorDefecto(hamburguesa), retirados: ['Cebolla'] } });
    expect(carrito.lineas().length).toBe(2);
  });

  it('envía a la API solo identificadores, nunca precios', () => {
    carrito.agregar({
      producto: hamburguesa,
      cantidad: 2,
      personalizacion: { ...personalizacionPorDefecto(hamburguesa), extras: [hamburguesa.extras![0]], retirados: ['Cebolla'] },
    });
    const [item] = carrito.itemsParaApi();
    expect(item).toEqual({ productoId: 'brasa-original', cantidad: 2, tamanoId: 'sencilla', extras: ['tocino'], salsas: [], retirados: ['Cebolla'], instrucciones: '' });
    expect(JSON.stringify(item)).not.toContain('precio');
  });

  it('eliminar al llegar a cantidad cero', () => {
    carrito.agregarProducto(hamburguesa);
    carrito.reducir(carrito.lineas()[0].id);
    expect(carrito.estaVacio()).toBe(true);
  });

  it('convierte la propina a porcentaje entero para la API', () => {
    carrito.establecerPropina(0.12);
    expect(carrito.propinaEntera()).toBe(12);
  });
});
