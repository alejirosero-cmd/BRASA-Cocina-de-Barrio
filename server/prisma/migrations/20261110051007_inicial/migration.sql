-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "versionSesion" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TokenRecuperacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" DATETIME NOT NULL,
    "usadoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "imagenUrl" TEXT NOT NULL,
    "etiquetas" TEXT NOT NULL DEFAULT '[]',
    "ingredientes" TEXT NOT NULL DEFAULT '[]',
    "tamanos" TEXT NOT NULL DEFAULT '[]',
    "extras" TEXT NOT NULL DEFAULT '[]',
    "salsas" TEXT NOT NULL DEFAULT '[]',
    "retirables" TEXT NOT NULL DEFAULT '[]',
    "tiempoPreparacionMin" INTEGER NOT NULL DEFAULT 15,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Cupon" (
    "codigo" TEXT NOT NULL PRIMARY KEY,
    "porcentaje" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usosMax" INTEGER,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "venceEn" DATETIME
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "mesaId" TEXT,
    "clienteId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" INTEGER NOT NULL,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "impuestos" INTEGER NOT NULL,
    "propinaPorcentaje" INTEGER NOT NULL DEFAULT 0,
    "propina" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "cuponCodigo" TEXT,
    "notasCocina" TEXT NOT NULL DEFAULT '',
    "tiempoEstimadoMin" INTEGER NOT NULL,
    "tokenSeguimientoHash" TEXT NOT NULL,
    "datosFactura" TEXT,
    "motivoCancelacion" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Pedido_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pedido_cuponCodigo_fkey" FOREIGN KEY ("cuponCodigo") REFERENCES "Cupon" ("codigo") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "personalizacion" TEXT NOT NULL,
    CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoPedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "actorId" TEXT,
    "nota" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventoPedido_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SolicitudMesero" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mesaId" TEXT,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "atendidaPorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaEn" DATETIME,
    CONSTRAINT "SolicitudMesero_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SolicitudMesero_atendidaPorId_fkey" FOREIGN KEY ("atendidaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "transaccionProveedorId" TEXT,
    "metodo" TEXT,
    "registradoPorId" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "Pago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoPago" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pagoId" TEXT,
    "claveIdempotencia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estadoReportado" TEXT NOT NULL,
    "firmaValida" BOOLEAN NOT NULL,
    "payload" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoPago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pedidoId" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Calificacion_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroAuditoria_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacion_tokenHash_key" ON "TokenRecuperacion"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRecuperacion_usuarioId_idx" ON "TokenRecuperacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_slug_key" ON "Producto"("slug");

-- CreateIndex
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- CreateIndex
CREATE INDEX "Producto_disponible_idx" ON "Producto"("disponible");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_numero_key" ON "Mesa"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_codigo_key" ON "Mesa"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_numero_key" ON "Pedido"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_tokenSeguimientoHash_key" ON "Pedido"("tokenSeguimientoHash");

-- CreateIndex
CREATE INDEX "Pedido_estado_idx" ON "Pedido"("estado");

-- CreateIndex
CREATE INDEX "Pedido_creadoEn_idx" ON "Pedido"("creadoEn");

-- CreateIndex
CREATE INDEX "Pedido_clienteId_idx" ON "Pedido"("clienteId");

-- CreateIndex
CREATE INDEX "Pedido_mesaId_idx" ON "Pedido"("mesaId");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItem_productoId_idx" ON "PedidoItem"("productoId");

-- CreateIndex
CREATE INDEX "EventoPedido_pedidoId_idx" ON "EventoPedido"("pedidoId");

-- CreateIndex
CREATE INDEX "SolicitudMesero_estado_idx" ON "SolicitudMesero"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_referencia_key" ON "Pago"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_transaccionProveedorId_key" ON "Pago"("transaccionProveedorId");

-- CreateIndex
CREATE INDEX "Pago_pedidoId_idx" ON "Pago"("pedidoId");

-- CreateIndex
CREATE INDEX "Pago_estado_idx" ON "Pago"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "EventoPago_claveIdempotencia_key" ON "EventoPago"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "EventoPago_pagoId_idx" ON "EventoPago"("pagoId");

-- CreateIndex
CREATE UNIQUE INDEX "Calificacion_pedidoId_key" ON "Calificacion"("pedidoId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidad_entidadId_idx" ON "RegistroAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_creadoEn_idx" ON "RegistroAuditoria"("creadoEn");
