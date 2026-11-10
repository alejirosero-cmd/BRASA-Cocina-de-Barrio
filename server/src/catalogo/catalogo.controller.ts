import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { Publico, Roles, UsuarioActual, UsuarioAutenticado } from '../auth/decoradores';
import { CatalogoService } from './catalogo.service';
import { DisponibilidadDto, GuardarCategoriaDto, GuardarProductoDto } from './dto';

@Controller('productos')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  // ---- Menú público ----
  @Publico()
  @Get()
  listar() {
    return this.catalogo.listarProductos();
  }

  @Publico()
  @Get('categorias')
  categorias() {
    return this.catalogo.listarCategorias();
  }

  // ---- Administración ----
  @Roles('ADMIN')
  @Get('admin/todos')
  listarTodos() {
    return this.catalogo.listarProductos(true);
  }

  @Roles('ADMIN')
  @Get('admin/categorias')
  categoriasTodas() {
    return this.catalogo.listarCategorias(true);
  }

  @Roles('ADMIN')
  @Post()
  crear(@Body() dto: GuardarProductoDto, @UsuarioActual() u: UsuarioAutenticado) {
    return this.catalogo.crearProducto(dto, u.id);
  }

  @Roles('ADMIN')
  @Put(':slug')
  actualizar(@Param('slug') slug: string, @Body() dto: GuardarProductoDto, @UsuarioActual() u: UsuarioAutenticado) {
    return this.catalogo.actualizarProducto(slug, dto, u.id);
  }

  /** La cocina o el mesero pueden marcar un producto como agotado. */
  @Roles('ADMIN', 'COCINA', 'MESERO')
  @Patch(':slug/disponibilidad')
  disponibilidad(@Param('slug') slug: string, @Body() dto: DisponibilidadDto, @UsuarioActual() u: UsuarioAutenticado) {
    return this.catalogo.cambiarDisponibilidad(slug, dto.disponible, u.id);
  }

  @Roles('ADMIN')
  @Post('categorias')
  crearCategoria(@Body() dto: GuardarCategoriaDto, @UsuarioActual() u: UsuarioAutenticado) {
    return this.catalogo.crearCategoria(dto, u.id);
  }

  @Roles('ADMIN')
  @Put('categorias/:slug')
  actualizarCategoria(
    @Param('slug') slug: string,
    @Body() dto: GuardarCategoriaDto,
    @UsuarioActual() u: UsuarioAutenticado,
  ) {
    return this.catalogo.actualizarCategoria(slug, dto, u.id);
  }
}
