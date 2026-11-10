import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
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
import { ESTADOS_PEDIDO, EstadoPedido, TIPOS_PEDIDO, TipoPedido } from '../common/dominio';
import { CANTIDAD_MAX_POR_ITEM, ITEMS_MAX_POR_PEDIDO } from './precios';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ID = /^[a-z0-9-]{1,60}$/;

export class ItemPedidoDto {
  @Matches(ID) productoId: string;
  @IsInt() @Min(1) @Max(CANTIDAD_MAX_POR_ITEM) cantidad: number;
  @IsOptional() @Matches(ID) tamanoId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @Matches(ID, { each: true }) extras?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @Matches(ID, { each: true }) salsas?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) retirados?: string[];
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(200) instrucciones?: string;
}

export class CrearPedidoDto {
  @IsIn(TIPOS_PEDIDO as unknown as string[]) tipo: TipoPedido;
  /** Código del QR de la mesa. Obligatorio si tipo = mesa. */
  @IsOptional() @Transform(recortar) @Matches(/^[A-Za-z0-9]{6,12}$/, { message: 'Código de mesa no válido' })
  codigoMesa?: string;
  @IsArray() @ArrayMinSize(1, { message: 'El pedido está vacío' }) @ArrayMaxSize(ITEMS_MAX_POR_PEDIDO)
  @ValidateNested({ each: true }) @Type(() => ItemPedidoDto)
  items: ItemPedidoDto[];
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(300) notasCocina?: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(30) cupon?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) propinaPorcentaje?: number;
}

export class CambiarEstadoDto {
  @IsIn(ESTADOS_PEDIDO as unknown as string[]) estado: EstadoPedido;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(200) nota?: string;
}

export class PropinaDto {
  @IsInt() @Min(0) @Max(100) porcentaje: number;
}

export class DatosFacturaDto {
  @IsIn(['CC', 'CE', 'NIT', 'PP', 'TI']) tipoDocumento: string;
  @Transform(recortar) @Matches(/^[0-9A-Za-z-]{5,20}$/, { message: 'Número de documento no válido' }) numeroDocumento: string;
  @Transform(recortar) @IsString() @Length(2, 120) nombre: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Correo electrónico no válido' }) @MaxLength(254) correo: string;
  /** Autorización de tratamiento de datos personales (Ley 1581 de 2012). */
  @IsBoolean() aceptaTratamientoDatos: boolean;
}

export class CotizarPedidoDto {
  @IsArray() @ArrayMinSize(1, { message: 'El pedido está vacío' }) @ArrayMaxSize(ITEMS_MAX_POR_PEDIDO)
  @ValidateNested({ each: true }) @Type(() => ItemPedidoDto)
  items: ItemPedidoDto[];
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(30) cupon?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) propinaPorcentaje?: number;
}
