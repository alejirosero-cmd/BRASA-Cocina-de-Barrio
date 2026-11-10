import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MENSAJE_SLUG = 'Usa solo minúsculas, números y guiones (ej. brasa-original)';

export const ETIQUETAS = ['vegetariano', 'sin-gluten', 'mas-vendido'] as const;

export class OpcionTamanoDto {
  @Matches(SLUG, { message: MENSAJE_SLUG }) @MaxLength(40) id: string;
  @Transform(recortar) @IsString() @Length(1, 60) nombre: string;
  @IsInt() @Min(-1_000_000) @Max(1_000_000) diferenciaPrecio: number;
}

export class OpcionExtraDto {
  @Matches(SLUG, { message: MENSAJE_SLUG }) @MaxLength(40) id: string;
  @Transform(recortar) @IsString() @Length(1, 60) nombre: string;
  @IsInt() @Min(0) @Max(1_000_000) precio: number;
}

export class IngredienteRetirableDto {
  @Matches(SLUG, { message: MENSAJE_SLUG }) @MaxLength(40) id: string;
  @Transform(recortar) @IsString() @Length(1, 60) nombre: string;
}

export class GuardarProductoDto {
  @Matches(SLUG, { message: MENSAJE_SLUG }) @MaxLength(60) id: string;
  @Transform(recortar) @IsString() @Length(2, 80) nombre: string;
  @Transform(recortar) @IsString() @Length(0, 400) descripcion: string;
  @IsInt() @Min(0) @Max(10_000_000) precio: number;
  @Matches(SLUG, { message: MENSAJE_SLUG }) categoria: string;
  /** Ruta relativa dentro de /public o URL https. */
  @IsString() @MaxLength(300) @Matches(/^(img\/[\w./-]+|https:\/\/[\w./%-]+)$/, { message: 'Imagen no válida' })
  imagenUrl: string;
  @IsArray() @ArrayMaxSize(5) @IsIn(ETIQUETAS as unknown as string[], { each: true }) etiquetas: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true }) ingredientes: string[];
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => OpcionTamanoDto) tamanos: OpcionTamanoDto[];
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => OpcionExtraDto) extras: OpcionExtraDto[];
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => OpcionExtraDto) salsas: OpcionExtraDto[];
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => IngredienteRetirableDto) retirables: IngredienteRetirableDto[];
  @IsInt() @Min(1) @Max(240) tiempoPreparacionMin: number;
  @IsOptional() @IsBoolean() disponible?: boolean;
}

export class DisponibilidadDto {
  @IsBoolean() disponible: boolean;
}

export class GuardarCategoriaDto {
  @Matches(SLUG, { message: MENSAJE_SLUG }) @MaxLength(40) id: string;
  @Transform(recortar) @IsString() @Length(2, 40) nombre: string;
  @IsInt() @Min(0) @Max(1000) orden: number;
  @IsOptional() @IsBoolean() activa?: boolean;
}
