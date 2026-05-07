const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// ✅ CREAR PEDIDO + VIAJE TEST
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const empresaId = 'e08cbddb-5d43-4df4-9a13-8e030fefd3ae';

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

router.get('/resumen', async (req, res) => {
  try {
    const { desde, hasta, estado } = req.query;

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

   let query = `
  SELECT
    v.id,
    v.codigo,
    v.estado,
    v.empresa_id,
    v.pedido_id,
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
  LEFT JOIN clientes c ON v.cliente_id = c.id
  LEFT JOIN choferes ch ON v.chofer_id = ch.id
  LEFT JOIN taxis t ON v.taxi_id = t.id
`;

const conditions = [];
const values = [];

const parsedLimit = limit ? parseInt(limit, 10) : null;
const parsedOffset = offset ? parseInt(offset, 10) : 0;
const allowedSortFields = [
  'fecha_creacion',
  'fecha_actualizacion',
  'fecha_hora_inicio',
  'fecha_hora_fin',
  'estado',
  'codigo',
  'importe_final'
];

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

const countResult = await pool.query(countQuery, values.slice(0, conditions.length));
const result = await pool.query(query, values);

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
  try {
    const { id } = req.params;

    console.log('Despachando viaje:', id);

   const viaje = await pool.query(
  'SELECT id, estado, origen_latitud, origen_longitud FROM viajes WHERE id = $1',
  [id]
); 

    if (viaje.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    if (viaje.rows[0].estado !== 'pendiente') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no está pendiente'
      });
    }

   const taxi = await pool.query(`
  SELECT
    t.id,
    t.codigo_movil,
    g.latitud,
    g.longitud,
    (
      6371 * acos(
        cos(radians($1)) *
        cos(radians(g.latitud)) *
        cos(radians(g.longitud) - radians($2)) +
        sin(radians($1)) *
        sin(radians(g.latitud))
      )
    ) AS distancia_km
  FROM taxis t
  JOIN LATERAL (
    SELECT latitud, longitud
    FROM gps_logs
    WHERE taxi_id = t.id
    ORDER BY fecha_hora_gps DESC
    LIMIT 1
  ) g ON true
  WHERE t.estado IN ('disponible', 'disponible_en_movimiento')
  AND t.activo = true
  ORDER BY distancia_km ASC
  LIMIT 1
`, [
  viaje.rows[0].origen_latitud,
  viaje.rows[0].origen_longitud
]);

    if (taxi.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No hay taxis disponibles'
      });
    }

    const taxiId = taxi.rows[0].id;

const result = await pool.query(`
  UPDATE viajes
  SET taxi_id = $1,
      estado = 'en_camino_origen',
      fecha_hora_asignacion = NOW(),
      fecha_actualizacion = NOW()
  WHERE id = $2
`, [taxiId, id]);

 // 👈 cierre correcto

// segundo query separado
await pool.query(`
  UPDATE taxis
  SET estado = 'disponible_en_movimiento'
  WHERE id = $1
`, [taxiId]);

   
    res.json({
      ok: true,
      mensaje: 'Despacho automático realizado',
      viaje: result.rows[0],
      taxi: taxi.rows[0]
    });
  } catch (error) {
    console.error('Error en despacho automático:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// 🔴 NUEVO: rechazar taxi
router.post('/:id/rechazar-taxi', async (req, res) => {
  try {
    const { id } = req.params;

    const viaje = await pool.query(`
      SELECT taxi_id
      FROM viajes
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (viaje.rows.length === 0 || !viaje.rows[0].taxi_id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

    const taxi_id = viaje.rows[0].taxi_id;

    await pool.query(`
      UPDATE viajes
      SET taxi_id = NULL,
          estado = 'pendiente',
          fecha_actualizacion = NOW()
      WHERE id = $1
    `, [id]);

    await pool.query(`
      UPDATE taxis
      SET posicion_cola = (
        SELECT COALESCE(MAX(posicion_cola), 0) + 1
        FROM taxis
      )
      WHERE id = $1
    `, [taxi_id]);

    await pool.query(`
      UPDATE taxis
      SET estado = 'disponible'
      WHERE id = $1
    `, [taxi_id]);

    res.json({
      ok: true,
      mensaje: 'Taxi rechazado correctamente'
    });

  } catch (error) {
    console.error('Error en rechazar taxi:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al rechazar taxi'
    });
  }
});

router.post('/:id/rechazar-y-reasignar', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Rechazar taxi actual
    const viajeActual = await pool.query(`
      SELECT taxi_id
      FROM viajes
      WHERE id = $1
      fecha_hora_asignacion = NOW()
      LIMIT 1
    `, [id]);

    if (viajeActual.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const taxiActualId = viajeActual.rows[0].taxi_id;

    if (taxiActualId) {
      await pool.query(`
        UPDATE viajes
        SET taxi_id = NULL,
            estado = 'pendiente',
            fecha_actualizacion = NOW()
        WHERE id = $1
      `, [id]);

      await pool.query(`
        UPDATE taxis
        SET posicion_cola = (
          SELECT COALESCE(MAX(posicion_cola), 0) + 1
          FROM taxis
        ),
        estado = 'disponible'
        WHERE id = $1
      `, [taxiActualId]);
    }

    // 2. Buscar siguiente taxi disponible por cola
    const siguienteTaxi = await pool.query(`
      SELECT id, codigo_movil
      FROM taxis
      WHERE estado = 'disponible'
        AND activo = true
      ORDER BY posicion_cola ASC
      LIMIT 1
    `);

    if (siguienteTaxi.rows.length === 0) {
      return res.json({
        ok: true,
        mensaje: 'Taxi rechazado, pero no hay otro taxi disponible'
      });
    }

    const nuevoTaxiId = siguienteTaxi.rows[0].id;

    // 3. Asignar siguiente taxi
    const resultViaje = await pool.query(`
      UPDATE viajes
      SET taxi_id = $1,
          estado = 'en_camino_origen',
          fecha_actualizacion = NOW()
      WHERE id = $2
      RETURNING id, codigo, estado, taxi_id
    `, [nuevoTaxiId, id]);

    await pool.query(`
      UPDATE taxis
      SET estado = 'disponible_en_movimiento',
          posicion_cola = (
            SELECT COALESCE(MAX(posicion_cola), 0) + 1
            FROM taxis
          )
      WHERE id = $1
    `, [nuevoTaxiId]);

    res.json({
      ok: true,
      mensaje: 'Taxi rechazado y viaje reasignado',
      viaje: resultViaje.rows[0],
      taxi_reasignado: siguienteTaxi.rows[0]
    });

  } catch (error) {
    console.error('Error en rechazar-y-reasignar:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al rechazar y reasignar',
      error: error.message
    });
  }
});

router.post('/:id/iniciar', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Iniciando viaje:', id);

    const result = await pool.query(`
      UPDATE viajes
      SET estado = 'en_viaje',
          fecha_hora_inicio = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.json({
      ok: true,
      viaje: result.rows[0]
    });
  } catch (error) {
    console.error('Error iniciar viaje:', error);
    res.status(500).json({ ok: false });
  }
});

router.post('/:id/finalizar', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Finalizando viaje:', id);

    const result = await pool.query(`
      UPDATE viajes
      SET estado = 'finalizado',
          fecha_hora_fin = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    const taxi = await pool.query(
      'SELECT taxi_id FROM viajes WHERE id = $1',
      [id]
    );

    if (taxi.rows.length > 0 && taxi.rows[0].taxi_id) {
      await pool.query(`
        UPDATE taxis
        SET estado = 'disponible'
        WHERE id = $1
      `, [taxi.rows[0].taxi_id]);
    }

    res.json({
      ok: true,
      viaje: result.rows[0]
    });
  } catch (error) {
    console.error('Error finalizar viaje:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/test', async (req, res) => {
  try {
    const empresaId = 'e08cbddb-5d43-4df4-9a13-8e030fefd3ae';

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

    res.json({ ok: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error creando test:', error);
    res.status(500).json({ ok: false });
  }
});

router.post('/controlar-timeout', async (req, res) => {
  try {
    const viajesTimeout = await pool.query(`
      SELECT id
      FROM viajes
      WHERE estado = 'en_camino_origen'
        AND taxi_id IS NOT NULL
        AND fecha_hora_asignacion IS NOT NULL
        AND NOW() - fecha_hora_asignacion > INTERVAL '30 seconds'
    `);

    for (const viaje of viajesTimeout.rows) {
      const id = viaje.id;

      const viajeActual = await pool.query(`
        SELECT taxi_id
        FROM viajes
        WHERE id = $1
        LIMIT 1
      `, [id]);

      if (viajeActual.rows.length === 0 || !viajeActual.rows[0].taxi_id) {
        continue;
      }

      const taxiActualId = viajeActual.rows[0].taxi_id;

      await pool.query(`
        UPDATE viajes
        SET taxi_id = NULL,
            estado = 'pendiente',
            fecha_actualizacion = NOW()
        WHERE id = $1
      `, [id]);

      await pool.query(`
        UPDATE taxis
        SET estado = 'disponible',
            posicion_cola = (
              SELECT COALESCE(MAX(posicion_cola), 0) + 1
              FROM taxis
            )
        WHERE id = $1
      `, [taxiActualId]);

      const siguienteTaxi = await pool.query(`
        SELECT id, codigo_movil
        FROM taxis
        WHERE estado = 'disponible'
          AND activo = true
        ORDER BY posicion_cola ASC
        LIMIT 1
      `);

      if (siguienteTaxi.rows.length === 0) {
        continue;
      }

      const nuevoTaxiId = siguienteTaxi.rows[0].id;

     await pool.query(`
  UPDATE viajes
  SET taxi_id = NULL,
      estado = 'pendiente',
      fecha_hora_asignacion = NULL,
      fecha_actualizacion = NOW()
  WHERE id = $1
`, [id]);

      await pool.query(`
        UPDATE taxis
        SET estado = 'disponible_en_movimiento',
            posicion_cola = (
              SELECT COALESCE(MAX(posicion_cola), 0) + 1
              FROM taxis
            )
        WHERE id = $1
      `, [nuevoTaxiId]);
    }

    res.json({
      ok: true,
      mensaje: 'Control de timeout ejecutado',
      total: viajesTimeout.rows.length
    });

  } catch (error) {
    console.error('Error en controlar-timeout:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error en controlar-timeout',
      error: error.message
    });
  }
});

    router.put('/:id/asignar-taxi', async (req, res) => {
  try {
    const { id } = req.params;
    const { taxi_id } = req.body;

    if (!taxi_id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'taxi_id es obligatorio'
      });
    }

    const viajeExiste = await pool.query(
      'SELECT id, estado FROM viajes WHERE id = $1',
      [id]
    );

    if (viajeExiste.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    if (
      viajeExiste.rows[0].estado === 'finalizado' ||
      viajeExiste.rows[0].estado === 'cancelado'
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede asignar taxi a un viaje en estado ${viajeExiste.rows[0].estado}`
      });
    }

    const taxiExiste = await pool.query(
      'SELECT id, codigo_movil, estado, activo FROM taxis WHERE id = $1 LIMIT 1',
      [taxi_id]
    );

    if (taxiExiste.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Taxi no encontrado'
      });
    }
   const resultViaje = await pool.query(`
  UPDATE viajes
  SET taxi_id = $1,
      estado = 'en_camino_origen',
      fecha_hora_asignacion = NOW(),
      fecha_actualizacion = NOW()
  WHERE id = $2
 RETURNING id, codigo, estado, taxi_id, fecha_hora_asignacion 
`, [taxi_id, id]);
    const resultTaxi = await pool.query(`
      UPDATE taxis
      SET estado = 'disponible_en_movimiento'
      WHERE id = $1
      RETURNING id, codigo_movil, estado
    `, [taxi_id]);

    // Mover taxi asignado al final de la cola
    await pool.query(`
      UPDATE taxis
      SET posicion_cola = (
        SELECT COALESCE(MAX(posicion_cola), 0) + 1
        FROM taxis
      )
      WHERE id = $1
    `, [taxi_id]);
    res.json({
      ok: true,
      mensaje: 'Taxi asignado correctamente',
      viaje: resultViaje.rows[0],
      taxi: resultTaxi.rows[0]
    });

  } catch (error) {
    console.error('Error en PUT /viajes/:id/asignar-taxi:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al asignar taxi',
      error: error.message
    });
  }
});

router.post('/:id/aceptar', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE viajes
      SET estado = 'en_viaje'
      WHERE id = $1
    `, [id]);

    return res.json({ ok: true });

  } catch (error) {
    console.error('Error aceptar viaje:', error);
    res.status(500).json({ ok: false });
  }
});

router.post('/:id/aceptar', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE viajes
      SET estado = 'en_viaje'
      WHERE id = $1
    `, [id]);

    return res.json({ ok: true });

  } catch (error) {
    console.error('Error aceptar viaje:', error);
    res.status(500).json({ ok: false });
  }
});


// 👇 PEGAR ACA
router.post('/:id/iniciar-viaje', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE viajes
      SET estado = 'en_viaje',
          fecha_hora_inicio = NOW(),
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false });
    }

    return res.json({ ok: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error iniciar viaje:', error);
    res.status(500).json({ ok: false });
  }
});

router.put('/:id/finalizar-viaje', async (req, res) => {
  try {
    const { id } = req.params;

    const viaje = await pool.query(
      'SELECT taxi_id FROM viajes WHERE id = $1',
      [id]
    );

    const taxiId = viaje.rows[0]?.taxi_id;

    const result = await pool.query(`
      UPDATE viajes
      SET estado = 'finalizado',
          fecha_hora_fin = NOW(),
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (taxiId) {
      await pool.query(`
        UPDATE taxis
        SET estado = 'disponible',
            fecha_actualizacion = NOW()
        WHERE id = $1
      `, [taxiId]);
    }

    return res.json({ ok: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error finalizar viaje:', error);
    res.status(500).json({ ok: false });
  }
});

router.post('/:id/asignar-automatico', async (req, res) => {
  const { id } = req.params;

  try {
    const viaje = await pool.query(
      'SELECT id, estado FROM viajes WHERE id = $1',
      [id]
    );

    if (viaje.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Viaje no encontrado' });
    }

    if (viaje.rows[0].estado !== 'pendiente') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no está pendiente'
      });
    }

    const taxi = await pool.query(`
      SELECT id, codigo_movil
      FROM taxis
      WHERE estado = 'disponible'
      AND activo = true
      ORDER BY codigo_movil
      LIMIT 1
    `);

    if (taxi.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No hay taxis disponibles'
      });
    }

    const taxi_id = taxi.rows[0].id;

    const resultViaje = await pool.query(`
      UPDATE viajes
      SET taxi_id = $1,
          estado = 'en_camino_origen',
          fecha_actualizacion = NOW()
      WHERE id = $2
      RETURNING *
    `, [taxi_id, id]);

    const resultTaxi = await pool.query(`
      UPDATE taxis
      SET estado = 'disponible_en_movimiento'
      WHERE id = $1
      RETURNING *
    `, [taxi_id]);

    const viajeConTaxi = {
  ...resultViaje.rows[0],
  taxi_codigo: resultTaxi.rows[0].codigo_movil
};

    res.json({
      ok: true,
      mensaje: 'Asignación automática realizada',
      viaje: viajeConTaxi,
      taxi: resultTaxi.rows[0]
    });

  } catch (error) {
    console.error('Error en asignación automática:', error);
    res.status(500).json({ ok: false });
  }
});

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
router.post('/controlar-estados', async (req, res) => {
  try {

    // =========================
    // 1. en_camino_origen → en_origen
    // =========================
    const viajes = await pool.query(`
      SELECT v.id, v.estado, v.origen_latitud, v.origen_longitud, v.taxi_id
      FROM viajes v
      WHERE v.estado = 'en_camino_origen'
        AND v.taxi_id IS NOT NULL
    `);

    for (const viaje of viajes.rows) {
      const gps = await pool.query(`
        SELECT latitud, longitud
        FROM gps_logs
        WHERE taxi_id = $1
        ORDER BY fecha_hora_gps DESC
        LIMIT 1
      `, [viaje.taxi_id]);

      if (gps.rows.length === 0) continue;

      const distancia = calcularDistancia(
        parseFloat(gps.rows[0].latitud),
        parseFloat(gps.rows[0].longitud),
        parseFloat(viaje.origen_latitud),
        parseFloat(viaje.origen_longitud)
      );

      if (distancia < 0.5) {
        await pool.query(`
          UPDATE viajes
          SET estado = 'en_origen',
              fecha_hora_llegada_origen = NOW()
          WHERE id = $1
        `, [viaje.id]);
      }
    }

    // =========================
    // 2. en_origen → en_viaje
    // =========================
    const viajesEnOrigen = await pool.query(`
      SELECT v.id, v.estado, v.origen_latitud, v.origen_longitud, v.taxi_id
      FROM viajes v
      WHERE v.estado = 'en_origen'
        AND v.taxi_id IS NOT NULL
    `);

    for (const viaje of viajesEnOrigen.rows) {
      const gps = await pool.query(`
        SELECT latitud, longitud
        FROM gps_logs
        WHERE taxi_id = $1
        ORDER BY fecha_hora_gps DESC
        LIMIT 1
      `, [viaje.taxi_id]);

      if (gps.rows.length === 0) continue;

      const distancia = calcularDistancia(
        parseFloat(gps.rows[0].latitud),
        parseFloat(gps.rows[0].longitud),
        parseFloat(viaje.origen_latitud),
        parseFloat(viaje.origen_longitud)
      );

      if (distancia > 0.15) {
        await pool.query(`
          UPDATE viajes
          SET estado = 'en_viaje',
              fecha_hora_inicio_real = NOW()
          WHERE id = $1
        `, [viaje.id]);

        await pool.query(`
          UPDATE taxis
          SET estado = 'ocupado'
          WHERE id = $1
        `, [viaje.taxi_id]);
      }
    }

    // 👉 RECIÉN ACÁ RESPONDE
    res.json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});
module.exports = router;