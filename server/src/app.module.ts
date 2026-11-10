import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CalificacionesModule } from './calificaciones/calificaciones.module';
import { CatalogoController } from './catalogo/catalogo.controller';
import { CatalogoService } from './catalogo/catalogo.service';
import { CoreModule } from './common/core.module';
import { MesasController } from './mesas/mesas.controller';
import { MesasService } from './mesas/mesas.service';
import { PagosModule } from './pagos/pagos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { ReportesModule } from './reportes/reportes.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';

@Module({
  imports: [
    // Límite general: 120 peticiones por minuto por IP. Las rutas sensibles tienen límites propios.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      // Solo las pruebas automáticas (NODE_ENV=test) pueden desactivarlo; nunca en desarrollo ni producción.
      skipIf: () => process.env.NODE_ENV === 'test' && process.env.BRASA_SIN_LIMITES === '1',
    }),
    CoreModule,
    AuthModule,
    PedidosModule,
    SolicitudesModule,
    PagosModule,
    CalificacionesModule,
    ReportesModule,
  ],
  controllers: [CatalogoController, MesasController],
  providers: [CatalogoService, MesasService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
