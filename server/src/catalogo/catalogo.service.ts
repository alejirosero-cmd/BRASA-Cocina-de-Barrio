import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Categoria, Producto } from '@prisma/client';
import { AuditoriaService } from '../common/auditoria.service';
import { leerJson } from '../common/seguridad';
import { PrismaService } from '../prisma/prisma.service';
import { GuardarCategoriaDto, GuardarProductoDto } from './dto';

export interface OpcionTamano { id: string; nombre: string; diferenciaPrecio: number }
export interface OpcionExtra { id: string; nombre: string; precio: number }
export interface IngredienteRetirable { id: string; nombre: string }

/** Forma pública del producto: coincide con el modelo `Producto` del frontend. */
export interface ProductoPublico {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  imagenUrl: string;
  etiquetas: string[];
  ingredientes: string[];
  tamanos: OpcionTamano[];
  extras: OpcionExtra[];
  salsas: OpcionExtra[];
  retirables: IngredienteRetirable[];
  tiempoPreparacionMin: number;
  disponible: boolean;
}

export function aProductoPublico(p: Producto & { categoria: Categoria }): ProductoPublico {
  return {
    id: p.slug,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    categoria: p.categoria.slug,
    imagenUrl: p.imagenUrl,
    etiquetas: leerJson(p.etiquetas, []),
    ingredientes: leerJson(p.ingredientes, []),
    tamanos: leerJson(p.tamanos, []),
    extras: leerJson(p.extras, []),
    salsas: leerJson(p.salsas, []),
    retirables: leerJson(p.retirables, []),
    tiempoPreparacionMin: p.tiempoPreparacionMin,
    disponible: p.disponible,
  };
}

function idsUnicos(lista: { id: string }[], grupo: string): void {
  const ids = lista.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(`Hay opciones repetidas en ${grupo}`);
  }
}

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listarCategorias(incluirInactivas = false) {
    const categorias = await this.prisma.categoria.findMany({
      where: incluirInactivas ? {} : { activa: true },
      orderBy: { orden: 'asc' },
    });
    return categorias.map((c) => ({ id: c.slug, nombre: c.nombre, orden: c.orden, activa: c.activa }));
  }

  async listarProductos(incluirNoDisponibles = false): Promise<ProductoPublico[]> {
    const productos = await this.prisma.producto.findMany({
      where: incluirNoDisponibles ? {} : { disponible: true, categoria: { activa: true } },
      include: { categoria: true },
      orderBy: [{ categoria: { orden: 'asc' } }, { nombre: 'asc' }],
    });
    return productos.map(aProductoPublico);
  }

  async crearProducto(dto: GuardarProductoDto, actorId: string): Promise<ProductoPublico> {
    if (await this.prisma.producto.findUnique({ where: { slug: dto.id } })) {
      throw new ConflictException('Ya existe un producto con ese identificador');
    }
    const producto = await this.prisma.producto.create({
      data: await this.datosProducto(dto),
      include: { categoria: true },
    });
    await this.auditoria.registrar('producto.creado', 'Producto', producto.id, actorId);
    return aProductoPublico(producto);
  }

  async actualizarProducto(slug: string, dto: GuardarProductoDto, actorId: string): Promise<ProductoPublico> {
    const actual = await this.prisma.producto.findUnique({ where: { slug } });
    if (!actual) throw new NotFoundException('Producto no encontrado');
    if (dto.id !== slug && (await this.prisma.producto.findUnique({ where: { slug: dto.id } }))) {
      throw new ConflictException('Ya existe un producto con ese identificador');
    }
    const producto = await this.prisma.producto.update({
      where: { slug },
      data: await this.datosProducto(dto),
      include: { categoria: true },
    });
    await this.auditoria.registrar('producto.actualizado', 'Producto', producto.id, actorId, {
      precioAnterior: actual.precio,
      precioNuevo: producto.precio,
    });
    return aProductoPublico(producto);
  }

  /** Los productos no se borran (los pedidos antiguos los referencian): se marcan como no disponibles. */
  async cambiarDisponibilidad(slug: string, disponible: boolean, actorId: string): Promise<ProductoPublico> {
    const producto = await this.prisma.producto
      .update({ where: { slug }, data: { disponible }, include: { categoria: true } })
      .catch(() => {
        throw new NotFoundException('Producto no encontrado');
      });
    await this.auditoria.registrar('producto.disponibilidad', 'Producto', producto.id, actorId, { disponible });
    return aProductoPublico(producto);
  }

  async crearCategoria(dto: GuardarCategoriaDto, actorId: string) {
    if (await this.prisma.categoria.findUnique({ where: { slug: dto.id } })) {
      throw new ConflictException('Ya existe una categoría con ese identificador');
    }
    const c = await this.prisma.categoria.create({
      data: { slug: dto.id, nombre: dto.nombre, orden: dto.orden, activa: dto.activa ?? true },
    });
    await this.auditoria.registrar('categoria.creada', 'Categoria', c.id, actorId);
    return { id: c.slug, nombre: c.nombre, orden: c.orden, activa: c.activa };
  }

  async actualizarCategoria(slug: string, dto: GuardarCategoriaDto, actorId: string) {
    const actual = await this.prisma.categoria.findUnique({ where: { slug } });
    if (!actual) throw new NotFoundException('Categoría no encontrada');
    if (dto.id !== slug && (await this.prisma.categoria.findUnique({ where: { slug: dto.id } }))) {
      throw new ConflictException('Ya existe una categoría con ese identificador');
    }
    const c = await this.prisma.categoria.update({
      where: { slug },
      data: { slug: dto.id, nombre: dto.nombre, orden: dto.orden, activa: dto.activa ?? actual.activa },
    });
    await this.auditoria.registrar('categoria.actualizada', 'Categoria', c.id, actorId);
    return { id: c.slug, nombre: c.nombre, orden: c.orden, activa: c.activa };
  }

  private async datosProducto(dto: GuardarProductoDto) {
    const categoria = await this.prisma.categoria.findUnique({ where: { slug: dto.categoria } });
    if (!categoria) throw new BadRequestException('La categoría no existe');
    idsUnicos(dto.tamanos, 'tamaños');
    idsUnicos(dto.extras, 'extras');
    idsUnicos(dto.salsas, 'salsas');
    idsUnicos(dto.retirables, 'ingredientes retirables');
    return {
      slug: dto.id,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      precio: dto.precio,
      categoriaId: categoria.id,
      imagenUrl: dto.imagenUrl,
      etiquetas: JSON.stringify(dto.etiquetas),
      ingredientes: JSON.stringify(dto.ingredientes),
      tamanos: JSON.stringify(dto.tamanos),
      extras: JSON.stringify(dto.extras),
      salsas: JSON.stringify(dto.salsas),
      retirables: JSON.stringify(dto.retirables),
      tiempoPreparacionMin: dto.tiempoPreparacionMin,
      disponible: dto.disponible ?? true,
    };
  }
}
