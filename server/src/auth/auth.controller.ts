import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Publico, UsuarioActual, UsuarioAutenticado } from './decoradores';
import {
  ActualizarPerfilDto,
  CambiarPasswordDto,
  LoginDto,
  RegistroDto,
  RestablecerPasswordDto,
  SolicitarRecuperacionDto,
} from './dto';

/** Límite estricto para rutas expuestas a fuerza bruta: 5 intentos por minuto por IP. */
const LIMITE_ESTRICTO = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Throttle(LIMITE_ESTRICTO)
  @Post('registro')
  registrar(@Body() dto: RegistroDto) {
    return this.auth.registrar(dto.email, dto.nombre, dto.password);
  }

  @Publico()
  @Throttle(LIMITE_ESTRICTO)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.iniciarSesion(dto.email, dto.password);
  }

  @Publico()
  @Throttle(LIMITE_ESTRICTO)
  @HttpCode(202)
  @Post('recuperar')
  async recuperar(@Body() dto: SolicitarRecuperacionDto) {
    await this.auth.solicitarRecuperacion(dto.email);
    return { mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  @Publico()
  @Throttle(LIMITE_ESTRICTO)
  @HttpCode(200)
  @Post('restablecer')
  async restablecer(@Body() dto: RestablecerPasswordDto) {
    await this.auth.restablecerPassword(dto.token, dto.password);
    return { mensaje: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }

  @Get('perfil')
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario.id);
  }

  @Patch('perfil')
  actualizarPerfil(@UsuarioActual() usuario: UsuarioAutenticado, @Body() dto: ActualizarPerfilDto) {
    return this.auth.actualizarPerfil(usuario.id, dto.nombre);
  }

  @Throttle(LIMITE_ESTRICTO)
  @HttpCode(200)
  @Post('cambiar-password')
  cambiarPassword(@UsuarioActual() usuario: UsuarioAutenticado, @Body() dto: CambiarPasswordDto) {
    return this.auth.cambiarPassword(usuario.id, dto.actual, dto.nueva);
  }
}
