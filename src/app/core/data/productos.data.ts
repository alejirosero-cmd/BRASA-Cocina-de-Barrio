import { Categoria, Producto } from '../../models/producto.model';

/*
 * Copia local del menú para cuando no hay conexión con el servidor.
 * Se genera a partir de backend/catalogo/datos/catalogo.json; los precios reales los calcula siempre el backend.
 */

export const CATEGORIAS: Categoria[] = [
  {
    id: 'populares',
    nombre: 'Populares',
  },
  {
    id: 'hamburguesas',
    nombre: 'Hamburguesas',
  },
  {
    id: 'pollo',
    nombre: 'Pollo y alitas',
  },
  {
    id: 'perros-sandwiches',
    nombre: 'Perros y sándwiches',
  },
  {
    id: 'combos',
    nombre: 'Combos',
  },
  {
    id: 'acompanamientos',
    nombre: 'Acompañamientos',
  },
  {
    id: 'ensaladas',
    nombre: 'Ensaladas y bowls',
  },
  {
    id: 'bebidas',
    nombre: 'Bebidas',
  },
  {
    id: 'postres',
    nombre: 'Postres',
  },
];

export const PRODUCTOS: Producto[] = [
  {
    id: 'brasa-original',
    nombre: 'Brasa Original',
    descripcion:
      'Carne de res 150 g a la parrilla, queso cheddar fundido, lechuga, tomate y salsa de la casa.',
    precio: 18900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/brasa-original.jpg',
    etiquetas: ['mas-vendido'],
    ingredientes: ['Carne de res', 'Queso cheddar', 'Lechuga', 'Tomate', 'Salsa de la casa'],
    tamanos: [
      {
        id: 'sencilla',
        nombre: 'Sencilla',
        diferenciaPrecio: 0,
      },
      {
        id: 'doble',
        nombre: 'Doble carne',
        diferenciaPrecio: 6000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'huevo',
        nombre: 'Huevo',
        precio: 2000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'cebolla',
        nombre: 'Cebolla',
      },
      {
        id: 'tomate',
        nombre: 'Tomate',
      },
      {
        id: 'lechuga',
        nombre: 'Lechuga',
      },
    ],
    tiempoPreparacionMin: 15,
  },
  {
    id: 'combo-brasa',
    nombre: 'Combo Brasa',
    descripcion:
      'Brasa Original acompañada de papas de la casa y limonada natural. La opción completa.',
    precio: 18900,
    categoria: 'combos',
    imagenUrl: 'img/combo-brasa.jpg',
    etiquetas: ['mas-vendido'],
    ingredientes: ['Brasa Original', 'Papas de la casa', 'Limonada natural'],
    tamanos: [
      {
        id: 'clasico',
        nombre: 'Clásico',
        diferenciaPrecio: 0,
      },
      {
        id: 'grande',
        nombre: 'Papas grandes',
        diferenciaPrecio: 3000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
    ],
    retirables: [
      {
        id: 'cebolla',
        nombre: 'Cebolla',
      },
    ],
    tiempoPreparacionMin: 18,
  },
  {
    id: 'pollo-crocante',
    nombre: 'Pollo Crocante',
    descripcion: 'Filete de pollo empanizado crocante, queso, lechuga y salsa especial de la casa.',
    precio: 21900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/pollo-crocante.jpg',
    etiquetas: [],
    ingredientes: ['Pollo empanizado', 'Queso', 'Lechuga', 'Salsa especial'],
    tamanos: [
      {
        id: 'sencilla',
        nombre: 'Sencilla',
        diferenciaPrecio: 0,
      },
      {
        id: 'doble',
        nombre: 'Doble filete',
        diferenciaPrecio: 7000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
    ],
    salsas: [
      {
        id: 'especial',
        nombre: 'Salsa especial',
        precio: 0,
      },
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
    ],
    retirables: [
      {
        id: 'lechuga',
        nombre: 'Lechuga',
      },
      {
        id: 'mayonesa',
        nombre: 'Mayonesa',
      },
    ],
    tiempoPreparacionMin: 16,
  },
  {
    id: 'verde-de-verdad',
    nombre: 'Verde de Verdad',
    descripcion:
      'Medallón de garbanzo y quinua, aguacate, tomate, lechuga y alioli de hierbas. Vegetariana.',
    precio: 19900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/verde-de-verdad.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Medallón de garbanzo', 'Quinua', 'Aguacate', 'Tomate', 'Alioli de hierbas'],
    tamanos: [
      {
        id: 'sencilla',
        nombre: 'Sencilla',
        diferenciaPrecio: 0,
      },
      {
        id: 'doble',
        nombre: 'Doble medallón',
        diferenciaPrecio: 5000,
      },
    ],
    extras: [
      {
        id: 'aguacate',
        nombre: 'Aguacate extra',
        precio: 3000,
      },
      {
        id: 'queso',
        nombre: 'Queso',
        precio: 2500,
      },
    ],
    salsas: [
      {
        id: 'hierbas',
        nombre: 'Alioli de hierbas',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
    ],
    retirables: [
      {
        id: 'cebolla',
        nombre: 'Cebolla',
      },
      {
        id: 'tomate',
        nombre: 'Tomate',
      },
    ],
    tiempoPreparacionMin: 14,
  },
  {
    id: 'papas-de-la-casa',
    nombre: 'Papas de la Casa',
    descripcion: 'Papas fritas naturales con sal marina y nuestra mezcla de especias.',
    precio: 6900,
    categoria: 'acompanamientos',
    imagenUrl: 'img/papas-de-la-casa.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Papas', 'Sal marina', 'Especias de la casa'],
    tamanos: [
      {
        id: 'personal',
        nombre: 'Personal',
        diferenciaPrecio: 0,
      },
      {
        id: 'para-compartir',
        nombre: 'Para compartir',
        diferenciaPrecio: 4000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso cheddar',
        precio: 3000,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 8,
  },
  {
    id: 'limonada-natural',
    nombre: 'Limonada Natural',
    descripcion: 'Limonada recién hecha, endulzada al gusto y servida bien fría.',
    precio: 7000,
    categoria: 'bebidas',
    imagenUrl: 'img/limonada-natural.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Limón', 'Agua', 'Azúcar'],
    tamanos: [
      {
        id: 'vaso',
        nombre: 'Vaso',
        diferenciaPrecio: 0,
      },
      {
        id: 'jarra',
        nombre: 'Jarra',
        diferenciaPrecio: 6000,
      },
    ],
    extras: [
      {
        id: 'hierbabuena',
        nombre: 'Hierbabuena',
        precio: 1000,
      },
      {
        id: 'coco',
        nombre: 'Coco',
        precio: 2000,
      },
    ],
    tiempoPreparacionMin: 5,
  },
  {
    id: 'malteada-vainilla',
    nombre: 'Malteada Vainilla',
    descripcion: 'Malteada cremosa de vainilla con crema batida y topping de la casa.',
    precio: 12900,
    categoria: 'bebidas',
    imagenUrl: 'img/malteada-vainilla.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Helado de vainilla', 'Leche', 'Crema batida'],
    tamanos: [
      {
        id: 'clasica',
        nombre: 'Clásica',
        diferenciaPrecio: 0,
      },
      {
        id: 'grande',
        nombre: 'Grande',
        diferenciaPrecio: 3000,
      },
    ],
    extras: [
      {
        id: 'oreo',
        nombre: 'Topping de Oreo',
        precio: 2500,
      },
      {
        id: 'arequipe',
        nombre: 'Arequipe',
        precio: 2000,
      },
    ],
    tiempoPreparacionMin: 7,
  },
  {
    id: 'brownie-helado',
    nombre: 'Brownie con Helado',
    descripcion: 'Brownie tibio de chocolate con bola de helado de vainilla y salsa de chocolate.',
    precio: 10900,
    categoria: 'postres',
    imagenUrl: 'img/brownie-con-helado.jpg',
    etiquetas: ['vegetariano', 'mas-vendido'],
    ingredientes: ['Brownie de chocolate', 'Helado de vainilla', 'Salsa de chocolate'],
    tamanos: [
      {
        id: 'unico',
        nombre: 'Porción',
        diferenciaPrecio: 0,
      },
    ],
    extras: [
      {
        id: 'helado-extra',
        nombre: 'Bola de helado extra',
        precio: 3000,
      },
      {
        id: 'arequipe',
        nombre: 'Arequipe',
        precio: 2000,
      },
    ],
    tiempoPreparacionMin: 10,
  },
  {
    id: 'doble-brasa',
    nombre: 'Doble Brasa',
    descripcion:
      'Dos carnes de res de 150 g, doble cheddar, tocino crujiente, cebolla caramelizada y salsa de la casa.',
    precio: 26900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/doble-brasa.jpg',
    etiquetas: ['mas-vendido'],
    ingredientes: [
      'Carne de res',
      'Queso cheddar',
      'Tocino',
      'Cebolla caramelizada',
      'Salsa de la casa',
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'huevo',
        nombre: 'Huevo',
        precio: 2000,
      },
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'cebolla',
        nombre: 'Cebolla',
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
      },
    ],
    tiempoPreparacionMin: 18,
  },
  {
    id: 'bbq-ahumada',
    nombre: 'BBQ Ahumada',
    descripcion:
      'Carne de res a la parrilla, queso provolone, aros de cebolla y salsa BBQ ahumada de la casa.',
    precio: 24900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/bbq-ahumada.jpg',
    etiquetas: [],
    ingredientes: ['Carne de res', 'Queso provolone', 'Aros de cebolla', 'Salsa BBQ'],
    tamanos: [
      {
        id: 'sencilla',
        nombre: 'Sencilla',
        diferenciaPrecio: 0,
      },
      {
        id: 'doble',
        nombre: 'Doble carne',
        diferenciaPrecio: 6000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'huevo',
        nombre: 'Huevo',
        precio: 2000,
      },
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'aros',
        nombre: 'Aros de cebolla',
      },
      {
        id: 'lechuga',
        nombre: 'Lechuga',
      },
    ],
    tiempoPreparacionMin: 16,
  },
  {
    id: 'la-picante',
    nombre: 'La Picante',
    descripcion:
      'Carne de res, queso pepper jack, jalapeños, guacamole y salsa chipotle. Para los valientes.',
    precio: 23900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/la-picante.jpg',
    etiquetas: ['picante'],
    ingredientes: ['Carne de res', 'Queso pepper jack', 'Jalapeños', 'Guacamole', 'Salsa chipotle'],
    tamanos: [
      {
        id: 'sencilla',
        nombre: 'Sencilla',
        diferenciaPrecio: 0,
      },
      {
        id: 'doble',
        nombre: 'Doble carne',
        diferenciaPrecio: 6000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'huevo',
        nombre: 'Huevo',
        precio: 2000,
      },
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'jalapenos',
        nombre: 'Jalapeños',
      },
      {
        id: 'guacamole',
        nombre: 'Guacamole',
      },
    ],
    tiempoPreparacionMin: 16,
  },
  {
    id: 'hongos-y-suizo',
    nombre: 'Hongos y Suizo',
    descripcion:
      'Carne de res, champiñones salteados en mantequilla, queso suizo fundido y alioli.',
    precio: 24500,
    categoria: 'hamburguesas',
    imagenUrl: 'img/hongos-y-suizo.jpg',
    etiquetas: [],
    ingredientes: ['Carne de res', 'Champiñones', 'Queso suizo', 'Alioli'],
    tamanos: [
      {
        id: 'sencilla',
        nombre: 'Sencilla',
        diferenciaPrecio: 0,
      },
      {
        id: 'doble',
        nombre: 'Doble carne',
        diferenciaPrecio: 6000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'huevo',
        nombre: 'Huevo',
        precio: 2000,
      },
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'champinones',
        nombre: 'Champiñones',
      },
      {
        id: 'alioli',
        nombre: 'Alioli',
      },
    ],
    tiempoPreparacionMin: 16,
  },
  {
    id: 'brasita',
    nombre: 'Brasita',
    descripcion:
      'Hamburguesa pequeña con carne de 90 g, queso y salsa de tomate. Ideal para los niños.',
    precio: 13900,
    categoria: 'hamburguesas',
    imagenUrl: 'img/brasita.jpg',
    etiquetas: [],
    ingredientes: ['Carne de res 90 g', 'Queso', 'Salsa de tomate'],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
    ],
    retirables: [
      {
        id: 'salsa',
        nombre: 'Salsa de tomate',
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'alitas-bbq',
    nombre: 'Alitas BBQ',
    descripcion:
      'Alitas de pollo horneadas y glaseadas en salsa BBQ. Con apio, zanahoria y salsa ranch.',
    precio: 23900,
    categoria: 'pollo',
    imagenUrl: 'img/alitas-bbq.jpg',
    etiquetas: ['para-compartir'],
    ingredientes: ['Alitas de pollo', 'Salsa BBQ', 'Apio', 'Zanahoria', 'Ranch'],
    tamanos: [
      {
        id: 'x8',
        nombre: '8 alitas',
        diferenciaPrecio: 0,
      },
      {
        id: 'x12',
        nombre: '12 alitas',
        diferenciaPrecio: 9000,
      },
      {
        id: 'x20',
        nombre: '20 alitas',
        diferenciaPrecio: 21000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'BBQ',
        precio: 0,
      },
      {
        id: 'bufalo',
        nombre: 'Búfalo picante',
        precio: 0,
      },
      {
        id: 'miel-mostaza',
        nombre: 'Miel mostaza',
        precio: 0,
      },
      {
        id: 'ranch',
        nombre: 'Ranch',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 20,
  },
  {
    id: 'alitas-bufalo',
    nombre: 'Alitas Búfalo',
    descripcion: 'Alitas crocantes bañadas en salsa búfalo picante, con apio y queso azul.',
    precio: 23900,
    categoria: 'pollo',
    imagenUrl: 'img/alitas-bufalo.jpg',
    etiquetas: ['picante', 'para-compartir'],
    ingredientes: ['Alitas de pollo', 'Salsa búfalo', 'Apio', 'Queso azul'],
    tamanos: [
      {
        id: 'x8',
        nombre: '8 alitas',
        diferenciaPrecio: 0,
      },
      {
        id: 'x12',
        nombre: '12 alitas',
        diferenciaPrecio: 9000,
      },
      {
        id: 'x20',
        nombre: '20 alitas',
        diferenciaPrecio: 21000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'BBQ',
        precio: 0,
      },
      {
        id: 'bufalo',
        nombre: 'Búfalo picante',
        precio: 0,
      },
      {
        id: 'miel-mostaza',
        nombre: 'Miel mostaza',
        precio: 0,
      },
      {
        id: 'ranch',
        nombre: 'Ranch',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 20,
  },
  {
    id: 'deditos-de-pollo',
    nombre: 'Deditos de Pollo',
    descripcion: 'Tiras de pechuga apanadas y crocantes, con papas de la casa y miel mostaza.',
    precio: 17900,
    categoria: 'pollo',
    imagenUrl: 'img/deditos-de-pollo.jpg',
    etiquetas: [],
    ingredientes: ['Pechuga de pollo apanada', 'Papas de la casa', 'Miel mostaza'],
    tamanos: [
      {
        id: 'x5',
        nombre: '5 deditos',
        diferenciaPrecio: 0,
      },
      {
        id: 'x8',
        nombre: '8 deditos',
        diferenciaPrecio: 6000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'BBQ',
        precio: 0,
      },
      {
        id: 'bufalo',
        nombre: 'Búfalo picante',
        precio: 0,
      },
      {
        id: 'miel-mostaza',
        nombre: 'Miel mostaza',
        precio: 0,
      },
      {
        id: 'ranch',
        nombre: 'Ranch',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 15,
  },
  {
    id: 'pechuga-a-la-parrilla',
    nombre: 'Pechuga a la Parrilla',
    descripcion: 'Pechuga marinada en hierbas a la parrilla, con ensalada fresca y papa criolla.',
    precio: 24900,
    categoria: 'pollo',
    imagenUrl: 'img/pechuga-a-la-parrilla.jpg',
    etiquetas: ['sin-gluten'],
    ingredientes: ['Pechuga de pollo', 'Hierbas', 'Ensalada', 'Papa criolla'],
    extras: [
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
      {
        id: 'arroz',
        nombre: 'Porción de arroz',
        precio: 3500,
      },
    ],
    retirables: [
      {
        id: 'ensalada',
        nombre: 'Ensalada',
      },
    ],
    tiempoPreparacionMin: 20,
  },
  {
    id: 'perro-del-barrio',
    nombre: 'Perro del Barrio',
    descripcion:
      'Salchicha americana, papita ripio, queso, cebolla, salsa rosada, piña y mostaza. El de siempre.',
    precio: 15900,
    categoria: 'perros-sandwiches',
    imagenUrl: 'img/perro-del-barrio.jpg',
    etiquetas: ['mas-vendido'],
    ingredientes: ['Salchicha americana', 'Papita ripio', 'Queso', 'Salsa de piña', 'Salsa rosada'],
    extras: [
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'huevos',
        nombre: 'Huevos de codorniz',
        precio: 3000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'cebolla',
        nombre: 'Cebolla',
      },
      {
        id: 'pina',
        nombre: 'Salsa de piña',
      },
      {
        id: 'ripio',
        nombre: 'Papita ripio',
      },
    ],
    tiempoPreparacionMin: 10,
  },
  {
    id: 'perro-suizo',
    nombre: 'Perro Suizo con Tocino',
    descripcion: 'Salchicha suiza a la parrilla, tocino, queso fundido y cebolla crispy.',
    precio: 18900,
    categoria: 'perros-sandwiches',
    imagenUrl: 'img/perro-suizo.jpg',
    etiquetas: [],
    ingredientes: ['Salchicha suiza', 'Tocino', 'Queso', 'Cebolla crispy'],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'jalapenos',
        nombre: 'Jalapeños',
        precio: 1500,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    retirables: [
      {
        id: 'cebolla',
        nombre: 'Cebolla crispy',
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'sandwich-cubano',
    nombre: 'Sándwich Cubano',
    descripcion: 'Pan prensado con cerdo desmechado, jamón, queso suizo, pepinillos y mostaza.',
    precio: 21900,
    categoria: 'perros-sandwiches',
    imagenUrl: 'img/sandwich-cubano.jpg',
    etiquetas: [],
    ingredientes: ['Cerdo desmechado', 'Jamón', 'Queso suizo', 'Pepinillos', 'Mostaza'],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
    ],
    retirables: [
      {
        id: 'pepinillos',
        nombre: 'Pepinillos',
      },
      {
        id: 'mostaza',
        nombre: 'Mostaza',
      },
    ],
    tiempoPreparacionMin: 14,
  },
  {
    id: 'wrap-de-pollo',
    nombre: 'Wrap de Pollo',
    descripcion:
      'Tortilla de trigo con pollo a la plancha, lechuga, tomate, queso y aderezo de yogur.',
    precio: 18900,
    categoria: 'perros-sandwiches',
    imagenUrl: 'img/wrap-de-pollo.jpg',
    etiquetas: [],
    ingredientes: [
      'Pollo a la plancha',
      'Tortilla de trigo',
      'Lechuga',
      'Tomate',
      'Aderezo de yogur',
    ],
    extras: [
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
    ],
    retirables: [
      {
        id: 'tomate',
        nombre: 'Tomate',
      },
      {
        id: 'aderezo',
        nombre: 'Aderezo',
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'combo-crocante',
    nombre: 'Combo Crocante',
    descripcion: 'Pollo Crocante con papas de la casa y gaseosa. Llénate sin pensarlo.',
    precio: 26900,
    categoria: 'combos',
    imagenUrl: 'img/combo-crocante.jpg',
    etiquetas: [],
    ingredientes: ['Pollo Crocante', 'Papas de la casa', 'Gaseosa'],
    tamanos: [
      {
        id: 'clasico',
        nombre: 'Clásico',
        diferenciaPrecio: 0,
      },
      {
        id: 'agrandado',
        nombre: 'Agrandado',
        diferenciaPrecio: 4000,
      },
    ],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso extra',
        precio: 2500,
      },
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 18,
  },
  {
    id: 'combo-familiar',
    nombre: 'Combo Familiar',
    descripcion:
      '4 hamburguesas Brasa Original, papas para compartir, 8 alitas BBQ y jarra de limonada.',
    precio: 89900,
    categoria: 'combos',
    imagenUrl: 'img/combo-familiar.jpg',
    etiquetas: ['mas-vendido', 'para-compartir'],
    ingredientes: ['4 Brasa Original', 'Papas para compartir', '8 alitas BBQ', 'Jarra de limonada'],
    extras: [
      {
        id: 'alitas',
        nombre: '8 alitas más',
        precio: 18000,
      },
      {
        id: 'papas',
        nombre: 'Papas extra',
        precio: 6900,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 25,
  },
  {
    id: 'combo-brasita',
    nombre: 'Combo Brasita',
    descripcion:
      'Hamburguesa Brasita, papas pequeñas, jugo natural y una sorpresa. Para los más pequeños.',
    precio: 19900,
    categoria: 'combos',
    imagenUrl: 'img/combo-brasita.jpg',
    etiquetas: [],
    ingredientes: ['Brasita', 'Papas pequeñas', 'Jugo natural'],
    salsas: [
      {
        id: 'tomate',
        nombre: 'Salsa de tomate',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'aros-de-cebolla',
    nombre: 'Aros de Cebolla',
    descripcion: 'Aros de cebolla apanados en cerveza, dorados y crocantes, con salsa BBQ.',
    precio: 9900,
    categoria: 'acompanamientos',
    imagenUrl: 'img/aros-de-cebolla.jpg',
    etiquetas: ['vegetariano', 'para-compartir'],
    ingredientes: ['Cebolla', 'Apanado de cerveza', 'Salsa BBQ'],
    tamanos: [
      {
        id: 'personal',
        nombre: 'Personal',
        diferenciaPrecio: 0,
      },
      {
        id: 'para-compartir',
        nombre: 'Para compartir',
        diferenciaPrecio: 5000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 10,
  },
  {
    id: 'papas-cheddar-tocino',
    nombre: 'Papas Cheddar y Tocino',
    descripcion: 'Papas de la casa bañadas en queso cheddar fundido, tocino y cebollín.',
    precio: 14900,
    categoria: 'acompanamientos',
    imagenUrl: 'img/papas-cheddar-tocino.jpg',
    etiquetas: ['para-compartir'],
    ingredientes: ['Papas', 'Queso cheddar', 'Tocino', 'Cebollín'],
    tamanos: [
      {
        id: 'personal',
        nombre: 'Personal',
        diferenciaPrecio: 0,
      },
      {
        id: 'para-compartir',
        nombre: 'Para compartir',
        diferenciaPrecio: 5000,
      },
    ],
    extras: [
      {
        id: 'jalapenos',
        nombre: 'Jalapeños',
        precio: 1500,
      },
    ],
    retirables: [
      {
        id: 'tocino',
        nombre: 'Tocino',
      },
      {
        id: 'cebollin',
        nombre: 'Cebollín',
      },
    ],
    tiempoPreparacionMin: 10,
  },
  {
    id: 'yucas-fritas',
    nombre: 'Yucas Fritas',
    descripcion:
      'Bastones de yuca fritos, crujientes por fuera y suaves por dentro, con suero costeño.',
    precio: 8900,
    categoria: 'acompanamientos',
    imagenUrl: 'img/yucas-fritas.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Yuca', 'Sal', 'Suero costeño'],
    tamanos: [
      {
        id: 'personal',
        nombre: 'Personal',
        diferenciaPrecio: 0,
      },
      {
        id: 'para-compartir',
        nombre: 'Para compartir',
        diferenciaPrecio: 5000,
      },
    ],
    tiempoPreparacionMin: 10,
  },
  {
    id: 'papas-de-batata',
    nombre: 'Papas de Batata',
    descripcion: 'Bastones de batata dulce con un toque de sal marina y alioli.',
    precio: 10900,
    categoria: 'acompanamientos',
    imagenUrl: 'img/papas-de-batata.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Batata', 'Sal marina', 'Alioli'],
    tamanos: [
      {
        id: 'personal',
        nombre: 'Personal',
        diferenciaPrecio: 0,
      },
      {
        id: 'para-compartir',
        nombre: 'Para compartir',
        diferenciaPrecio: 5000,
      },
    ],
    salsas: [
      {
        id: 'bbq',
        nombre: 'Salsa BBQ',
        precio: 0,
      },
      {
        id: 'picante',
        nombre: 'Salsa picante',
        precio: 0,
      },
      {
        id: 'rosada',
        nombre: 'Salsa rosada',
        precio: 0,
      },
      {
        id: 'ajo',
        nombre: 'Alioli de ajo',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 10,
  },
  {
    id: 'mazorca-con-queso',
    nombre: 'Mazorca con Queso',
    descripcion: 'Mazorca asada a la brasa con mantequilla, queso costeño rallado y limón.',
    precio: 8900,
    categoria: 'acompanamientos',
    imagenUrl: 'img/mazorca-con-queso.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Mazorca', 'Mantequilla', 'Queso costeño', 'Limón'],
    retirables: [
      {
        id: 'queso',
        nombre: 'Queso',
      },
      {
        id: 'mantequilla',
        nombre: 'Mantequilla',
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'ensalada-cesar',
    nombre: 'César con Pollo',
    descripcion: 'Lechuga romana, pollo a la parrilla, crutones, parmesano y aderezo César.',
    precio: 21900,
    categoria: 'ensaladas',
    imagenUrl: 'img/ensalada-cesar.jpg',
    etiquetas: [],
    ingredientes: [
      'Lechuga romana',
      'Pollo a la parrilla',
      'Crutones',
      'Parmesano',
      'Aderezo César',
    ],
    extras: [
      {
        id: 'tocino',
        nombre: 'Tocino',
        precio: 3500,
      },
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
    ],
    retirables: [
      {
        id: 'crutones',
        nombre: 'Crutones',
      },
      {
        id: 'parmesano',
        nombre: 'Parmesano',
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'bowl-vegetariano',
    nombre: 'Bowl Vegetariano',
    descripcion:
      'Quinua, garbanzos asados, aguacate, maíz, tomate cherry, espinaca y vinagreta de limón.',
    precio: 22900,
    categoria: 'ensaladas',
    imagenUrl: 'img/bowl-vegetariano.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Quinua', 'Garbanzos', 'Aguacate', 'Maíz', 'Tomate cherry', 'Espinaca'],
    extras: [
      {
        id: 'queso',
        nombre: 'Queso campesino',
        precio: 2500,
      },
      {
        id: 'huevo',
        nombre: 'Huevo cocido',
        precio: 2000,
      },
    ],
    retirables: [
      {
        id: 'garbanzos',
        nombre: 'Garbanzos',
      },
      {
        id: 'maiz',
        nombre: 'Maíz',
      },
    ],
    tiempoPreparacionMin: 12,
  },
  {
    id: 'ensalada-de-la-casa',
    nombre: 'Ensalada de la Casa',
    descripcion: 'Mezcla de hojas verdes, tomate, pepino, zanahoria y vinagreta de la casa.',
    precio: 12900,
    categoria: 'ensaladas',
    imagenUrl: 'img/ensalada-de-la-casa.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Hojas verdes', 'Tomate', 'Pepino', 'Zanahoria', 'Vinagreta'],
    extras: [
      {
        id: 'pollo',
        nombre: 'Pollo a la parrilla',
        precio: 6000,
      },
      {
        id: 'aguacate',
        nombre: 'Aguacate',
        precio: 3000,
      },
    ],
    tiempoPreparacionMin: 8,
  },
  {
    id: 'gaseosa',
    nombre: 'Gaseosa',
    descripcion:
      'Gaseosa bien fría: cola, naranja, limón o uva. Escribe el sabor en la nota del pedido.',
    precio: 4900,
    categoria: 'bebidas',
    imagenUrl: 'img/gaseosa.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Gaseosa'],
    tamanos: [
      {
        id: 'personal',
        nombre: 'Personal 400 ml',
        diferenciaPrecio: 0,
      },
      {
        id: 'litro',
        nombre: '1,5 L para compartir',
        diferenciaPrecio: 4000,
      },
    ],
    extras: [
      {
        id: 'hielo',
        nombre: 'Vaso con hielo',
        precio: 0,
      },
    ],
    tiempoPreparacionMin: 2,
  },
  {
    id: 'jugo-de-mora',
    nombre: 'Jugo de Mora',
    descripcion: 'Jugo natural de mora en agua o en leche, recién preparado.',
    precio: 7900,
    categoria: 'bebidas',
    imagenUrl: 'img/jugo-de-mora.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Mora', 'Agua o leche'],
    tamanos: [
      {
        id: 'vaso',
        nombre: 'Vaso 400 ml',
        diferenciaPrecio: 0,
      },
      {
        id: 'jarra',
        nombre: 'Jarra 1 L',
        diferenciaPrecio: 7000,
      },
    ],
    extras: [
      {
        id: 'leche',
        nombre: 'Preparado en leche',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 5,
  },
  {
    id: 'jugo-de-maracuya',
    nombre: 'Jugo de Maracuyá',
    descripcion: 'Jugo natural de maracuyá, refrescante y con el punto justo de dulce.',
    precio: 7900,
    categoria: 'bebidas',
    imagenUrl: 'img/jugo-de-maracuya.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Maracuyá', 'Agua o leche'],
    tamanos: [
      {
        id: 'vaso',
        nombre: 'Vaso 400 ml',
        diferenciaPrecio: 0,
      },
      {
        id: 'jarra',
        nombre: 'Jarra 1 L',
        diferenciaPrecio: 7000,
      },
    ],
    extras: [
      {
        id: 'leche',
        nombre: 'Preparado en leche',
        precio: 1000,
      },
    ],
    tiempoPreparacionMin: 5,
  },
  {
    id: 'limonada-de-coco',
    nombre: 'Limonada de Coco',
    descripcion: 'Limonada cremosa con leche de coco y hielo frappé.',
    precio: 9900,
    categoria: 'bebidas',
    imagenUrl: 'img/limonada-de-coco.jpg',
    etiquetas: ['vegetariano', 'sin-gluten', 'mas-vendido'],
    ingredientes: ['Limón', 'Leche de coco', 'Hielo'],
    tamanos: [
      {
        id: 'vaso',
        nombre: 'Vaso 400 ml',
        diferenciaPrecio: 0,
      },
      {
        id: 'jarra',
        nombre: 'Jarra 1 L',
        diferenciaPrecio: 7000,
      },
    ],
    tiempoPreparacionMin: 5,
  },
  {
    id: 'te-helado',
    nombre: 'Té Helado',
    descripcion: 'Té negro frío con limón y un toque de durazno.',
    precio: 6900,
    categoria: 'bebidas',
    imagenUrl: 'img/te-helado.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Té negro', 'Limón', 'Durazno'],
    tamanos: [
      {
        id: 'vaso',
        nombre: 'Vaso 400 ml',
        diferenciaPrecio: 0,
      },
      {
        id: 'jarra',
        nombre: 'Jarra 1 L',
        diferenciaPrecio: 7000,
      },
    ],
    tiempoPreparacionMin: 3,
  },
  {
    id: 'cafe-americano',
    nombre: 'Café Americano',
    descripcion: 'Café colombiano de origen, recién molido.',
    precio: 4500,
    categoria: 'bebidas',
    imagenUrl: 'img/cafe-americano.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Café colombiano'],
    tamanos: [
      {
        id: 'pequeno',
        nombre: 'Pequeño 8 oz',
        diferenciaPrecio: 0,
      },
      {
        id: 'grande',
        nombre: 'Grande 12 oz',
        diferenciaPrecio: 1500,
      },
    ],
    tiempoPreparacionMin: 4,
  },
  {
    id: 'capuchino',
    nombre: 'Capuchino',
    descripcion: 'Espresso colombiano con leche vaporizada y espuma cremosa.',
    precio: 6900,
    categoria: 'bebidas',
    imagenUrl: 'img/capuchino.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Espresso', 'Leche', 'Espuma de leche'],
    tamanos: [
      {
        id: 'pequeno',
        nombre: 'Pequeño 8 oz',
        diferenciaPrecio: 0,
      },
      {
        id: 'grande',
        nombre: 'Grande 12 oz',
        diferenciaPrecio: 1500,
      },
    ],
    extras: [
      {
        id: 'canela',
        nombre: 'Canela',
        precio: 0,
      },
      {
        id: 'vainilla',
        nombre: 'Jarabe de vainilla',
        precio: 1500,
      },
    ],
    tiempoPreparacionMin: 5,
  },
  {
    id: 'agua',
    nombre: 'Agua',
    descripcion: 'Agua natural o con gas.',
    precio: 3900,
    categoria: 'bebidas',
    imagenUrl: 'img/agua.jpg',
    etiquetas: ['vegetariano', 'sin-gluten'],
    ingredientes: ['Agua'],
    extras: [
      {
        id: 'con-gas',
        nombre: 'Con gas',
        precio: 0,
      },
      {
        id: 'limon',
        nombre: 'Con limón',
        precio: 0,
      },
    ],
    tiempoPreparacionMin: 1,
  },
  {
    id: 'malteada-chocolate',
    nombre: 'Malteada de Chocolate',
    descripcion: 'Helado de chocolate batido con leche, crema chantilly y salsa de chocolate.',
    precio: 13900,
    categoria: 'bebidas',
    imagenUrl: 'img/malteada-chocolate.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Helado de chocolate', 'Leche', 'Crema chantilly', 'Salsa de chocolate'],
    tamanos: [
      {
        id: 'clasica',
        nombre: 'Clásica',
        diferenciaPrecio: 0,
      },
      {
        id: 'grande',
        nombre: 'Grande',
        diferenciaPrecio: 4000,
      },
    ],
    extras: [
      {
        id: 'brownie',
        nombre: 'Trozos de brownie',
        precio: 3000,
      },
    ],
    tiempoPreparacionMin: 6,
  },
  {
    id: 'malteada-fresa',
    nombre: 'Malteada de Fresa',
    descripcion: 'Helado de fresa batido con leche y fresas naturales, coronado con crema.',
    precio: 13900,
    categoria: 'bebidas',
    imagenUrl: 'img/malteada-fresa.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Helado de fresa', 'Fresas', 'Leche', 'Crema chantilly'],
    tamanos: [
      {
        id: 'clasica',
        nombre: 'Clásica',
        diferenciaPrecio: 0,
      },
      {
        id: 'grande',
        nombre: 'Grande',
        diferenciaPrecio: 4000,
      },
    ],
    tiempoPreparacionMin: 6,
  },
  {
    id: 'sundae-arequipe',
    nombre: 'Sundae de Arequipe',
    descripcion: 'Helado de vainilla con arequipe caliente, maní tostado y galleta.',
    precio: 9900,
    categoria: 'postres',
    imagenUrl: 'img/sundae-arequipe.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Helado de vainilla', 'Arequipe', 'Maní', 'Galleta'],
    extras: [
      {
        id: 'bola',
        nombre: 'Bola de helado extra',
        precio: 3000,
      },
    ],
    retirables: [
      {
        id: 'mani',
        nombre: 'Maní',
      },
    ],
    tiempoPreparacionMin: 4,
  },
  {
    id: 'cheesecake-maracuya',
    nombre: 'Cheesecake de Maracuyá',
    descripcion: 'Cheesecake cremoso sobre base de galleta, con salsa de maracuyá.',
    precio: 11900,
    categoria: 'postres',
    imagenUrl: 'img/cheesecake-maracuya.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Queso crema', 'Galleta', 'Maracuyá'],
    tiempoPreparacionMin: 3,
  },
  {
    id: 'torta-de-chocolate',
    nombre: 'Torta de Chocolate',
    descripcion: 'Torta húmeda de chocolate con ganache y frutos rojos.',
    precio: 10900,
    categoria: 'postres',
    imagenUrl: 'img/torta-de-chocolate.jpg',
    etiquetas: ['vegetariano'],
    ingredientes: ['Chocolate', 'Ganache', 'Frutos rojos'],
    extras: [
      {
        id: 'helado',
        nombre: 'Bola de helado',
        precio: 3000,
      },
    ],
    tiempoPreparacionMin: 3,
  },
  {
    id: 'churros',
    nombre: 'Churros con Arequipe',
    descripcion: 'Churros recién fritos con azúcar y canela, para untar en arequipe o chocolate.',
    precio: 8900,
    categoria: 'postres',
    imagenUrl: 'img/churros.jpg',
    etiquetas: ['vegetariano', 'para-compartir'],
    ingredientes: ['Churros', 'Azúcar y canela', 'Arequipe'],
    tamanos: [
      {
        id: 'x6',
        nombre: '6 churros',
        diferenciaPrecio: 0,
      },
      {
        id: 'x12',
        nombre: '12 churros',
        diferenciaPrecio: 6000,
      },
    ],
    salsas: [
      {
        id: 'arequipe',
        nombre: 'Arequipe',
        precio: 0,
      },
      {
        id: 'chocolate',
        nombre: 'Chocolate',
        precio: 0,
      },
    ],
    tiempoPreparacionMin: 8,
  },
];
