import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles, UsuarioActual, UsuarioAutenticado } from './decoradores';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@Roles('ADMIN')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto, @UsuarioActual() actor: UsuarioAutenticado) {
    return this.usuarios.crear(dto, actor.id);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.usuarios.actualizar(id, dto, actor.id);
  }
}
