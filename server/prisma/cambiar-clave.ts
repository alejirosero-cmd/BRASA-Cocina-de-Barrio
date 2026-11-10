/**
 * Cambia la contraseña de un usuario desde la terminal (útil en desarrollo o si se olvida la del administrador).
 *
 *   npm run usuario:clave -- admin@brasa.local "MiNuevaClave2026"
 *
 * Cierra las sesiones abiertas de ese usuario.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* sin .env */
}

async function main() {
  const [email, clave] = process.argv.slice(2);
  if (!email || !clave) {
    console.error('Uso: npm run usuario:clave -- <correo> "<nueva contraseña>"');
    process.exit(1);
  }
  if (clave.length < 10 || clave.length > 128) {
    console.error('La contraseña debe tener entre 10 y 128 caracteres.');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!usuario) {
      console.error(`No existe un usuario con el correo ${email}`);
      process.exit(1);
    }
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: await bcrypt.hash(clave, 12), versionSesion: { increment: 1 }, activo: true },
    });
    console.log(`Contraseña actualizada para ${usuario.email} (${usuario.rol}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
