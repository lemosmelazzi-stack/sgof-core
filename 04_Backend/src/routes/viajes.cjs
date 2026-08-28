const ESTADOS = require('../constants/estados.cjs');
const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const colaTaxis = require('../services/colaTaxis.cjs');
const ESTADOS_VIAJE_VALIDOS = Object.values(ESTADOS.VIAJE);

function fechaValida(valor) {
  if (!valor) return true;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);

  if (!match) return false;

  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

function uuidValido(valor) {
  if (!valor) return true;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}

// ✅ CREAR PEDIDO + VIAJE TEST
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const empresaId = '4b593c63-8fdd-4c9d-bd48-54cb6ae89623';

    const codigoPedido = `PED-TEST-${Date.now()}`;
    const codigoViaje = `VIA-TEST-${Date.now()}`;

    const pedidoResult = await client.query(`
  
      INSERT INTO pedidos (
  id,
  empresa_id,
  codigo,
  estado,
  origen_direccion,
  destino_direccion,
  fecha_creacion,
  fecha_actualizacion
)
VALUES (
  gen_random_uuid(),
  $1,
  $2,
  'pendiente',
  'Origen prueba',
  'Destino prueba',
  NOW(),
  NOW()
)

      RETURNING id
    `, [empresaId, codigoPedido]);

    const pedidoId = pedidoResult.rows[0].id;

    const viajeResult = await client.query(`
     INSERT INTO viajes (
  id,
  empresa_id,
  pedido_id,
  codigo,
  estado,
  origen_direccion,
  destino_direccion,
  fecha_creacion,
  fecha_actualizacion
)
VALUES (
  gen_random_uuid(),
  $1,
  $2,
  $3,
  'pendiente',
  'Origen prueba',
  'Destino prueba',
  NOW(),
  NOW()
)
      RETURNING *
    `, [empresaId, pedidoId, codigoViaje]);

    await client.query('COMMIT');

    res.json({
      ok: true,
      mensaje: 'Pedido y viaje test creados',
      pedido_id: pedidoId,
      data: viajeResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error creando pedido/viaje test:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error al crear pedido/viaje test',
      error: error.message
    });

  } finally {
    client.release();
  }
});

async function queryConReintento(pool, sql, params = [], intentos = 2) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    const mensaje = error.message || '';

    const esConexionCortada =
      mensaje.includes('Connection terminated unexpectedly') ||
      mensaje.includes('ECONNRESET') ||
      mensaje.includes('timeout');

    if (!esConexionCortada || intentos <= 1) {
      throw error;
    }

   console.warn(
  'Reintentando consulta PostgreSQL:',
  sql.substring(0, 80)
);

    await new Promise(resolve => setTimeout(resolve, 300));

    return queryConReintento(
      pool,
      sql,
      params,
      intentos - 1
    );
  }
}

router.get('/resumen', async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;

    if (estado && !ESTADOS_VIAJE_VALIDOS.includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Estado de viaje inválido'
      });
    }
    if (!fechaValida(desde) || !fechaValida(hasta)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'desde y hasta deben contener fechas válidas'
      });
    }

    if (desde && hasta && new Date(desde) > new Date(hasta)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'desde no puede ser posterior a hasta'
      });
    }

   // 🔹 Construir filtros dinámicos
    let filtros = [];
    let valores = [];

    if (estado) {
      valores.push(estado);
      filtros.push(`estado = $${valores.length}`);
    }

    if (desde) {
      valores.push(desde);
      filtros.push(`fecha_hora_inicio >= $${valores.length}`);
    }

    if (hasta) {
      valores.push(hasta);
      filtros.push(`fecha_hora_inicio <= $${valores.length}`);
    }

   const whereClause = filtros.length ? `WHERE ${filtros.join(' AND ')}` : 'WHERE TRUE';
    // 🔹 Queries
    const totalQuery = `
      SELECT COUNT(*) AS total_viajes
      FROM viajes
      ${whereClause}
    `;

    const estadoQuery = `
      SELECT estado, COUNT(*) AS cantidad
      FROM viajes
      ${whereClause}
      GROUP BY estado
      ORDER BY estado
    `;

    const porMesQuery = `
      SELECT
        TO_CHAR(fecha_hora_inicio, 'YYYY-MM') AS periodo,
        COUNT(*) AS cantidad
      FROM viajes
      ${whereClause}
      AND fecha_hora_inicio IS NOT NULL
      GROUP BY periodo
      ORDER BY periodo
    `;

    const metricasQuery = `
      SELECT
        COALESCE(SUM(distancia_km), 0) AS distancia_total_km,
        COALESCE(SUM(importe_final), 0) AS importe_total,
        COALESCE(SUM(duracion_minutos), 0) AS duracion_total_min,
        COALESCE(AVG(importe_final), 0) AS promedio_importe
      FROM viajes
      ${whereClause}
      AND estado = 'finalizado'
    `;

    // 🔹 Ejecutar queries
    const totalResult = await pool.query(totalQuery, valores);
    const estadoResult = await pool.query(estadoQuery, valores);
    const porMesResult = await pool.query(porMesQuery, valores);
    const metricasResult = await pool.query(metricasQuery, valores);

    // 🔹 Respuesta
    res.json({
      ok: true,
      data: {
        total_viajes: parseInt(totalResult.rows[0].total_viajes, 10),

        por_estado: estadoResult.rows.map(row => ({
          estado: row.estado,
          cantidad: parseInt(row.cantidad, 10)
        })),

        por_mes: porMesResult.rows.map(row => ({
          periodo: row.periodo,
          cantidad: parseInt(row.cantidad, 10)
        })),

        metricas: {
          distancia_total_km: Number(metricasResult.rows[0].distancia_total_km),
          importe_total: Number(metricasResult.rows[0].importe_total),
          duracion_total_min: Number(metricasResult.rows[0].duracion_total_min),
          promedio_importe: Number(metricasResult.rows[0].promedio_importe)
        }
      }
    });

  } catch (error) {
    console.error('Error en GET /viajes/resumen:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener resumen de viajes',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
   const { empresa_id, estado, desde, hasta, limit, offset, sort, order } = req.query;

   if (!uuidValido(empresa_id)) {
     return res.status(400).json({
       ok: false,
       mensaje: 'empresa_id debe ser un UUID válido'
     });
   }

   if (estado && !ESTADOS_VIAJE_VALIDOS.includes(estado)) {
     return res.status(400).json({
       ok: false,
       mensaje: 'Estado de viaje inválido'
     });
   }

   if (!fechaValida(desde) || !fechaValida(hasta)) {
     return res.status(400).json({
       ok: false,
       mensaje: 'desde y hasta deben contener fechas válidas'
     });
   }

   if (desde && hasta && new Date(desde) > new Date(hasta)) {
     return res.status(400).json({
       ok: false,
       mensaje: 'desde no puede ser posterior a hasta'
     });
   }

   let query = `
  SELECT
    v.id,
    v.codigo,
    v.estado,
    v.empresa_id,
    v.pedido_id,

     p.origen_latitud,
     p.origen_longitud,
     p.destino_latitud,
     p.destino_longitud,

    v.cliente_id,
    v.chofer_id,
    v.fecha_hora_asignacion,
    v.taxi_id,
    v.origen_direccion,
    v.destino_direccion,    
    v.fecha_hora_inicio,
    v.fecha_hora_fin,
    v.importe_estimado,
    v.importe_final,
    v.fecha_creacion,
    v.fecha_actualizacion,

    c.nombre AS cliente_nombre,
    (ch.nombre || ' ' || ch.apellido) AS chofer_nombre,
    t.codigo_movil AS taxi_codigo

  FROM viajes v

  LEFT JOIN pedidos p
  ON v.pedido_id = p.id
  
  LEFT JOIN clientes c
    ON v.cliente_id = c.id

  LEFT JOIN choferes ch
    ON v.chofer_id = ch.id

  LEFT JOIN taxis t
    ON v.taxi_id = t.id
`;

const conditions = [];
const values = [];

const parsedLimit = limit ? Number(limit) : null;
const parsedOffset = offset ? Number(offset) : 0;
if (
  parsedLimit !== null &&
  (!Number.isInteger(parsedLimit) || parsedLimit <= 0)
) {
  return res.status(400).json({
    ok: false,
    mensaje: 'limit debe ser un entero mayor que 0'
  });
}

if (parsedLimit !== null && parsedLimit > 1000) {
  return res.status(400).json({
    ok: false,
    mensaje: 'limit no puede ser mayor que 1000'
  });
}

if (
  !Number.isInteger(parsedOffset) ||
  parsedOffset < 0
) {
  return res.status(400).json({
    ok: false,
    mensaje: 'offset debe ser un entero mayor o igual a 0'
  });
}
const allowedSortFields = [
  'fecha_creacion',
  'fecha_actualizacion',
  'fecha_hora_inicio',
  'fecha_hora_fin',
  'estado',
  'codigo',
  'importe_final'
];

if (Array.isArray(order)) {
  return res.status(400).json({
    ok: false,
    mensaje: 'order debe contener un único valor'
  });
}

const sortField = allowedSortFields.includes(sort) ? sort : 'fecha_creacion';
const sortOrder = order && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
if (empresa_id) {
  values.push(empresa_id);
  conditions.push(`v.empresa_id = $${values.length}`);
}

if (estado) {
  values.push(estado);
  conditions.push(`v.estado = $${values.length}`);
}

if (desde) {
  values.push(desde);
  conditions.push(`v.fecha_creacion >= $${values.length}`);
}

if (hasta) {
  values.push(hasta);
  conditions.push(`v.fecha_creacion <= $${values.length}`);
}

let countQuery = `
  SELECT COUNT(*) AS total
  FROM viajes v
  LEFT JOIN clientes c ON v.cliente_id = c.id
  LEFT JOIN choferes ch ON v.chofer_id = ch.id
  LEFT JOIN taxis t ON v.taxi_id = t.id
`;

if (conditions.length > 0) {
  countQuery += ' WHERE ' + conditions.join(' AND ');
}

if (conditions.length > 0) {
  query += ' WHERE ' + conditions.join(' AND ');
}

query += ` ORDER BY v.${sortField} ${sortOrder}`;

if (parsedLimit) {
  values.push(parsedLimit);
  query += ` LIMIT $${values.length}`;
}

if (parsedOffset) {
  values.push(parsedOffset);
  query += ` OFFSET $${values.length}`;
}

const countResult = await queryConReintento(
  pool,
  countQuery,
  values.slice(0, conditions.length)
);

const result = await queryConReintento(
  pool,
  query,
  values
);

res.json({
  ok: true,
  total: parseInt(countResult.rows[0].total, 10),
  limit: parsedLimit,
  offset: parsedOffset,
  count: result.rows.length,
  data: result.rows
});

  } catch (error) {
    console.error('Error en GET /viajes:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener viajes',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !uuidValido(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id debe ser un UUID válido'
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        codigo,
        estado,
        empresa_id,
        pedido_id,
        cliente_id,
        chofer_id,
        taxi_id,
        origen_direccion,
        destino_direccion,
        origen_latitud,
        origen_longitud,
        destino_latitud,
        destino_longitud,
        fecha_hora_asignacion,
        fecha_hora_inicio,
        fecha_hora_fin,
        distancia_km,
        duracion_minutos,
        importe_estimado,
        importe_final,
        fecha_creacion
      FROM viajes
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    return res.json({
      ok: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error en GET /viajes/:id:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener viaje',
      error: error.message
    });
  }
});

router.post('/:id/despachar', async (req, res) => {
  res.status(410).json({
    ok: false,
    mensaje: 'Endpoint /despachar obsoleto. Usar flujo de Cola Inteligente.'
  });
});

router.post('/:id/rechazar', async (req, res) => {
  const { id } = req.params;

  if (!id || !uuidValido(id)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'id debe ser un UUID válido'
    });
  }

  const { taxi_id } = req.body || {};

  if (!taxi_id) {
    return res.status(400).json({
      ok: false,
      mensaje: 'taxi_id es obligatorio para rechazar el viaje'
    });
  }

  if (!uuidValido(taxi_id)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'taxi_id debe ser un UUID válido'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const viajeActual = await client.query(`
      SELECT id, codigo, estado, taxi_id
      FROM viajes
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `, [id]);

    if (viajeActual.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const viaje = viajeActual.rows[0];

    if (viaje.estado !== 'asignado') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: `No se puede rechazar un viaje en estado ${viaje.estado}`
      });
    }

    if (!viaje.taxi_id) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado para rechazar'
      });
    }

    if (viaje.taxi_id !== taxi_id) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: 'El taxi indicado ya no corresponde a la asignación actual del viaje'
      });
    }

    const taxiActualId = viaje.taxi_id;

    await client.query(`
      UPDATE taxis
      SET estado = 'disponible',
          fecha_actualizacion = NOW()
      WHERE id = $1
    `, [taxiActualId]);

    await colaTaxis.moverTaxiAlFinal(
      client,
      taxiActualId,
      'Taxi rechazó viaje'
    );

    const siguienteTaxi = await client.query(`
      SELECT id, codigo_movil
      FROM taxis
      WHERE estado = 'disponible'
        AND activo = true
        AND orden_cola IS NOT NULL
        AND id <> $1
      ORDER BY orden_cola ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [taxiActualId]);

    if (siguienteTaxi.rows.length === 0) {
      const viajePendiente = await client.query(`
        UPDATE viajes
        SET taxi_id = NULL,
            estado = 'pendiente',
            fecha_actualizacion = NOW()
        WHERE id = $1
          AND estado = 'asignado'
          AND taxi_id = $2
        RETURNING id, codigo, estado, taxi_id
      `, [id, taxiActualId]);

      if (viajePendiente.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          ok: false,
          mensaje: 'El viaje ya no está disponible para rechazar'
        });
      }

      await client.query('COMMIT');

      return res.json({
        ok: true,
        mensaje: 'Taxi rechazado. No hay otro taxi disponible.',
        viaje: viajePendiente.rows[0],
        taxi_reasignado: null
      });
    }

    const nuevoTaxi = siguienteTaxi.rows[0];

    const viajeReasignado = await client.query(`
      UPDATE viajes
      SET taxi_id = $1,
          estado = 'asignado',
          fecha_hora_asignacion = NOW(),
          fecha_actualizacion = NOW()
      WHERE id = $2
        AND estado = 'asignado'
        AND taxi_id = $3
      RETURNING id, codigo, estado, taxi_id
    `, [nuevoTaxi.id, id, taxiActualId]);

    if (viajeReasignado.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje ya no está disponible para rechazar'
      });
    }

    await client.query(`
      UPDATE taxis
      SET estado = 'ocupado',
          fecha_actualizacion = NOW()
      WHERE id = $1
    `, [nuevoTaxi.id]);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      mensaje: `Taxi rechazado. Viaje reasignado a ${nuevoTaxi.codigo_movil}`,
      viaje: viajeReasignado.rows[0],
      taxi_reasignado: nuevoTaxi
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error en POST /viajes/:id/rechazar:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error al rechazar y reasignar viaje',
      error: error.message
    });

  } finally {
    client.release();
  }
});

router.post('/:id/iniciar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    if (!id || !uuidValido(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id debe ser un UUID válido'
      });
    }

    await client.query('BEGIN');
    const viajeResult = await client.query(`
      SELECT id, estado, taxi_id
      FROM viajes
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (viajeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const viaje = viajeResult.rows[0];
    if (viaje.estado === 'en_curso') {
      await client.query('ROLLBACK');
      return res.json({
        ok: true,
        mensaje: 'Viaje ya iniciado',
        viaje
      });
    }

    if (viaje.estado !== 'en_origen') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede iniciar un viaje en estado ${viaje.estado}`
      });
    }

    if (!viaje.taxi_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

    const resultViaje = await client.query(`
      UPDATE viajes
      SET estado = 'en_curso',
          fecha_hora_inicio = NOW(),
          fecha_actualizacion = NOW()
      WHERE id = $1
        AND estado = 'en_origen'
      RETURNING
        id,
        codigo,
        estado,
        taxi_id,
        origen_latitud,
        origen_longitud,
        origen_direccion,
        destino_latitud,
        destino_longitud,
        destino_direccion
    `, [id]);

    if (resultViaje.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje ya no está disponible para iniciar'
      });
    }

    const resultTaxi = await client.query(`
      UPDATE taxis
      SET estado = 'ocupado',
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING id, codigo_movil, estado
    `, [viaje.taxi_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');

    if (io) {
      io.emit('viaje-actualizado', resultViaje.rows[0]);
      io.emit('taxi-actualizado', resultTaxi.rows[0]);
    }

    res.json({
      ok: true,
      mensaje: 'Viaje iniciado correctamente',
      viaje: resultViaje.rows[0],
      taxi: resultTaxi.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error en POST /viajes/:id/iniciar:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error interno al iniciar viaje',
      error: error.message
    });

  } finally {
    client.release();
  }
});

router.post('/:id/finalizar', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!id || !uuidValido(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id debe ser un UUID válido'
      });
    }

    await client.query('BEGIN');

    const viajeResult = await client.query(`
      SELECT id, estado, taxi_id
      FROM viajes
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `, [id]);

    if (viajeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const viaje = viajeResult.rows[0];

    if (viaje.estado !== 'en_curso') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede finalizar un viaje en estado ${viaje.estado}`
      });
    }

    if (!viaje.taxi_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

    const taxiResult = await client.query(`
      UPDATE taxis
      SET estado = 'disponible',
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING id, codigo_movil, estado
    `, [viaje.taxi_id]);

    const viajeFinalizado = await client.query(`
      UPDATE viajes
      SET estado = 'finalizado',
          fecha_hora_fin = NOW(),
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    await colaTaxis.moverTaxiAlFinal(
      client,
      viaje.taxi_id,
      'Taxi finalizó viaje'
    );

    await client.query('COMMIT');

    const io = req.app.get('io');

    if (io) {
      io.emit('viaje-actualizado', viajeFinalizado.rows[0]);
      io.emit('taxi-actualizado', taxiResult.rows[0]);
      io.emit('cola-operativa-actualizada');
    }

    res.json({
      ok: true,
      mensaje: 'Viaje finalizado correctamente',
      viaje: viajeFinalizado.rows[0],
      taxi: taxiResult.rows[0]
    });


  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error finalizar viaje:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error interno al finalizar viaje',
      error: error.message
    });

  } finally {
    client.release();
  }
});

router.post('/test', async (req, res) => {
  
  try {
   const empresaId = '4b593c63-8fdd-4c9d-bd48-54cb6ae89623'; 
    const result = await pool.query(`
      WITH nuevo_pedido AS (
        INSERT INTO pedidos (
          id, empresa_id, codigo, estado, canal,
          origen_latitud, origen_longitud, origen_direccion,
          destino_latitud, destino_longitud, destino_direccion,
          fecha_creacion, fecha_actualizacion
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'PED-TEST-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
          'pendiente',
          'manual',
          -34.90517,
          -56.16689,
          'Origen prueba',
          -34.89110,
          -56.15450,
          'Destino prueba',
          NOW(),
          NOW()
        )
        RETURNING id
      )
      INSERT INTO viajes (
        id, empresa_id, pedido_id, codigo, estado,
        origen_latitud, origen_longitud, origen_direccion,
        destino_latitud, destino_longitud, destino_direccion,
        fecha_creacion, fecha_actualizacion
      )
      SELECT
        gen_random_uuid(),
        $1,
        id,
        'VIA-TEST-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
        'pendiente',
        -34.90517,
        -56.16689,
        'Origen prueba',
        -34.89110,
        -56.15450,
        'Destino prueba',
        NOW(),
        NOW()
      FROM nuevo_pedido
      RETURNING *;
    `, [empresaId]);

   const io = req.app.get('io');

if (io) {
  
  io.emit('viaje-creado', result.rows[0]);
}

res.json({ ok: true, data: result.rows[0] });


  } catch (error) {
  console.error('ERROR REAL CREANDO TEST:', error);

  res.status(500).json({
    ok: false,
    mensaje: 'Error creando test',
    error: error.message,
    detalle: error.detail || null
  });
}
});

router.post('/test/limpiar-abiertos', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const viajesCerrados = await client.query(`
      UPDATE viajes
      SET estado = 'finalizado',
          fecha_hora_fin = COALESCE(fecha_hora_fin, NOW()),
          fecha_actualizacion = NOW()
      WHERE codigo LIKE 'VIA-TEST-%'
        AND estado IN ('asignado', 'en_camino_origen', 'en_origen', 'en_curso', 'pendiente')
      RETURNING id, codigo, estado, taxi_id
    `);

    const taxisLiberados = await client.query(`
      UPDATE taxis
      SET estado = 'disponible',
          fecha_actualizacion = NOW()
      RETURNING id, codigo_movil, estado
    `);

    await client.query(`
      WITH cola_ordenada AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY orden_cola ASC NULLS LAST, codigo_movil ASC) AS nuevo_orden
        FROM taxis
        WHERE activo = true
      )
      UPDATE taxis t
      SET orden_cola = c.nuevo_orden,
          fecha_ultimo_cambio_cola = NOW(),
          motivo_cambio_cola = 'Limpieza de viajes test abiertos'
      FROM cola_ordenada c
      WHERE t.id = c.id
    `);

    await client.query('COMMIT');

    res.json({
      ok: true,
      mensaje: 'Viajes test abiertos cerrados y taxis liberados',
      viajes_cerrados: viajesCerrados.rows.length,
      taxis_liberados: taxisLiberados.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error limpiando viajes test abiertos:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error limpiando viajes test abiertos',
      error: error.message
    });

  } finally {
    client.release();
  }
});



router.post('/:id/aceptar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    if (!id || !uuidValido(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id debe ser un UUID válido'
      });
    }

    await client.query('BEGIN');

    const viajeResult = await client.query(`
      SELECT id, taxi_id, estado
      FROM viajes
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (viajeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const viaje = viajeResult.rows[0];

    if (!viaje.taxi_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

    if (viaje.estado !== 'asignado') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede aceptar un viaje en estado ${viaje.estado}`
      });
    }

    const viajeUpdate = await client.query(`
      UPDATE viajes
      SET estado = 'en_camino_origen',
          fecha_actualizacion = NOW()
      WHERE id = $1
        AND estado = 'asignado'
      RETURNING *
    `, [id]);

    if (viajeUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje ya no está disponible para aceptar'
      });
    }

    const taxiUpdate = await client.query(`
      UPDATE taxis
      SET estado = 'ocupado',
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING id, codigo_movil, estado
    `, [viaje.taxi_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');

    if (io) {
      io.emit('viaje-actualizado', viajeUpdate.rows[0]);
      io.emit('taxi-actualizado', taxiUpdate.rows[0]);
    }

    return res.json({
      ok: true,
      mensaje: 'Viaje aceptado',
      viaje: viajeUpdate.rows[0],
      taxi: taxiUpdate.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error aceptar viaje:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error al aceptar viaje',
      error: error.message
    });

  } finally {
    client.release();
  }
});

router.post('/asignar', async (req, res) => {
  const client = await pool.connect();

  try {
    const { viaje_id, taxi_id } = req.body;

    if (!viaje_id || !taxi_id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'viaje_id y taxi_id son obligatorios'
      });
    }

    if (!uuidValido(viaje_id) || !uuidValido(taxi_id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'viaje_id y taxi_id deben ser UUID válidos'
      });
    }

    await client.query('BEGIN');

    const taxiExiste = await client.query(`
      SELECT id, codigo_movil, estado, activo
      FROM taxis
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `, [taxi_id]);

    if (taxiExiste.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        mensaje: 'Taxi no encontrado'
      });
    }

    if (
      taxiExiste.rows[0].activo !== true ||
      taxiExiste.rows[0].estado !== 'disponible'
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: `El taxi ${taxiExiste.rows[0].codigo_movil} no está disponible para asignación`
      });
    }

    const taxiConViajeActivo = await client.query(`
      SELECT id, codigo, estado
      FROM viajes
      WHERE taxi_id = $1
        AND estado IN ('asignado', 'en_camino_origen', 'en_origen', 'en_curso')
        AND id <> $2
      LIMIT 1
    `, [taxi_id, viaje_id]);

    if (taxiConViajeActivo.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: `El taxi ${taxiExiste.rows[0].codigo_movil} ya tiene un viaje activo`
      });
    }

    const result = await client.query(`
      UPDATE viajes
      SET
        taxi_id = $1,
        estado = 'asignado',
        fecha_hora_asignacion = NOW(),
        fecha_actualizacion = NOW()
      WHERE id = $2
        AND estado = 'pendiente'
      RETURNING *
    `, [taxi_id, viaje_id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no existe o no está pendiente'
      });
    }

    const taxiUpdate = await client.query(`
      UPDATE taxis
      SET
        estado = 'ocupado',
        fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING *
    `, [taxi_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');

    if (io) {
      io.emit('taxi-actualizado', taxiUpdate.rows[0]);
      io.emit('viaje-actualizado', result.rows[0]);
      io.emit('cola-operativa-actualizada');
    }

    res.json({
      ok: true,
      mensaje: 'Taxi asignado correctamente',
      viaje: result.rows[0],
      taxi: taxiUpdate.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('ERROR /viajes/asignar:', error);

    res.status(500).json({
      ok: false,
      error: error.message
    });

  } finally {
    client.release();
  }
});

function calcularScoreOperativo({
  distanciaKm,
  gps,
  ordenCola
}) {
  let score = 100;

  score -= distanciaKm * 5;

  if (gps.estado === 'demorado') {
    score -= 10;
  }

  if (gps.estado === 'viejo' || gps.estado === 'sin_gps') {
    score -= 100;
  }

  score -= (Number(ordenCola) - 1) * 2;

  return Number(score.toFixed(1));
}

function evaluarCalidadGps(fechaHoraGps) {

  if (!fechaHoraGps) {
    return {
      estado: 'sin_gps',
      minutos: null,
      participa: false
    };
  }

  const ahora = new Date();
  const gps = new Date(fechaHoraGps);

  const minutos = (ahora - gps) / 1000 / 60;

  if (minutos <= 5) {
    return {
      estado: 'bueno',
      minutos: Number(minutos.toFixed(1)),
      participa: true
    };
  }

  if (minutos <= 15) {
    return {
      estado: 'demorado',
      minutos: Number(minutos.toFixed(1)),
      participa: true
    };
  }

  return {
    estado: 'viejo',
    minutos: Number(minutos.toFixed(1)),
    participa: false
  };
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
const UMBRAL_KM_ROMPER_COLA = 1.5;

async function diagnosticarAsignacionInteligente(pool, viajeId) {
  const viajeResult = await pool.query(`
    SELECT
      id,
      estado,
      origen_latitud,
      origen_longitud
    FROM viajes
    WHERE id = $1
    LIMIT 1
  `, [viajeId]);

  if (viajeResult.rows.length === 0) {
    console.log('DIAG INTELIGENTE: viaje no encontrado');
    return;
  }

  const viaje = viajeResult.rows[0];

  const taxisResult = await pool.query(`
    SELECT 
      t.id,
      t.codigo_movil,
      t.orden_cola,
      gl.latitud,
      gl.longitud,
      gl.fecha_hora_gps
    FROM taxis t
    LEFT JOIN LATERAL (
      SELECT latitud, longitud, fecha_hora_gps
      FROM gps_logs
      WHERE taxi_id = t.id
      ORDER BY fecha_hora_gps DESC
      LIMIT 1
    ) gl ON true
    WHERE t.estado = 'disponible'
      AND t.activo = true
      AND t.orden_cola IS NOT NULL
    ORDER BY t.orden_cola ASC
  `);

  const taxisConDistancia = taxisResult.rows.map((taxi) => {
    const distanciaKm = calcularDistancia(
      Number(taxi.latitud),
      Number(taxi.longitud),
      Number(viaje.origen_latitud),
      Number(viaje.origen_longitud)
    );

    const gps = evaluarCalidadGps(taxi.fecha_hora_gps);

    const score = calcularScoreOperativo({
      ordenCola: taxi.orden_cola,
      distanciaKm,
      gps
    });

    return {
      ...taxi,
      distancia_origen_km: distanciaKm,
      gps,
      score
    };
  });

  console.log('==============================');
  console.log('DIAGNÓSTICO ASIGNACIÓN INTELIGENTE');
  console.log('Viaje:', viaje.id);
  console.log('Estado:', viaje.estado);
  console.log('Origen:', viaje.origen_latitud, viaje.origen_longitud);
  console.log('Taxis disponibles por cola:');

  taxisConDistancia.forEach((taxi, index) => {
    console.log(`${index + 1}. ${taxi.codigo_movil}`, {
      taxi_id: taxi.id,
      orden_cola: taxi.orden_cola,
      latitud: taxi.latitud,
      longitud: taxi.longitud,
      fecha_hora_gps: taxi.fecha_hora_gps,
      distancia_origen_km: Number(taxi.distancia_origen_km.toFixed(2)),
      gps_estado: taxi.gps.estado,
      gps_minutos: taxi.gps.minutos,
      participa: taxi.gps.participa,
      score: taxi.score
    });
  });

  if (taxisConDistancia.length === 0) {
    console.log('No hay taxis disponibles para diagnóstico');
    console.log('==============================');
    return;
  }

  const taxiBase = taxisConDistancia[0];

  const taxiMasCercano = taxisConDistancia.reduce((mejor, actual) => {
    return actual.distancia_origen_km < mejor.distancia_origen_km
      ? actual
      : mejor;
  }, taxiBase);

  const taxisParticipantes = taxisConDistancia.filter(taxi =>
    taxi.gps.participa === true
  );

  const hayParticipantes = taxisParticipantes.length > 0;

  const taxiMejorScore = hayParticipantes
    ? taxisParticipantes.reduce((mejor, actual) => {
        return actual.score > mejor.score ? actual : mejor;
      }, taxisParticipantes[0])
    : taxiBase;

  const taxiRecomendado = hayParticipantes ? taxiMejorScore : null;
  const taxiRespaldoOperativo = taxiBase;

  const diferenciaKm =
    taxiBase.distancia_origen_km - taxiMasCercano.distancia_origen_km;

  const decisionActual = diferenciaKm >= UMBRAL_KM_ROMPER_COLA
    ? taxiMasCercano
    : taxiBase;

  const motivosRecomendado = [];

  if (taxiRecomendado) {
    motivosRecomendado.push(`Mayor Score Operativo: ${taxiRecomendado.score}`);

    motivosRecomendado.push(
      `Distancia al origen: ${Number(taxiRecomendado.distancia_origen_km.toFixed(2))} km`
    );

    motivosRecomendado.push(
      `GPS: ${taxiRecomendado.gps.estado} (${taxiRecomendado.gps.minutos} min)`
    );

    if (taxiRecomendado.id === taxiBase.id) {
      motivosRecomendado.push('Respeta la cola operativa');
    }

    if (taxiRecomendado.id === taxiMasCercano.id) {
      motivosRecomendado.push('Es el taxi más cercano');
    }

    if (taxiRecomendado.gps.participa) {
      motivosRecomendado.push('GPS válido para participar');
    } else {
      motivosRecomendado.push('GPS no válido para participar');
    }
  }

  console.log('Taxi base por cola:', taxiBase.codigo_movil);
  console.log('Taxi más cercano:', taxiMasCercano.codigo_movil);
  console.log('Taxi mejor score:', taxiMejorScore.codigo_movil);
  console.log('Diferencia km:', Number(diferenciaKm.toFixed(2)));

  console.log(
    'Decisión sugerida:',
    diferenciaKm >= UMBRAL_KM_ROMPER_COLA
      ? 'ROMPER COLA por proximidad'
      : 'RESPETAR COLA'
  );

  console.log('Decisión actual elegiría:', decisionActual.codigo_movil);

  if (taxiRecomendado) {
    console.log('Decisión por score elegiría:', taxiRecomendado.codigo_movil);
    console.log(
      'Coinciden:',
      decisionActual.id === taxiRecomendado.id ? 'SI' : 'NO'
    );
  } else {
    console.log('Decisión por score elegiría: SIN RECOMENDADO CONFIABLE');
    console.log('Coinciden: NO APLICA');
  }

  console.log('');

  if (taxiRecomendado) {
    console.log('RECOMENDADO ⭐');
    console.log('Taxi:', taxiRecomendado.codigo_movil);
    console.log('Motivos:');

    motivosRecomendado.forEach((motivo) => {
      console.log('-', motivo);
    });
  } else {
    console.log('SIN RECOMENDADO CONFIABLE ⚠️');
    console.log('Motivo: ningún taxi tiene GPS válido');
    console.log('Respaldo operativo:', taxiRespaldoOperativo.codigo_movil, 'por cola');
  }

  if (taxiRecomendado && decisionActual.id !== taxiRecomendado.id) {
    console.log('');
    console.log('⚠️ ATENCIÓN');
    console.log('La decisión actual y el recomendado NO coinciden.');
    console.log('Motivo probable:');

    if (!taxiBase.gps.participa) {
      console.log('- El taxi de la cola tiene GPS no válido.');
    }

    if (taxiRecomendado.score > decisionActual.score) {
      console.log('- Existe una mejor alternativa operativa.');
    }
  }

  console.log('==============================');
}

async function seleccionarTaxiInteligente(viajeId) {
  const viajeResult = await pool.query(`
    SELECT id, estado, origen_latitud, origen_longitud
    FROM viajes
    WHERE id = $1
    LIMIT 1
  `, [viajeId]);

  if (viajeResult.rows.length === 0) {
    return { ok: false, mensaje: 'Viaje no encontrado' };
  }

  const viaje = viajeResult.rows[0];

  if (viaje.estado !== 'pendiente') {
    return { ok: false, mensaje: 'El viaje no está pendiente' };
  }

  const origenLat = Number(viaje.origen_latitud);
  const origenLng = Number(viaje.origen_longitud);

  const taxisResult = await pool.query(`
    SELECT DISTINCT ON (t.id)
      t.id AS taxi_id,
      t.codigo_movil,
      t.orden_cola,
      g.latitud,
      g.longitud,
      g.fecha_hora_gps
    FROM taxis t
    LEFT JOIN gps_logs g ON g.taxi_id = t.id
    WHERE t.estado = 'disponible'
      AND t.activo = true
      AND t.orden_cola IS NOT NULL
    ORDER BY t.id, g.fecha_hora_gps DESC NULLS LAST
  `);

  const ahora = new Date();

  const taxis = taxisResult.rows
    .map(t => {
      const lat = Number(t.latitud);
      const lng = Number(t.longitud);
      const fechaGps = t.fecha_hora_gps ? new Date(t.fecha_hora_gps) : null;
      const gpsMinutos = fechaGps ? Math.round((ahora - fechaGps) / 60000) : null;

      const gpsValido =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        gpsMinutos !== null &&
        gpsMinutos <= 15;

      const distanciaKm = gpsValido
        ? calcularDistanciaKm(origenLat, origenLng, lat, lng)
        : null;

      return {
        ...t,
        gps_valido: gpsValido,
        gps_minutos: gpsMinutos,
        gps_calidad: gpsValido
          ? (gpsMinutos <= 5 ? 'bueno' : 'demorado')
          : 'viejo',
        distancia_origen_km: distanciaKm
      };
    })
    .sort((a, b) => Number(a.orden_cola) - Number(b.orden_cola));

  if (taxis.length === 0) {
    return { ok: false, mensaje: 'No hay taxis disponibles' };
  }

  const taxisValidos = taxis.filter(t => t.gps_valido);

  let recomendado;
  let motivo;

  if (taxisValidos.length === 0) {
    recomendado = taxis[0];
    motivo = `SIN RECOMENDADO CONFIABLE. Se usa respaldo por cola: ${recomendado.codigo_movil}.`;
  } else {
    const primeroColaValido = taxisValidos[0];
    const masCercano = [...taxisValidos].sort(
      (a, b) => a.distancia_origen_km - b.distancia_origen_km
    )[0];

    const diferenciaKm =
      primeroColaValido.distancia_origen_km - masCercano.distancia_origen_km;

    if (
      masCercano.taxi_id !== primeroColaValido.taxi_id &&
      diferenciaKm >= UMBRAL_KM_ROMPER_COLA
    ) {
      recomendado = masCercano;
      motivo = `Se rompe cola: ${masCercano.codigo_movil} está ${diferenciaKm.toFixed(2)} km más cerca que ${primeroColaValido.codigo_movil}.`;
    } else {
      recomendado = primeroColaValido;
      motivo = `Se respeta cola: ${primeroColaValido.codigo_movil} es el primer taxi con GPS válido.`;
    }
  }

    const viajeOperativoTaxi = await pool.query(`
    SELECT id, codigo, estado
    FROM viajes
    WHERE taxi_id = $1
      AND estado IN ('asignado', 'en_camino_origen', 'en_origen', 'en_curso')
    LIMIT 1
  `, [recomendado.taxi_id]);

  if (viajeOperativoTaxi.rows.length > 0) {
    return {
      ok: false,
      mensaje: `El taxi ${recomendado.codigo_movil} ya posee un viaje operativo.`,
      viaje_operativo: viajeOperativoTaxi.rows[0]
    };
  }

  return {
    ok: true,
    taxi_id: recomendado.taxi_id,
    codigo_movil: recomendado.codigo_movil,
    motivo,
    recomendado,
    diagnostico: taxis
  };
}
router.post('/:id/asignar-automatico', async (req, res) => {
  const { id } = req.params;

  if (!id || !uuidValido(id)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'id debe ser un UUID válido'
    });
  }

  const client = await pool.connect();

  try {
    const decision = await seleccionarTaxiInteligente(id);

    if (!decision.ok) {
      return res.status(400).json(decision);
    }

    await client.query('BEGIN');

    const taxiBloqueado = await client.query(`
      SELECT id, codigo_movil, estado, activo
      FROM taxis
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `, [decision.taxi_id]);

    if (taxiBloqueado.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        ok: false,
        mensaje: 'Taxi recomendado no encontrado'
      });
    }

    const taxi = taxiBloqueado.rows[0];

    if (
      taxi.activo !== true ||
      taxi.estado !== 'disponible'
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: `El taxi ${taxi.codigo_movil} ya no está disponible para asignación automática`
      });
    }

    const viajeOperativoTaxi = await client.query(`
      SELECT id, codigo, estado
      FROM viajes
      WHERE taxi_id = $1
        AND estado IN ('asignado', 'en_camino_origen', 'en_origen', 'en_curso')
        AND id <> $2
      LIMIT 1
    `, [decision.taxi_id, id]);

    if (viajeOperativoTaxi.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: `El taxi ${taxi.codigo_movil} ya posee un viaje operativo`
      });
    }

    const result = await client.query(`
      UPDATE viajes
      SET
        taxi_id = $1,
        estado = 'asignado',
        fecha_hora_asignacion = NOW(),
        fecha_actualizacion = NOW()
      WHERE id = $2
        AND estado = 'pendiente'
      RETURNING *
    `, [decision.taxi_id, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo asignar el viaje'
      });
    }

    await client.query(`
      UPDATE taxis
      SET
        estado = 'ocupado',
        fecha_actualizacion = NOW()
      WHERE id = $1
    `, [decision.taxi_id]);

    await client.query('COMMIT');

    req.io?.emit('viaje-actualizado', result.rows[0]);

    req.io?.emit('taxi-actualizado', {
      taxi_id: decision.taxi_id,
      estado: 'ocupado'
    });

    req.io?.emit('cola-operativa-actualizada');

    return res.json({
      ok: true,
      mensaje: `Viaje asignado automáticamente a ${decision.codigo_movil}`,
      data: result.rows[0],
      decision: {
        taxi_id: decision.taxi_id,
        codigo_movil: decision.codigo_movil,
        motivo: decision.motivo,
        gps_calidad: decision.recomendado.gps_calidad,
        gps_minutos: decision.recomendado.gps_minutos,
        distancia_origen_km: decision.recomendado.distancia_origen_km
      },
      diagnostico: decision.diagnostico
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error en asignación automática inteligente:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno en asignación automática inteligente',
      error: error.message
    });

  } finally {
    client.release();
  }
});

router.put('/:id/en-origen', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !uuidValido(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id debe ser un UUID válido'
      });
    }

    const viajeActual = await pool.query(`
      SELECT id, estado, taxi_id
      FROM viajes
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (viajeActual.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const viaje = viajeActual.rows[0];

    if (!viaje.taxi_id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

    if (viaje.estado !== 'en_camino_origen') {
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede marcar en origen un viaje en estado ${viaje.estado}`
      });
    }

    const result = await pool.query(
      `
      UPDATE viajes
      SET
        estado = 'en_origen',
        fecha_hora_llegada_origen = NOW(),
        fecha_actualizacion = NOW()
      WHERE id = $1
        AND estado = 'en_camino_origen'
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje ya no está disponible para marcar en origen'
      });
    }


const io = req.app.get('io');

if (io) {
  io.emit('viaje-actualizado', result.rows[0]);
}

res.json({
  ok: true,
  mensaje: 'Taxi en origen',
  viaje: result.rows[0]
});


  } catch (error) {
    console.error('ERROR /viajes/:id/en-origen:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al marcar en origen'
    });
  }
});

module.exports = router;
