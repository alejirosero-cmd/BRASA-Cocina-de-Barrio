import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ROLES, Rol } from '../common/dominio';

const normalizarEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** ASVS 5.0 V6.2: mínimo 8 (usamos 10), máximo amplio (128) y sin reglas de composición. */
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export class RegistroDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Correo electrónico no válido' })
  @MaxLength(254)
  email: string;

  @Transform(recortar)
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  nombre: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`,
  })
  password: string;
}

export class LoginDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Correo electrónico no válido' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(PASSWORD_MAX)
  password: string;
}

export class SolicitarRecuperacionDto {
  @Transform(normalizarEmail)
  @IsEmail({}, { message: 'Correo electrónico no válido' })
  @MaxLength(254)
  email: string;
}

export class RestablecerPasswordDto {
  @IsString()
  @Length(20, 200)
  token: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`,
  })
  password: string;
}

export class CambiarPasswordDto {
  @IsString()
  @MaxLength(PASSWORD_MAX)
  actual: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`,
  })
  nueva: string;
}

export class ActualizarPerfilDto {
  @Transform(recortar)
  @IsString()
  @Length(2, 80)
  nombre: string;
}

export class CrearUsuarioDto extends RegistroDto {
  @IsIn(ROLES as unknown as string[], { message: 'Rol no válido' })
  rol: Rol;
}

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsIn(ROLES as unknown as string[], { message: 'Rol no válido' })
  rol?: Rol;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @Length(2, 80)
  nombre?: string;
}
