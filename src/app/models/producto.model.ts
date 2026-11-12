/** Slug de la categoría. Las categorías las define el administrador; "populares" muestra todo. */
export type CategoriaId = string;

export interface Categoria {
  id: CategoriaId;
  nombre: string;
}

export type EtiquetaProducto = 'vegetariano' | 'sin-gluten' | 'mas-vendido' | 'picante' | 'para-compartir';

export interface OpcionExtra {
  id: string;
  nombre: string;
  precio: number;
}

export interface OpcionTamano {
  id: string;
  nombre: string;
  diferenciaPrecio: number;
}

export interface IngredienteRetirable {
  id: string;
  nombre: string;
}

export interface GrupoOpciones {
  titulo: string;
  opciones: OpcionExtra[] | OpcionTamano[] | IngredienteRetirable[];
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: CategoriaId;
  imagenUrl: string;
  etiquetas: EtiquetaProducto[];
  ingredientes: string[];
  tamanos?: OpcionTamano[];
  extras?: OpcionExtra[];
  salsas?: OpcionExtra[];
  retirables?: IngredienteRetirable[];
  tiempoPreparacionMin: number;
}
