import { Global, Module } from '@nestjs/common';
import { CONFIGURACION, cargarConfiguracion } from '../config/configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from './auditoria.service';
import { EventosService } from './eventos.service';

/** Servicios transversales disponibles en toda la aplicación. */
@Global()
@Module({
  providers: [
    { provide: CONFIGURACION, useFactory: () => cargarConfiguracion() },
    PrismaService,
    AuditoriaService,
    EventosService,
  ],
  exports: [CONFIGURACION, PrismaService, AuditoriaService, EventosService],
})
export class CoreModule {}
