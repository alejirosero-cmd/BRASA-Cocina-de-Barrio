/**
 * Pruebas de integración de la API completa contra una base SQLite propia (test/e2e.db),
 * que se recrea en cada ejecución. No toca la base de desarrollo ni servicios externos.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.BRASA_SIN_LIMITES = '1';
process.env.DATABASE_URL = 'file:../test/e2e.db';
process.env.JWT_SECRET = 'secreto-de-pruebas-e2e-'.padEnd(48, 'x');
process.env.PAGOS_PROVEEDOR = 'simulado';
process.env.IMPUESTO_PORCENTAJE = '19';

import { AppModule } from '../src/app.module';
import { CorreoService } from '../src/auth/correo.service';
import { CONFIGURACION } from '../src/config/configuracion';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

const CLAVE = 'clave-de-prueba-123';

describe('API BRASA (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const enlaces: string[] = [];
  const tokens: Record<string, string> = {};
  let codigoMesa: string;

  beforeAll(async () => {
    // Base exclusiva de las pruebas: se borra el archivo y se aplican las migraciones reales.
    for (const sufijo of ['', '-journal']) rmSync(join(__dirname, `e2e.db${sufijo}`), { force: true });
    execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' });

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CorreoService)
      .useValue({ enviarRecuperacion: async (_d: string, enlace: string) => void enlaces.push(enlace) })
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app, app.get(CONFIGURACION));
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    // Datos mínimos
    const cat = await prisma.categoria.create({ data: { slug: 'hamburguesas', nombre: 'Hamburguesas' } });
    await prisma.producto.create({
      data: {
        slug: 'brasa-original', nombre: 'Brasa Original', descripcion: 'x', precio: 20000, categoriaId: cat.id,
        imagenUrl: 'img/a.svg', tamanos: JSON.stringify([{ id: 'sencilla', nombre: 'Sencilla', diferenciaPrecio: 0 }, { id: 'doble', nombre: 'Doble', diferenciaPrecio: 6000 }]),
        extras: JSON.stringify([{ id: 'queso', nombre: 'Queso', precio: 2500 }]),
      },
    });
    await prisma.producto.create({
      data: { slug: 'agotado', nombre: 'Agotado', descripcion: 'x', precio: 1000, categoriaId: cat.id, imagenUrl: 'img/a.svg', disponible: false },
    });
    codigoMesa = (await prisma.mesa.create({ data: { numero: 4, codigo: 'MESA4ABC' } })).codigo;
    await prisma.cupon.create({ data: { codigo: 'BRASA10', porcentaje: 10, usosMax: 1 } });
    const hash = await bcrypt.hash(CLAVE, 4);
    for (const rol of ['ADMIN', 'COCINA', 'MESERO']) {
      await prisma.usuario.create({ data: { email: `${rol.toLowerCase()}@t.co`, nombre: rol, rol, passwordHash: hash } });
      const r = await http.post('/api/auth/login').send({ email: `${rol.toLowerCase()}@t.co`, password: CLAVE }).expect(200);
      tokens[rol] = r.body.token;
    }
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const auth = (rol: string) => ({ Authorization: `Bearer ${tokens[rol]}` });
  const itemBasico = { productoId: 'brasa-original', cantidad: 1 };
  async function crearPedido(extra: Record<string, unknown> = {}) {
    const r = await http.post('/api/pedidos').send({ tipo: 'mesa', codigoMesa, items: [itemBasico], ...extra }).expect(201);
    return r.body as { pedido: { id: string; resumen: { total: number }; estado: string }; tokenSeguimiento: string };
  }

  // ---------------- Autenticación ----------------
  describe('autenticación', () => {
    it('registra clientes siempre con rol CLIENTE, aunque se intente enviar otro rol', async () => {
      await http.post('/api/auth/registro').send({ email: 'hacker@t.co', nombre: 'H', password: CLAVE, rol: 'ADMIN' }).expect(400);
      const r = await http.post('/api/auth/registro').send({ email: 'Cliente@T.co', nombre: 'Cliente', password: CLAVE }).expect(201);
      expect(r.body.usuario).toMatchObject({ email: 'cliente@t.co', rol: 'CLIENTE' });
      expect(r.body.usuario.passwordHash).toBeUndefined();
      tokens.CLIENTE = r.body.token;
    });

    it('no permite registrar dos veces el mismo correo', async () => {
      await http.post('/api/auth/registro').send({ email: 'cliente@t.co', nombre: 'Otra', password: CLAVE }).expect(409);
    });

    it('exige contraseñas de al menos 10 caracteres', async () => {
      await http.post('/api/auth/registro').send({ email: 'corta@t.co', nombre: 'C', password: '123' }).expect(400);
    });

    it('responde igual si el correo no existe o si la contraseña es incorrecta', async () => {
      const a = await http.post('/api/auth/login').send({ email: 'noexiste@t.co', password: CLAVE }).expect(401);
      const b = await http.post('/api/auth/login').send({ email: 'admin@t.co', password: 'incorrecta-123' }).expect(401);
      expect(a.body.message).toBe(b.body.message);
    });

    it('guarda la contraseña con bcrypt, nunca en claro', async () => {
      const u = await prisma.usuario.findUniqueOrThrow({ where: { email: 'cliente@t.co' } });
      expect(u.passwordHash).not.toContain(CLAVE);
      expect(u.passwordHash.startsWith('$2')).toBe(true);
    });

    it('rechaza tokens manipulados', async () => {
      await http.get('/api/auth/perfil').set('Authorization', `Bearer ${tokens.ADMIN}x`).expect(401);
      await http.get('/api/auth/perfil').expect(401);
    });

    it('recupera la contraseña con un enlace de un solo uso y cierra las sesiones anteriores', async () => {
      await http.post('/api/auth/registro').send({ email: 'olvido@t.co', nombre: 'Olvido', password: CLAVE }).expect(201);
      const login = await http.post('/api/auth/login').send({ email: 'olvido@t.co', password: CLAVE }).expect(200);

      const respuestaInexistente = await http.post('/api/auth/recuperar').send({ email: 'nadie@t.co' }).expect(202);
      const respuesta = await http.post('/api/auth/recuperar').send({ email: 'olvido@t.co' }).expect(202);
      expect(respuesta.body).toEqual(respuestaInexistente.body); // no permite enumerar cuentas
      const token = new URL(enlaces.at(-1)!).searchParams.get('token')!;

      // El token no se guarda en claro.
      expect(await prisma.tokenRecuperacion.findFirst({ where: { tokenHash: token } })).toBeNull();

      await http.post('/api/auth/restablecer').send({ token, password: 'nueva-clave-segura' }).expect(200);
      await http.post('/api/auth/restablecer').send({ token, password: 'otra-clave-segura' }).expect(400);
      await http.get('/api/auth/perfil').set('Authorization', `Bearer ${login.body.token}`).expect(401);
      await http.post('/api/auth/login').send({ email: 'olvido@t.co', password: 'nueva-clave-segura' }).expect(200);
    });
  });

  // ---------------- Roles y permisos ----------------
  describe('roles y permisos (validados en el servidor)', () => {
    it.each([
      ['GET', '/api/usuarios'],
      ['GET', '/api/reportes/resumen'],
      ['GET', '/api/pagos'],
      ['POST', '/api/productos'],
      ['POST', '/api/mesas'],
    ])('%s %s: solo ADMIN', async (metodo, ruta) => {
      const llamar = (h: Record<string, string>) =>
        (metodo === 'GET' ? http.get(ruta) : http.post(ruta).send({})).set(h);
      await llamar({}).expect(401);
      await llamar(auth('CLIENTE')).expect(403);
      await llamar(auth('COCINA')).expect(403);
      await llamar(auth('MESERO')).expect(403);
    });

    it('el panel de cocina y meseros no está disponible para clientes', async () => {
      await http.get('/api/pedidos/activos').set(auth('CLIENTE')).expect(403);
      await http.get('/api/pedidos/activos').set(auth('COCINA')).expect(200);
      await http.get('/api/solicitudes').set(auth('COCINA')).expect(403);
      await http.get('/api/solicitudes').set(auth('MESERO')).expect(200);
    });

    it('cambiar el rol de un usuario invalida sus sesiones abiertas', async () => {
      const r = await http.post('/api/usuarios').set(auth('ADMIN')).send({ email: 'temp@t.co', nombre: 'Temp', password: CLAVE, rol: 'MESERO' }).expect(201);
      const sesion = await http.post('/api/auth/login').send({ email: 'temp@t.co', password: CLAVE }).expect(200);
      await http.get('/api/solicitudes').set('Authorization', `Bearer ${sesion.body.token}`).expect(200);
      await http.patch(`/api/usuarios/${r.body.id}`).set(auth('ADMIN')).send({ rol: 'CLIENTE' }).expect(200);
      await http.get('/api/solicitudes').set('Authorization', `Bearer ${sesion.body.token}`).expect(401);
    });

    it('un administrador no puede quitarse su propio rol', async () => {
      const yo = await http.get('/api/auth/perfil').set(auth('ADMIN')).expect(200);
      await http.patch(`/api/usuarios/${yo.body.id}`).set(auth('ADMIN')).send({ rol: 'CLIENTE' }).expect(400);
    });
  });

  // ---------------- Pedidos ----------------
  describe('pedidos', () => {
    it('calcula el precio en el servidor y rechaza precios enviados por el cliente', async () => {
      await http.post('/api/pedidos').send({ tipo: 'mesa', codigoMesa, items: [{ ...itemBasico, precioUnitario: 1 }] }).expect(400);
      const { pedido } = await crearPedido({ items: [{ productoId: 'brasa-original', cantidad: 2, tamanoId: 'doble', extras: ['queso'] }], propinaPorcentaje: 10 });
      const subtotal = (20000 + 6000 + 2500) * 2;
      expect(pedido.resumen).toEqual({ subtotal, descuento: 0, impuestos: Math.round(subtotal * 0.19), propina: subtotal * 0.1, total: subtotal + Math.round(subtotal * 0.19) + subtotal * 0.1 });
      expect(pedido.estado).toBe('PENDIENTE');
    });

    it('exige un código de mesa válido (no un número escrito a mano)', async () => {
      await http.post('/api/pedidos').send({ tipo: 'mesa', items: [itemBasico] }).expect(400);
      await http.post('/api/pedidos').send({ tipo: 'mesa', codigoMesa: 'NOEXISTE1', items: [itemBasico] }).expect(400);
      await http.post('/api/pedidos').send({ tipo: 'llevar', items: [itemBasico] }).expect(201);
    });

    it('rechaza productos agotados, inexistentes y pedidos vacíos', async () => {
      await http.post('/api/pedidos').send({ tipo: 'llevar', items: [{ productoId: 'agotado', cantidad: 1 }] }).expect(400);
      await http.post('/api/pedidos').send({ tipo: 'llevar', items: [{ productoId: 'fantasma', cantidad: 1 }] }).expect(400);
      await http.post('/api/pedidos').send({ tipo: 'llevar', items: [] }).expect(400);
    });

    it('cotiza con las mismas reglas del servidor sin consumir el cupón', async () => {
      const r = await http.post('/api/pedidos/cotizar').send({ items: [itemBasico], cupon: 'BRASA10', propinaPorcentaje: 10 }).expect(200);
      expect(r.body).toMatchObject({ subtotal: 20000, descuento: 2000, impuestos: 3420, propina: 1800, total: 23220, cupon: 'BRASA10' });
      expect((await prisma.cupon.findUniqueOrThrow({ where: { codigo: 'BRASA10' } })).usos).toBe(0);
      await http.post('/api/pedidos/cotizar').send({ items: [itemBasico], cupon: 'NOEXISTE' }).expect(400);
    });

    it('aplica cupones del servidor y respeta su límite de usos', async () => {
      const { pedido } = await crearPedido({ cupon: 'brasa10' });
      expect(pedido.resumen.total).toBe(18000 + Math.round(18000 * 0.19));
      await http.post('/api/pedidos').send({ tipo: 'llevar', items: [itemBasico], cupon: 'BRASA10' }).expect(400);
      await http.post('/api/pedidos').send({ tipo: 'llevar', items: [itemBasico], cupon: 'INVENTADO' }).expect(400);
    });

    it('solo el dueño del token (o el personal) puede ver el pedido', async () => {
      const { pedido, tokenSeguimiento } = await crearPedido();
      await http.get(`/api/pedidos/${pedido.id}`).expect(404);
      await http.get(`/api/pedidos/${pedido.id}`).set('X-Pedido-Token', 'token-falso').expect(404);
      await http.get(`/api/pedidos/${pedido.id}`).set(auth('CLIENTE')).expect(404);
      await http.get(`/api/pedidos/${pedido.id}`).set('X-Pedido-Token', tokenSeguimiento).expect(200);
      await http.get(`/api/pedidos/${pedido.id}`).set(auth('MESERO')).expect(200);
    });

    it('recorre el flujo completo respetando qué rol hace cada paso', async () => {
      const { pedido } = await crearPedido();
      const paso = (rol: string, estado: string) => http.patch(`/api/pedidos/${pedido.id}/estado`).set(auth(rol)).send({ estado });

      await paso('COCINA', 'LISTO').expect(403); // no se salta pasos
      await paso('MESERO', 'CONFIRMADO').expect(200);
      await paso('MESERO', 'EN_PREPARACION').expect(403); // la preparación es de cocina
      await paso('COCINA', 'EN_PREPARACION').expect(200);
      await paso('COCINA', 'LISTO').expect(200);
      await paso('COCINA', 'ENTREGADO').expect(403); // entregar es del mesero
      const fin = await paso('MESERO', 'ENTREGADO').expect(200);
      expect(fin.body.estado).toBe('ENTREGADO');
      await paso('ADMIN', 'CANCELADO').expect(403);

      // Entregado sin pagar: sigue visible para el mesero en "por cobrar".
      const activos = await http.get('/api/pedidos/activos').set(auth('MESERO')).expect(200);
      expect(activos.body.map((p: { id: string }) => p.id)).toContain(pedido.id);

      const eventos = await prisma.eventoPedido.findMany({ where: { pedidoId: pedido.id }, orderBy: { creadoEn: 'asc' } });
      expect(eventos.map((e) => e.estado)).toEqual(['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']);
    });

    it('el cliente puede cancelar solo mientras el pedido está pendiente', async () => {
      const a = await crearPedido();
      await http.post(`/api/pedidos/${a.pedido.id}/cancelar`).set('X-Pedido-Token', a.tokenSeguimiento).expect(201);
      const b = await crearPedido();
      await http.patch(`/api/pedidos/${b.pedido.id}/estado`).set(auth('MESERO')).send({ estado: 'CONFIRMADO' }).expect(200);
      await http.post(`/api/pedidos/${b.pedido.id}/cancelar`).set('X-Pedido-Token', b.tokenSeguimiento).expect(409);
    });

    it('asocia el pedido al cliente con sesión y lo muestra en su historial', async () => {
      const r = await http.post('/api/pedidos').set(auth('CLIENTE')).send({ tipo: 'llevar', items: [itemBasico] }).expect(201);
      const mios = await http.get('/api/pedidos/mios').set(auth('CLIENTE')).expect(200);
      expect(mios.body.map((p: { id: string }) => p.id)).toContain(r.body.pedido.id);
    });
  });

  // ---------------- Meseros ----------------
  describe('solicitudes de mesero', () => {
    it('crea una solicitud por mesa y no la duplica mientras está pendiente', async () => {
      const a = await http.post('/api/solicitudes').send({ motivo: 'cuenta', codigoMesa }).expect(201);
      const b = await http.post('/api/solicitudes').send({ motivo: 'cuenta', codigoMesa }).expect(201);
      expect(b.body.id).toBe(a.body.id);
      expect(b.body.repetida).toBe(true);
      await http.patch(`/api/solicitudes/${a.body.id}/atender`).set(auth('MESERO')).expect(200);
      await http.patch(`/api/solicitudes/${a.body.id}/atender`).set(auth('MESERO')).expect(409);
    });

    it('rechaza solicitudes sin mesa ni pedido', async () => {
      await http.post('/api/solicitudes').send({ motivo: 'ayuda' }).expect(400);
    });
  });

  // ---------------- Pagos ----------------
  describe('pagos (proveedor simulado)', () => {
    it('procesa pagos divididos, es idempotente y no permite pagar de más', async () => {
      const { pedido, tokenSeguimiento } = await crearPedido();
      const total = pedido.resumen.total;
      const conToken = { 'X-Pedido-Token': tokenSeguimiento };

      await http.post('/api/pagos').send({ pedidoId: pedido.id }).expect(404); // sin token
      await http.post('/api/pagos').set(conToken).send({ pedidoId: pedido.id, monto: total + 1 }).expect(400);

      const parte1 = await http.post('/api/pagos').set(conToken).send({ pedidoId: pedido.id, monto: 10000 }).expect(201);
      // Doble clic: se reutiliza el mismo pago pendiente, no se crea otro cobro.
      const repetido = await http.post('/api/pagos').set(conToken).send({ pedidoId: pedido.id, monto: 10000 }).expect(201);
      expect(repetido.body.pago.referencia).toBe(parte1.body.pago.referencia);

      const ref1 = parte1.body.pago.referencia;
      const r1 = await http.post(`/api/pagos/simulado/${ref1}`).send({ aprobar: true }).expect(200);
      expect(r1.body.resultado).toBe('aplicado');
      const r1b = await http.post(`/api/pagos/simulado/${ref1}`).send({ aprobar: true }).expect(200);
      expect(r1b.body.resultado).toBe('duplicado'); // la misma notificación no se aplica dos veces

      let estado = await http.get(`/api/pedidos/${pedido.id}`).set(conToken).expect(200);
      expect(estado.body).toMatchObject({ estadoPago: 'PARCIAL', pagado: 10000, saldo: total - 10000 });

      const parte2 = await http.post('/api/pagos').set(conToken).send({ pedidoId: pedido.id }).expect(201);
      expect(parte2.body.pago.monto).toBe(total - 10000);
      await http.post(`/api/pagos/simulado/${parte2.body.pago.referencia}`).send({ aprobar: true }).expect(200);

      estado = await http.get(`/api/pedidos/${pedido.id}`).set(conToken).expect(200);
      expect(estado.body).toMatchObject({ estadoPago: 'PAGADO', saldo: 0 });
      await http.post('/api/pagos').set(conToken).send({ pedidoId: pedido.id }).expect(409);
    });

    it('un pago rechazado no cambia el estado del pedido ni puede aprobarse después', async () => {
      const { pedido, tokenSeguimiento } = await crearPedido();
      const p = await http.post('/api/pagos').set('X-Pedido-Token', tokenSeguimiento).send({ pedidoId: pedido.id }).expect(201);
      await http.post(`/api/pagos/simulado/${p.body.pago.referencia}`).send({ aprobar: false }).expect(200);
      const tarde = await http.post(`/api/pagos/simulado/${p.body.pago.referencia}`).send({ aprobar: true }).expect(200);
      expect(tarde.body.resultado).toBe('ignorado');
      const e = await http.get(`/api/pedidos/${pedido.id}`).set('X-Pedido-Token', tokenSeguimiento).expect(200);
      expect(e.body.estadoPago).toBe('PENDIENTE');
    });

    it('el webhook de Wompi no existe con el proveedor simulado', async () => {
      await http.post('/api/pagos/webhook/wompi').send({}).expect(404);
    });

    it('el mesero registra pagos en efectivo; el cliente no puede', async () => {
      const { pedido } = await crearPedido();
      await http.post('/api/pagos/efectivo').set(auth('CLIENTE')).send({ pedidoId: pedido.id }).expect(403);
      await http.post('/api/pagos/efectivo').set(auth('MESERO')).send({ pedidoId: pedido.id }).expect(201);
      const e = await http.get(`/api/pedidos/${pedido.id}`).set(auth('MESERO')).expect(200);
      expect(e.body.estadoPago).toBe('PAGADO');
    });

    it('cancelar un pedido pagado lo deja pendiente de reembolso (solo admin)', async () => {
      const { pedido } = await crearPedido();
      await http.post('/api/pagos/efectivo').set(auth('MESERO')).send({ pedidoId: pedido.id }).expect(201);
      await http.patch(`/api/pedidos/${pedido.id}/estado`).set(auth('MESERO')).send({ estado: 'CANCELADO' }).expect(409);
      await http.patch(`/api/pedidos/${pedido.id}/estado`).set(auth('ADMIN')).send({ estado: 'CANCELADO' }).expect(200);
      const pagos = await prisma.pago.findMany({ where: { pedidoId: pedido.id } });
      expect(pagos.every((p) => p.estado === 'REEMBOLSO_SOLICITADO')).toBe(true);
      await http.patch(`/api/pagos/${pagos[0].id}/reembolsado`).set(auth('ADMIN')).expect(200);
    });
  });

  // ---------------- Calificaciones ----------------
  describe('calificaciones', () => {
    it('solo se califican pedidos entregados, una sola vez y de 1 a 5 estrellas', async () => {
      const { pedido, tokenSeguimiento } = await crearPedido();
      const calificar = (estrellas: number) =>
        http.post('/api/calificaciones').set('X-Pedido-Token', tokenSeguimiento).send({ pedidoId: pedido.id, estrellas, comentario: '  Muy rico  ' });

      await calificar(5).expect(409); // aún no entregado
      for (const [rol, estado] of [['MESERO', 'CONFIRMADO'], ['COCINA', 'EN_PREPARACION'], ['COCINA', 'LISTO'], ['MESERO', 'ENTREGADO']]) {
        await http.patch(`/api/pedidos/${pedido.id}/estado`).set(auth(rol)).send({ estado }).expect(200);
      }
      await calificar(0).expect(400);
      await calificar(6).expect(400);
      const ok = await calificar(4).expect(201);
      expect(ok.body.comentario).toBe('Muy rico');
      await calificar(5).expect(409); // duplicada

      await http.post('/api/calificaciones').send({ pedidoId: pedido.id, estrellas: 5 }).expect(404); // sin token
      const resumen = await http.get('/api/calificaciones/resumen').expect(200);
      expect(resumen.body).toMatchObject({ total: 1, promedio: 4 });
    });
  });

  // ---------------- Administración ----------------
  describe('administración', () => {
    it('gestiona productos y valida los datos', async () => {
      const producto = {
        id: 'nueva-burger', nombre: 'Nueva', descripcion: 'd', precio: 15000, categoria: 'hamburguesas', imagenUrl: 'img/x.svg',
        etiquetas: [], ingredientes: [], tamanos: [], extras: [], salsas: [], retirables: [], tiempoPreparacionMin: 10,
      };
      await http.post('/api/productos').set(auth('ADMIN')).send({ ...producto, precio: -5 }).expect(400);
      await http.post('/api/productos').set(auth('ADMIN')).send({ ...producto, imagenUrl: 'javascript:alert(1)' }).expect(400);
      await http.post('/api/productos').set(auth('ADMIN')).send(producto).expect(201);
      await http.patch('/api/productos/nueva-burger/disponibilidad').set(auth('COCINA')).send({ disponible: false }).expect(200);
      const menu = await http.get('/api/productos').expect(200);
      expect(menu.body.map((p: { id: string }) => p.id)).not.toContain('nueva-burger');
    });

    it('crea mesas, entrega su QR y lo invalida al regenerarlo', async () => {
      const mesa = await http.post('/api/mesas').set(auth('ADMIN')).send({ numero: 20 }).expect(201);
      await http.post('/api/mesas').set(auth('ADMIN')).send({ numero: 20 }).expect(409);
      const qr = await http
        .get(`/api/mesas/${mesa.body.id}/qr.svg`)
        .set(auth('ADMIN'))
        .buffer(true)
        .parse((res, cb) => {
          let datos = '';
          res.on('data', (c: Buffer) => (datos += c.toString()));
          res.on('end', () => cb(null, datos));
        })
        .expect(200)
        .expect('Content-Type', /image\/svg\+xml/);
      expect(qr.body).toContain('<svg');
      await http.get(`/api/mesas/codigo/${mesa.body.codigo}`).expect(200);
      await http.post(`/api/mesas/${mesa.body.id}/regenerar-codigo`).set(auth('ADMIN')).expect(201);
      await http.get(`/api/mesas/codigo/${mesa.body.codigo}`).expect(404);
    });

    it('genera reportes con ventas cobradas y productos más vendidos', async () => {
      const r = await http.get('/api/reportes/resumen').set(auth('ADMIN')).expect(200);
      expect(r.body.ventasTotales).toBeGreaterThan(0);
      expect(r.body.masVendidos[0].nombre).toBe('Brasa Original');
    });

    it('deja rastro de auditoría de las acciones sensibles', async () => {
      const acciones = (await prisma.registroAuditoria.findMany()).map((a) => a.accion);
      expect(acciones).toEqual(expect.arrayContaining(['sesion.inicio', 'sesion.fallida', 'pedido.estado', 'pago.estado', 'usuario.creado']));
    });
  });

  // ---------------- Seguridad general ----------------
  describe('seguridad general', () => {
    it('envía cabeceras de seguridad (helmet) y restringe CORS al frontend', async () => {
      const r = await http.get('/api/productos').set('Origin', 'http://localhost:4200').expect(200);
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      const otro = await http.get('/api/productos').set('Origin', 'https://sitio-malicioso.com');
      expect(otro.headers['access-control-allow-origin']).not.toBe('https://sitio-malicioso.com');
    });

    it('limita los intentos de inicio de sesión por IP', async () => {
      process.env.BRASA_SIN_LIMITES = '0';
      const codigos: number[] = [];
      for (let i = 0; i < 7; i++) {
        codigos.push((await http.post('/api/auth/login').send({ email: 'x@t.co', password: 'incorrecta-1' })).status);
      }
      process.env.BRASA_SIN_LIMITES = '1';
      expect(codigos).toContain(429);
    });
  });
});
