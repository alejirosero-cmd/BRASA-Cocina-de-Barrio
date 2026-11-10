import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Configuracion } from './config/configuracion';

/** Configuración común a la aplicación real y a las pruebas e2e. */
export function configurarApp(app: INestApplication, config: Configuracion): void {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: config.frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pedido-Token'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos no declarados
      forbidNonWhitelisted: true, // y rechaza la petición si llegan
      transform: true,
      // En producción no se devuelven detalles internos de validación de objetos anidados.
      disableErrorMessages: false,
    }),
  );
}
