import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { CONFIGURACION, Configuracion } from './config/configuracion';
import { configurarApp } from './configurar-app';

async function arrancar() {
  // Node 20+ carga el archivo .env sin dependencias adicionales.
  try {
    process.loadEnvFile?.('.env');
  } catch {
    // Sin .env: se usan las variables del sistema.
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  const config = app.get<Configuracion>(CONFIGURACION);
  app.useBodyParser('json', { limit: '100kb' });
  app.set('trust proxy', config.esProduccion ? 1 : false);
  configurarApp(app, config);
  app.enableShutdownHooks();

  await app.listen(config.puerto);
  Logger.log(`API de BRASA en http://localhost:${config.puerto}/api (pagos: ${config.pagos.proveedor})`, 'Arranque');
}

arrancar();
