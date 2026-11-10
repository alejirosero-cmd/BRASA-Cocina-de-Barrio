import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CONFIGURACION, Configuracion } from '../config/configuracion';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CorreoService } from './correo.service';
import { AutenticacionGuard, RolesGuard } from './guards';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [CONFIGURACION],
      useFactory: (config: Configuracion) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: config.jwtExpiraEn as never, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    AuthService,
    CorreoService,
    UsuariosService,
    // Orden importa: primero se autentica, luego se verifican los roles.
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
