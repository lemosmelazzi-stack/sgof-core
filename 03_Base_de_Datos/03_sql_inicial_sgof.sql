-- =========================================================
-- SGOF - SQL inicial consolidado MVP
-- PostgreSQL
-- =========================================================

-- =========================================================
-- BLOQUE 1 - BASE
-- =========================================================

CREATE TABLE empresas (
    id UUID PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    razon_social VARCHAR(150),
    rut VARCHAR(20) UNIQUE,
    email VARCHAR(100),
    telefono VARCHAR(30),
    direccion VARCHAR(150),
    ciudad VARCHAR(100),
    pais VARCHAR(100) DEFAULT 'Uruguay',
    estado VARCHAR(20) DEFAULT 'activa',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP
);

CREATE INDEX idx_empresas_nombre ON empresas(nombre);
CREATE INDEX idx_empresas_estado ON empresas(estado);

CREATE TABLE configuracion_empresa (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL UNIQUE,

    nombre_comercial VARCHAR(120),
    moneda VARCHAR(10) NOT NULL DEFAULT 'UYU',
    zona_horaria VARCHAR(50) NOT NULL DEFAULT 'America/Montevideo',
    idioma VARCHAR(10) NOT NULL DEFAULT 'es',

    permitir_reservas BOOLEAN NOT NULL DEFAULT TRUE,
    max_dias_reserva INTEGER NOT NULL DEFAULT 7,

    usa_control_turnos BOOLEAN NOT NULL DEFAULT TRUE,
    usa_credito_empresarial BOOLEAN NOT NULL DEFAULT TRUE,
    usa_modulo_mantenimiento BOOLEAN NOT NULL DEFAULT TRUE,
    usa_modulo_liquidaciones BOOLEAN NOT NULL DEFAULT FALSE,

    tiempo_espera_minutos INTEGER NOT NULL DEFAULT 10,
    tiempo_cancelacion_minutos INTEGER NOT NULL DEFAULT 5,
    distancia_minima_viaje_km NUMERIC(8,2) NOT NULL DEFAULT 0,

    observaciones TEXT,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_config_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY,
    empresa_id UUID,

    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    documento VARCHAR(30),
    email VARCHAR(120),
    telefono VARCHAR(30),

    username VARCHAR(50) NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(30) NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMP,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_usuario_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT uq_usuario_username UNIQUE (empresa_id, username),
    CONSTRAINT uq_usuario_email UNIQUE (empresa_id, email),

    CONSTRAINT chk_usuario_rol
        CHECK (rol IN (
            'superadmin',
            'manager',
            'supervisor',
            'operadora',
            'visor'
        )),

    CONSTRAINT chk_empresa_superadmin
        CHECK (
            (rol = 'superadmin' AND empresa_id IS NULL)
            OR
            (rol <> 'superadmin' AND empresa_id IS NOT NULL)
        )
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- =========================================================
-- BLOQUE 2 - PERSONAL Y RECURSOS
-- =========================================================

CREATE TABLE operadoras (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    usuario_id UUID,

    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    documento VARCHAR(30),
    telefono VARCHAR(30),
    email VARCHAR(120),
    direccion VARCHAR(150),
    fecha_ingreso DATE,

    activo BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_operadora_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_operadora_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),

    CONSTRAINT uq_operadora_codigo UNIQUE (empresa_id, codigo),
    CONSTRAINT uq_operadora_usuario UNIQUE (usuario_id)
);

CREATE INDEX idx_operadoras_empresa ON operadoras(empresa_id);
CREATE INDEX idx_operadoras_usuario ON operadoras(usuario_id);
CREATE INDEX idx_operadoras_activo ON operadoras(activo);
CREATE INDEX idx_operadoras_nombre_apellido ON operadoras(nombre, apellido);

CREATE TABLE choferes (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,

    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    documento VARCHAR(30),
    telefono VARCHAR(30),
    email VARCHAR(120),
    direccion VARCHAR(150),
    fecha_nacimiento DATE,
    fecha_ingreso DATE,

    numero_licencia VARCHAR(50),
    vencimiento_licencia DATE,

    contacto_emergencia_nombre VARCHAR(120),
    contacto_emergencia_telefono VARCHAR(30),
    foto_url TEXT,

    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_chofer_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT uq_chofer_codigo UNIQUE (empresa_id, codigo),

    CONSTRAINT chk_chofer_estado
        CHECK (estado IN (
            'disponible',
            'ocupado',
            'pausado',
            'inactivo',
            'suspendido'
        ))
);

CREATE INDEX idx_choferes_empresa ON choferes(empresa_id);
CREATE INDEX idx_choferes_activo ON choferes(activo);
CREATE INDEX idx_choferes_estado ON choferes(estado);
CREATE INDEX idx_choferes_nombre_apellido ON choferes(nombre, apellido);
CREATE INDEX idx_choferes_documento ON choferes(documento);

CREATE TABLE taxis (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,

    codigo_movil VARCHAR(20) NOT NULL,
    numero_interno VARCHAR(20),
    matricula VARCHAR(20) NOT NULL,

    marca VARCHAR(50),
    modelo VARCHAR(50),
    anio INTEGER,
    color VARCHAR(30),

    capacidad_pasajeros INTEGER NOT NULL DEFAULT 4,

    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_alta DATE,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_taxi_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT uq_taxi_codigo_movil UNIQUE (empresa_id, codigo_movil),
    CONSTRAINT uq_taxi_matricula UNIQUE (empresa_id, matricula),

    CONSTRAINT chk_taxi_estado
        CHECK (estado IN (
            'disponible',
            'ocupado',
            'mantenimiento',
            'fuera_servicio',
            'inactivo'
        )),

    CONSTRAINT chk_taxi_capacidad
        CHECK (capacidad_pasajeros > 0),

    CONSTRAINT chk_taxi_anio
        CHECK (anio IS NULL OR anio >= 1900)
);

CREATE INDEX idx_taxis_empresa ON taxis(empresa_id);
CREATE INDEX idx_taxis_estado ON taxis(estado);
CREATE INDEX idx_taxis_activo ON taxis(activo);
CREATE INDEX idx_taxis_codigo_movil ON taxis(codigo_movil);

CREATE TABLE tablets (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    taxi_id UUID,

    codigo VARCHAR(20) NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    numero_serie VARCHAR(100),
    imei VARCHAR(30),
    numero_chip VARCHAR(30),
    linea_telefonica VARCHAR(30),

    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_alta DATE,
    ultima_conexion TIMESTAMP,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_tablet_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_tablet_taxi
        FOREIGN KEY (taxi_id) REFERENCES taxis(id),

    CONSTRAINT uq_tablet_codigo UNIQUE (empresa_id, codigo),
    CONSTRAINT uq_tablet_imei UNIQUE (imei),

    CONSTRAINT chk_tablet_estado
        CHECK (estado IN (
            'disponible',
            'asignada',
            'mantenimiento',
            'rota',
            'extraviada',
            'inactiva'
        ))
);

CREATE INDEX idx_tablets_empresa ON tablets(empresa_id);
CREATE INDEX idx_tablets_taxi ON tablets(taxi_id);
CREATE INDEX idx_tablets_estado ON tablets(estado);
CREATE INDEX idx_tablets_activo ON tablets(activo);
CREATE INDEX idx_tablets_ultima_conexion ON tablets(ultima_conexion);

CREATE TABLE turnos (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,

    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    cruza_medianoche BOOLEAN NOT NULL DEFAULT FALSE,

    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INTEGER,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_turno_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT uq_turno_codigo UNIQUE (empresa_id, codigo),
    CONSTRAINT uq_turno_nombre UNIQUE (empresa_id, nombre),

    CONSTRAINT chk_turno_orden
        CHECK (orden IS NULL OR orden > 0)
);

CREATE INDEX idx_turnos_empresa ON turnos(empresa_id);
CREATE INDEX idx_turnos_activo ON turnos(activo);
CREATE INDEX idx_turnos_orden ON turnos(orden);

-- =========================================================
-- BLOQUE 3 - CLIENTES Y OPERACION
-- =========================================================

CREATE TABLE clientes (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,

    codigo VARCHAR(20),
    nombre VARCHAR(120) NOT NULL,
    telefono_principal VARCHAR(30) NOT NULL,
    telefono_secundario VARCHAR(30),
    email VARCHAR(120),
    direccion_principal VARCHAR(150),
    referencia_direccion TEXT,
    tipo_cliente VARCHAR(20) NOT NULL DEFAULT 'comun',
    documento VARCHAR(30),
    observaciones TEXT,

    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_cliente_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT uq_cliente_codigo UNIQUE (empresa_id, codigo),

    CONSTRAINT chk_cliente_tipo
        CHECK (tipo_cliente IN (
            'comun',
            'frecuente',
            'empresa',
            'vip'
        ))
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_telefono_principal ON clientes(telefono_principal);
CREATE INDEX idx_clientes_nombre ON clientes(nombre);
CREATE INDEX idx_clientes_tipo_cliente ON clientes(tipo_cliente);
CREATE INDEX idx_clientes_activo ON clientes(activo);
CREATE INDEX idx_clientes_empresa_telefono ON clientes(empresa_id, telefono_principal);
CREATE INDEX idx_clientes_empresa_nombre ON clientes(empresa_id, nombre);

CREATE TABLE pedidos (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    cliente_id UUID,
    operadora_id UUID,

    codigo VARCHAR(30) NOT NULL,
    canal VARCHAR(20) NOT NULL DEFAULT 'telefono',
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    es_reserva BOOLEAN NOT NULL DEFAULT FALSE,

    fecha_hora_pedido TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_hora_reserva TIMESTAMP,

    origen_direccion VARCHAR(200) NOT NULL,
    origen_referencia TEXT,
    origen_latitud NUMERIC(10,7),
    origen_longitud NUMERIC(10,7),

    destino_direccion VARCHAR(200),
    destino_referencia TEXT,
    destino_latitud NUMERIC(10,7),
    destino_longitud NUMERIC(10,7),

    cantidad_pasajeros INTEGER NOT NULL DEFAULT 1,
    observaciones TEXT,
    cancelado_motivo TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_pedido_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_pedido_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),

    CONSTRAINT fk_pedido_operadora
        FOREIGN KEY (operadora_id) REFERENCES operadoras(id),

    CONSTRAINT uq_pedido_codigo UNIQUE (empresa_id, codigo),

    CONSTRAINT chk_pedido_canal
        CHECK (canal IN (
            'telefono',
            'whatsapp',
            'app',
            'web',
            'manual'
        )),

    CONSTRAINT chk_pedido_estado
        CHECK (estado IN (
            'pendiente',
            'asignado',
            'en_proceso',
            'finalizado',
            'cancelado',
            'sin_unidad'
        )),

    CONSTRAINT chk_pedido_cantidad_pasajeros
        CHECK (cantidad_pasajeros > 0),

    CONSTRAINT chk_pedido_reserva
        CHECK (
            (es_reserva = TRUE AND fecha_hora_reserva IS NOT NULL)
            OR
            (es_reserva = FALSE AND fecha_hora_reserva IS NULL)
        ),

    CONSTRAINT chk_pedido_origen_coord
        CHECK (
            (origen_latitud IS NULL AND origen_longitud IS NULL)
            OR
            (origen_latitud IS NOT NULL AND origen_longitud IS NOT NULL)
        ),

    CONSTRAINT chk_pedido_destino_coord
        CHECK (
            (destino_latitud IS NULL AND destino_longitud IS NULL)
            OR
            (destino_latitud IS NOT NULL AND destino_longitud IS NOT NULL)
        ),

    CONSTRAINT chk_pedido_origen_lat
        CHECK (origen_latitud IS NULL OR origen_latitud BETWEEN -90 AND 90),

    CONSTRAINT chk_pedido_origen_lon
        CHECK (origen_longitud IS NULL OR origen_longitud BETWEEN -180 AND 180),

    CONSTRAINT chk_pedido_destino_lat
        CHECK (destino_latitud IS NULL OR destino_latitud BETWEEN -90 AND 90),

    CONSTRAINT chk_pedido_destino_lon
        CHECK (destino_longitud IS NULL OR destino_longitud BETWEEN -180 AND 180)
);

CREATE INDEX idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_operadora ON pedidos(operadora_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_es_reserva ON pedidos(es_reserva);
CREATE INDEX idx_pedidos_fecha_hora_pedido ON pedidos(fecha_hora_pedido);
CREATE INDEX idx_pedidos_fecha_hora_reserva ON pedidos(fecha_hora_reserva);
CREATE INDEX idx_pedidos_empresa_reserva_fecha ON pedidos(empresa_id, es_reserva, fecha_hora_reserva);

CREATE TABLE asignaciones (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    pedido_id UUID NOT NULL,
    chofer_id UUID,
    taxi_id UUID,
    operadora_id UUID,

    orden_intento INTEGER NOT NULL DEFAULT 1,
    estado VARCHAR(20) NOT NULL DEFAULT 'asignada',
    es_asignacion_principal BOOLEAN NOT NULL DEFAULT FALSE,

    fecha_hora_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_hora_respuesta TIMESTAMP,

    motivo_rechazo TEXT,
    motivo_cancelacion TEXT,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_asignacion_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_asignacion_pedido
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id),

    CONSTRAINT fk_asignacion_chofer
        FOREIGN KEY (chofer_id) REFERENCES choferes(id),

    CONSTRAINT fk_asignacion_taxi
        FOREIGN KEY (taxi_id) REFERENCES taxis(id),

    CONSTRAINT fk_asignacion_operadora
        FOREIGN KEY (operadora_id) REFERENCES operadoras(id),

    CONSTRAINT uq_asignacion_intento UNIQUE (pedido_id, orden_intento),

    CONSTRAINT chk_asignacion_estado
        CHECK (estado IN (
            'asignada',
            'aceptada',
            'rechazada',
            'cancelada',
            'expirada',
            'finalizada'
        )),

    CONSTRAINT chk_asignacion_orden_intento
        CHECK (orden_intento > 0)
);

CREATE UNIQUE INDEX uq_asignacion_principal_por_pedido
ON asignaciones(pedido_id)
WHERE es_asignacion_principal = TRUE;

CREATE INDEX idx_asignaciones_empresa ON asignaciones(empresa_id);
CREATE INDEX idx_asignaciones_pedido ON asignaciones(pedido_id);
CREATE INDEX idx_asignaciones_chofer ON asignaciones(chofer_id);
CREATE INDEX idx_asignaciones_taxi ON asignaciones(taxi_id);
CREATE INDEX idx_asignaciones_operadora ON asignaciones(operadora_id);
CREATE INDEX idx_asignaciones_estado ON asignaciones(estado);
CREATE INDEX idx_asignaciones_fecha_hora_asignacion ON asignaciones(fecha_hora_asignacion);
CREATE INDEX idx_asignaciones_pedido_intento ON asignaciones(pedido_id, orden_intento);
CREATE INDEX idx_asignaciones_pedido_principal ON asignaciones(pedido_id, es_asignacion_principal);

CREATE TABLE viajes (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    pedido_id UUID NOT NULL,
    asignacion_id UUID,
    cliente_id UUID,
    chofer_id UUID,
    taxi_id UUID,
    operadora_id UUID,

    codigo VARCHAR(30) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',

    fecha_hora_inicio TIMESTAMP,
    fecha_hora_llegada_origen TIMESTAMP,
    fecha_hora_inicio_real TIMESTAMP,
    fecha_hora_fin TIMESTAMP,

    origen_direccion VARCHAR(200) NOT NULL,
    origen_referencia TEXT,
    origen_latitud NUMERIC(10,7),
    origen_longitud NUMERIC(10,7),

    destino_direccion VARCHAR(200),
    destino_referencia TEXT,
    destino_latitud NUMERIC(10,7),
    destino_longitud NUMERIC(10,7),

    distancia_km NUMERIC(10,2),
    duracion_minutos INTEGER,
    importe_estimado NUMERIC(12,2),
    importe_final NUMERIC(12,2),

    observaciones TEXT,
    cancelado_motivo TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_viaje_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_viaje_pedido
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id),

    CONSTRAINT fk_viaje_asignacion
        FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id),

    CONSTRAINT fk_viaje_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),

    CONSTRAINT fk_viaje_chofer
        FOREIGN KEY (chofer_id) REFERENCES choferes(id),

    CONSTRAINT fk_viaje_taxi
        FOREIGN KEY (taxi_id) REFERENCES taxis(id),

    CONSTRAINT fk_viaje_operadora
        FOREIGN KEY (operadora_id) REFERENCES operadoras(id),

    CONSTRAINT uq_viaje_codigo UNIQUE (empresa_id, codigo),
    CONSTRAINT uq_viaje_asignacion UNIQUE (asignacion_id),

    CONSTRAINT chk_viaje_estado
        CHECK (estado IN (
            'pendiente',
            'en_camino_origen',
            'en_origen',
            'en_viaje',
            'finalizado',
            'cancelado',
            'no_show'
        )),

    CONSTRAINT chk_viaje_origen_coord
        CHECK (
            (origen_latitud IS NULL AND origen_longitud IS NULL)
            OR
            (origen_latitud IS NOT NULL AND origen_longitud IS NOT NULL)
        ),

    CONSTRAINT chk_viaje_destino_coord
        CHECK (
            (destino_latitud IS NULL AND destino_longitud IS NULL)
            OR
            (destino_latitud IS NOT NULL AND destino_longitud IS NOT NULL)
        ),

    CONSTRAINT chk_viaje_origen_lat
        CHECK (origen_latitud IS NULL OR origen_latitud BETWEEN -90 AND 90),

    CONSTRAINT chk_viaje_origen_lon
        CHECK (origen_longitud IS NULL OR origen_longitud BETWEEN -180 AND 180),

    CONSTRAINT chk_viaje_destino_lat
        CHECK (destino_latitud IS NULL OR destino_latitud BETWEEN -90 AND 90),

    CONSTRAINT chk_viaje_destino_lon
        CHECK (destino_longitud IS NULL OR destino_longitud BETWEEN -180 AND 180),

    CONSTRAINT chk_viaje_distancia
        CHECK (distancia_km IS NULL OR distancia_km >= 0),

    CONSTRAINT chk_viaje_duracion
        CHECK (duracion_minutos IS NULL OR duracion_minutos >= 0),

    CONSTRAINT chk_viaje_importe_estimado
        CHECK (importe_estimado IS NULL OR importe_estimado >= 0),

    CONSTRAINT chk_viaje_importe_final
        CHECK (importe_final IS NULL OR importe_final >= 0)
);

CREATE INDEX idx_viajes_empresa ON viajes(empresa_id);
CREATE INDEX idx_viajes_pedido ON viajes(pedido_id);
CREATE INDEX idx_viajes_asignacion ON viajes(asignacion_id);
CREATE INDEX idx_viajes_cliente ON viajes(cliente_id);
CREATE INDEX idx_viajes_chofer ON viajes(chofer_id);
CREATE INDEX idx_viajes_taxi ON viajes(taxi_id);
CREATE INDEX idx_viajes_operadora ON viajes(operadora_id);
CREATE INDEX idx_viajes_estado ON viajes(estado);
CREATE INDEX idx_viajes_fecha_hora_inicio ON viajes(fecha_hora_inicio);
CREATE INDEX idx_viajes_fecha_hora_fin ON viajes(fecha_hora_fin);
CREATE INDEX idx_viajes_empresa_estado ON viajes(empresa_id, estado);
CREATE INDEX idx_viajes_empresa_fecha_inicio ON viajes(empresa_id, fecha_hora_inicio);

CREATE TABLE pagos (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    viaje_id UUID NOT NULL,
    cliente_id UUID,

    codigo VARCHAR(30) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',

    monto NUMERIC(12,2) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'UYU',
    fecha_hora_pago TIMESTAMP,

    referencia_pago VARCHAR(100),
    numero_comprobante VARCHAR(50),
    es_parcial BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_pago_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_pago_viaje
        FOREIGN KEY (viaje_id) REFERENCES viajes(id),

    CONSTRAINT fk_pago_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),

    CONSTRAINT uq_pago_codigo UNIQUE (empresa_id, codigo),

    CONSTRAINT chk_pago_metodo
        CHECK (metodo_pago IN (
            'efectivo',
            'transferencia',
            'credito',
            'pos',
            'ajuste'
        )),

    CONSTRAINT chk_pago_estado
        CHECK (estado IN (
            'pendiente',
            'pagado',
            'anulado',
            'rechazado',
            'parcial'
        )),

    CONSTRAINT chk_pago_monto
        CHECK (monto > 0)
);

CREATE INDEX idx_pagos_empresa ON pagos(empresa_id);
CREATE INDEX idx_pagos_viaje ON pagos(viaje_id);
CREATE INDEX idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX idx_pagos_metodo ON pagos(metodo_pago);
CREATE INDEX idx_pagos_estado ON pagos(estado);
CREATE INDEX idx_pagos_fecha_hora_pago ON pagos(fecha_hora_pago);
CREATE INDEX idx_pagos_empresa_estado ON pagos(empresa_id, estado);
CREATE INDEX idx_pagos_empresa_fecha_hora_pago ON pagos(empresa_id, fecha_hora_pago);

-- =========================================================
-- BLOQUE 4 - CREDITO, AUDITORIA Y GPS
-- =========================================================

CREATE TABLE clientes_credito (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    cliente_id UUID NOT NULL,

    codigo VARCHAR(30),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'habilitado',

    limite_credito NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
    dias_plazo INTEGER NOT NULL DEFAULT 30,
    permite_sobregiro BOOLEAN NOT NULL DEFAULT FALSE,

    fecha_habilitacion DATE,
    fecha_suspension DATE,
    motivo_suspension TEXT,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_cliente_credito_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_cliente_credito_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),

    CONSTRAINT uq_cliente_credito_cliente UNIQUE (cliente_id),
    CONSTRAINT uq_cliente_credito_codigo UNIQUE (empresa_id, codigo),

    CONSTRAINT chk_cliente_credito_estado
        CHECK (estado IN (
            'habilitado',
            'suspendido',
            'bloqueado',
            'cerrado'
        )),

    CONSTRAINT chk_cliente_credito_limite
        CHECK (limite_credito >= 0),

    CONSTRAINT chk_cliente_credito_saldo
        CHECK (saldo_actual >= 0),

    CONSTRAINT chk_cliente_credito_dias_plazo
        CHECK (dias_plazo > 0)
);

CREATE INDEX idx_clientes_credito_empresa ON clientes_credito(empresa_id);
CREATE INDEX idx_clientes_credito_cliente ON clientes_credito(cliente_id);
CREATE INDEX idx_clientes_credito_estado ON clientes_credito(estado);
CREATE INDEX idx_clientes_credito_activo ON clientes_credito(activo);
CREATE INDEX idx_clientes_credito_empresa_estado ON clientes_credito(empresa_id, estado);

CREATE TABLE movimientos_credito (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    cliente_credito_id UUID NOT NULL,
    cliente_id UUID NOT NULL,
    viaje_id UUID,
    pago_id UUID,

    codigo VARCHAR(30) NOT NULL,
    tipo_movimiento VARCHAR(20) NOT NULL,
    concepto VARCHAR(100),

    monto NUMERIC(12,2) NOT NULL,
    signo VARCHAR(10) NOT NULL,
    saldo_anterior NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_posterior NUMERIC(12,2) NOT NULL DEFAULT 0,

    fecha_hora_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP,

    CONSTRAINT fk_mov_credito_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_mov_credito_cliente_credito
        FOREIGN KEY (cliente_credito_id) REFERENCES clientes_credito(id),

    CONSTRAINT fk_mov_credito_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),

    CONSTRAINT fk_mov_credito_viaje
        FOREIGN KEY (viaje_id) REFERENCES viajes(id),

    CONSTRAINT fk_mov_credito_pago
        FOREIGN KEY (pago_id) REFERENCES pagos(id),

    CONSTRAINT uq_mov_credito_codigo UNIQUE (empresa_id, codigo),

    CONSTRAINT chk_mov_credito_tipo
        CHECK (tipo_movimiento IN (
            'cargo_viaje',
            'pago',
            'ajuste_credito',
            'anulacion',
            'correccion'
        )),

    CONSTRAINT chk_mov_credito_signo
        CHECK (signo IN (
            'cargo',
            'abono'
        )),

    CONSTRAINT chk_mov_credito_monto
        CHECK (monto > 0),

    CONSTRAINT chk_mov_credito_saldo_anterior
        CHECK (saldo_anterior >= 0),

    CONSTRAINT chk_mov_credito_saldo_posterior
        CHECK (saldo_posterior >= 0)
);

CREATE INDEX idx_mov_credito_empresa ON movimientos_credito(empresa_id);
CREATE INDEX idx_mov_credito_cliente_credito ON movimientos_credito(cliente_credito_id);
CREATE INDEX idx_mov_credito_cliente ON movimientos_credito(cliente_id);
CREATE INDEX idx_mov_credito_viaje ON movimientos_credito(viaje_id);
CREATE INDEX idx_mov_credito_pago ON movimientos_credito(pago_id);
CREATE INDEX idx_mov_credito_tipo ON movimientos_credito(tipo_movimiento);
CREATE INDEX idx_mov_credito_fecha_hora ON movimientos_credito(fecha_hora_movimiento);
CREATE INDEX idx_mov_credito_cliente_credito_fecha ON movimientos_credito(cliente_credito_id, fecha_hora_movimiento);
CREATE INDEX idx_mov_credito_empresa_fecha ON movimientos_credito(empresa_id, fecha_hora_movimiento);

CREATE TABLE eventos (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,

    tipo_entidad VARCHAR(30) NOT NULL,
    entidad_id UUID NOT NULL,

    tipo_evento VARCHAR(30) NOT NULL,
    subtipo_evento VARCHAR(50),

    usuario_id UUID,
    operadora_id UUID,
    chofer_id UUID,
    taxi_id UUID,
    pedido_id UUID,
    asignacion_id UUID,
    viaje_id UUID,
    pago_id UUID,
    cliente_id UUID,

    descripcion TEXT NOT NULL,
    datos JSONB,

    fecha_hora_evento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_origen VARCHAR(50),
    origen VARCHAR(30) NOT NULL DEFAULT 'sistema',

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_evento_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_evento_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),

    CONSTRAINT fk_evento_operadora
        FOREIGN KEY (operadora_id) REFERENCES operadoras(id),

    CONSTRAINT fk_evento_chofer
        FOREIGN KEY (chofer_id) REFERENCES choferes(id),

    CONSTRAINT fk_evento_taxi
        FOREIGN KEY (taxi_id) REFERENCES taxis(id),

    CONSTRAINT fk_evento_pedido
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id),

    CONSTRAINT fk_evento_asignacion
        FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id),

    CONSTRAINT fk_evento_viaje
        FOREIGN KEY (viaje_id) REFERENCES viajes(id),

    CONSTRAINT fk_evento_pago
        FOREIGN KEY (pago_id) REFERENCES pagos(id),

    CONSTRAINT fk_evento_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),

    CONSTRAINT chk_evento_tipo_entidad
        CHECK (tipo_entidad IN (
            'pedido',
            'asignacion',
            'viaje',
            'pago',
            'cliente',
            'chofer',
            'taxi',
            'tablet',
            'credito',
            'usuario',
            'sistema'
        )),

    CONSTRAINT chk_evento_tipo_evento
        CHECK (tipo_evento IN (
            'creacion',
            'actualizacion',
            'cambio_estado',
            'asignacion',
            'cancelacion',
            'inicio',
            'fin',
            'rechazo',
            'pago',
            'ajuste',
            'incidencia',
            'login',
            'logout'
        )),

    CONSTRAINT chk_evento_origen
        CHECK (origen IN (
            'sistema',
            'backend',
            'frontend',
            'api',
            'tablet',
            'manual'
        ))
);

CREATE INDEX idx_eventos_empresa ON eventos(empresa_id);
CREATE INDEX idx_eventos_tipo_entidad_entidad_id ON eventos(tipo_entidad, entidad_id);
CREATE INDEX idx_eventos_tipo_evento ON eventos(tipo_evento);
CREATE INDEX idx_eventos_fecha_hora_evento ON eventos(fecha_hora_evento);
CREATE INDEX idx_eventos_usuario ON eventos(usuario_id);
CREATE INDEX idx_eventos_operadora ON eventos(operadora_id);
CREATE INDEX idx_eventos_chofer ON eventos(chofer_id);
CREATE INDEX idx_eventos_taxi ON eventos(taxi_id);
CREATE INDEX idx_eventos_pedido ON eventos(pedido_id);
CREATE INDEX idx_eventos_asignacion ON eventos(asignacion_id);
CREATE INDEX idx_eventos_viaje ON eventos(viaje_id);
CREATE INDEX idx_eventos_pago ON eventos(pago_id);
CREATE INDEX idx_eventos_cliente ON eventos(cliente_id);
CREATE INDEX idx_eventos_origen ON eventos(origen);
CREATE INDEX idx_eventos_empresa_fecha ON eventos(empresa_id, fecha_hora_evento);

CREATE TABLE gps_logs (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL,
    taxi_id UUID,
    tablet_id UUID,
    viaje_id UUID,
    chofer_id UUID,

    fecha_hora_gps TIMESTAMP NOT NULL,
    latitud NUMERIC(10,7) NOT NULL,
    longitud NUMERIC(10,7) NOT NULL,

    precision_metros NUMERIC(8,2),
    velocidad_kmh NUMERIC(8,2),
    rumbo_grados NUMERIC(6,2),
    altitud_metros NUMERIC(8,2),

    fuente VARCHAR(20) NOT NULL DEFAULT 'tablet',
    estado_senal VARCHAR(20),
    motor_encendido BOOLEAN,
    en_viaje BOOLEAN,
    datos_extra JSONB,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_gps_empresa
        FOREIGN KEY (empresa_id) REFERENCES empresas(id),

    CONSTRAINT fk_gps_taxi
        FOREIGN KEY (taxi_id) REFERENCES taxis(id),

    CONSTRAINT fk_gps_tablet
        FOREIGN KEY (tablet_id) REFERENCES tablets(id),

    CONSTRAINT fk_gps_viaje
        FOREIGN KEY (viaje_id) REFERENCES viajes(id),

    CONSTRAINT fk_gps_chofer
        FOREIGN KEY (chofer_id) REFERENCES choferes(id),

    CONSTRAINT chk_gps_latitud
        CHECK (latitud BETWEEN -90 AND 90),

    CONSTRAINT chk_gps_longitud
        CHECK (longitud BETWEEN -180 AND 180),

    CONSTRAINT chk_gps_velocidad
        CHECK (velocidad_kmh IS NULL OR velocidad_kmh >= 0),

    CONSTRAINT chk_gps_rumbo
        CHECK (rumbo_grados IS NULL OR (rumbo_grados >= 0 AND rumbo_grados <= 360)),

    CONSTRAINT chk_gps_fuente
        CHECK (fuente IN (
            'tablet',
            'gps',
            'api',
            'manual',
            'backend'
        ))
);

CREATE INDEX idx_gps_logs_empresa ON gps_logs(empresa_id);
CREATE INDEX idx_gps_logs_taxi ON gps_logs(taxi_id);
CREATE INDEX idx_gps_logs_tablet ON gps_logs(tablet_id);
CREATE INDEX idx_gps_logs_viaje ON gps_logs(viaje_id);
CREATE INDEX idx_gps_logs_chofer ON gps_logs(chofer_id);
CREATE INDEX idx_gps_logs_fecha_hora_gps ON gps_logs(fecha_hora_gps);
CREATE INDEX idx_gps_logs_taxi_fecha ON gps_logs(taxi_id, fecha_hora_gps);
CREATE INDEX idx_gps_logs_viaje_fecha ON gps_logs(viaje_id, fecha_hora_gps);
CREATE INDEX idx_gps_logs_empresa_fecha ON gps_logs(empresa_id, fecha_hora_gps);