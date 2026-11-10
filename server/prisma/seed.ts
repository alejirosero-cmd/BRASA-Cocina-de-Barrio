/**
 * Datos iniciales. Es idempotente: se puede ejecutar varias veces sin duplicar nada
 * y NO sobrescribe precios ni datos que el administrador ya haya cambiado.
 * El catálogo se toma del archivo que ya usaba el frontend, para no tener dos fuentes.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { CATEGORIAS, PRODUCTOS } from '../../src/app/core/data/productos.data';
import { generarCodigoMesa } from '../src/common/seguridad';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* sin .env */
}

const prisma = new PrismaClient();
const esProduccion = process.env.NODE_ENV === 'production';

async function crearUsuarioSiNoExiste(email: string, nombre: string, rol: string, password?: string) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return;
  const clave = password && password.length >= 10 ? password : randomBytes(12).toString('base64url');
  await prisma.usuario.create({
    data: { email, nombre, rol, passwordHash: await bcrypt.hash(clave, 12) },
  });
  // Se muestra una sola vez; no se guarda en ningún archivo.
  console.log(`  Usuario ${rol.padEnd(7)} ${email}  contraseña: ${password ? '(definida en .env)' : clave}`);
}

async function main() {
  console.log('Sembrando datos de BRASA...');

  // "populares" es un filtro del frontend (muestra todo), no una categoría real.
  const categorias = CATEGORIAS.filter((c) => c.id !== 'populares');
  for (const [orden, c] of categorias.entries()) {
    await prisma.categoria.upsert({
      where: { slug: c.id },
      update: {},
      create: { slug: c.id, nombre: c.nombre, orden },
    });
  }

  for (const p of PRODUCTOS) {
    const categoria = await prisma.categoria.findUniqueOrThrow({ where: { slug: p.categoria } });
    await prisma.producto.upsert({
      where: { slug: p.id },
      update: {},
      create: {
        slug: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        categoriaId: categoria.id,
        imagenUrl: p.imagenUrl,
        etiquetas: JSON.stringify(p.etiquetas ?? []),
        ingredientes: JSON.stringify(p.ingredientes ?? []),
        tamanos: JSON.stringify(p.tamanos ?? []),
        extras: JSON.stringify(p.extras ?? []),
        salsas: JSON.stringify(p.salsas ?? []),
        retirables: JSON.stringify(p.retirables ?? []),
        tiempoPreparacionMin: p.tiempoPreparacionMin,
      },
    });
  }
  console.log(`  ${categorias.length} categorías y ${PRODUCTOS.length} productos`);

  for (let numero = 1; numero <= 12; numero++) {
    if (!(await prisma.mesa.findUnique({ where: { numero } }))) {
      await prisma.mesa.create({ data: { numero, codigo: generarCodigoMesa() } });
    }
  }
  console.log('  12 mesas con su código QR');

  // Los mismos cupones que tenía el frontend, ahora validados en el servidor.
  for (const [codigo, porcentaje] of [['BRASA10', 10], ['BARRIO15', 15]] as const) {
    await prisma.cupon.upsert({ where: { codigo }, update: {}, create: { codigo, porcentaje } });
  }

  await crearUsuarioSiNoExiste(
    process.env.SEED_ADMIN_EMAIL || 'admin@brasa.local',
    'Administrador',
    'ADMIN',
    process.env.SEED_ADMIN_PASSWORD,
  );
  if (!esProduccion) {
    await crearUsuarioSiNoExiste('cocina@brasa.local', 'Cocina', 'COCINA', process.env.SEED_DEMO_PASSWORD);
    await crearUsuarioSiNoExiste('mesero@brasa.local', 'Mesero', 'MESERO', process.env.SEED_DEMO_PASSWORD);
  }
  console.log('Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
