export type TipoPedido = 'mesa' | 'llevar';

export interface MesaConfig {
  tipo: TipoPedido;
  numero: number | null;
}

/** Ubicación del cliente: el código del QR identifica la mesa ante el servidor. */
export interface UbicacionCliente extends MesaConfig {
  codigo: string | null;
}
