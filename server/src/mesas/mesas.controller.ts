import { Body, Controller, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { Publico, Roles, UsuarioActual, UsuarioAutenticado } from '../auth/decoradores';
import { MesasService } from './mesas.service';

class CrearMesaDto {
  @IsInt() @Min(1) @Max(999) numero: number;
}

class ActualizarMesaDto {
  @IsBoolean() activa: boolean;
}

@Controller('mesas')
export class MesasController {
  constructor(private readonly mesas: MesasService) {}

  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('codigo/:codigo')
  resolver(@Param('codigo') codigo: string) {
    return this.mesas.resolverCodigo(codigo);
  }

  @Roles('ADMIN', 'MESERO')
  @Get()
  listar() {
    return this.mesas.listar();
  }

  @Roles('ADMIN')
  @Post()
  crear(@Body() dto: CrearMesaDto, @UsuarioActual() u: UsuarioAutenticado) {
    return this.mesas.crear(dto.numero, u.id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarMesaDto, @UsuarioActual() u: UsuarioAutenticado) {
    return this.mesas.actualizar(id, dto.activa, u.id);
  }

  @Roles('ADMIN')
  @Post(':id/regenerar-codigo')
  regenerar(@Param('id') id: string, @UsuarioActual() u: UsuarioAutenticado) {
    return this.mesas.regenerarCodigo(id, u.id);
  }

  @Roles('ADMIN')
  @Get(':id/qr.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'no-store')
  qr(@Param('id') id: string) {
    return this.mesas.qrSvg(id);
  }
}
