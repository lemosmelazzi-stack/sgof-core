const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

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

router.post('/:id/despachar', async (req, res) => {
  try {
    const { id } = req.params;
    
    const viaje = await pool.query(
      'SELECT id, estado FROM viajes WHERE id = $1 LIMIT 1',
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
      SELECT id, codigo_movil
      FROM taxis
      WHERE estado = 'disponible'
      LIMIT 1
    `);

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
        estado = '${en_camino_origen}', 
          fecha_actualizacion = NOW()
      WHERE id = $2
      RETURNING *
    `, [taxiId, id]);

    await pool.query(`
      UPDATE taxis
   SET estado = 'en_camino_origen'
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

router.post('/:id/iniciar', async (req, res) => {
  try {
    const { id } = req.params;

    
    const viajeResult = await pool.query(`
      SELECT id, estado, taxi_id
      FROM viajes
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (viajeResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    const viaje = viajeResult.rows[0];

    if (viaje.estado !== en_camino_origen) {
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede iniciar un viaje en estado ${estadoViajeTexto(viaje.estado)} `
      });
    }

    if (!viaje.taxi_id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

const result = await pool.query(`
  UPDATE viajes
  SET estado = 'en_curso',
      fecha_hora_inicio = NOW(),
      fecha_actualizacion = NOW()
  WHERE id = $1
  RETURNING *
`, [id]);

const taxiUpdate = await pool.query(`
  UPDATE taxis
  SET estado = 'ocupado',
      fecha_actualizacion = NOW()
  WHERE id = $1
  RETURNING id, codigo_movil, estado
`, [viaje.taxi_id]);

const io = req.app.get('io');

if (io) {
  io.emit('viaje-actualizado', result.rows[0]);
  io.emit('taxi-actualizado', taxiUpdate.rows[0]);
}

return res.json({
  ok: true,
  mensaje: 'Viaje iniciado correctamente',
  viaje: result.rows[0],
  taxi: taxiUpdate.rows[0]
});

    /*const result = await pool.query(`
      UPDATE viajes
      SET estado = '${ESTADOS.VIAJE.EN_CURSO}',
          fecha_hora_inicio = NOW(),
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    const taxiUpdate = await pool.query(`
      UPDATE taxis
      SET estado = '${ESTADOS.TAXI.OCUPADO}',
          fecha_actualizacion = NOW()
      WHERE id = $1
      RETURNING id, codigo_movil, estado
    `, [viaje.taxi_id]);

    'TAXI PASADO A OCUPADO:', taxiUpdate.rows);

    res.json({
      ok: true,
      mensaje: 'Viaje iniciado correctamente',
      viaje: result.rows[0],
      taxi: taxiUpdate.rows[0]
    });

  } catch (error) {
    console.error('Error iniciar viaje:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno al iniciar viaje',
      error: error.message
    });
  }
});
*/
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
      fecha_actualizacion = NOW()
  WHERE id = $2
  RETURNING id, codigo, estado, taxi_id, fecha_actualizacion
`, [taxi_id, id]);

const resultTaxi = await pool.query(`
  UPDATE taxis
  SET estado = '${ESTADOS.TAXI.EN_CAMINO_ORIGEN}'
  WHERE id = $1
  RETURNING id, codigo_movil, estado
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

router.put('/:id/desasignar-taxi', async (req, res) => {
  const { id } = req.params;

  
  try {
    const viajeExiste = await pool.query(
      'SELECT id, estado, taxi_id FROM viajes WHERE id = $1',
      [id]
    );

    if (viajeExiste.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Viaje no encontrado'
      });
    }

    if (!viajeExiste.rows[0].taxi_id) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El viaje no tiene taxi asignado'
      });
    }

    if (
      viajeExiste.rows[0].estado === 'finalizado' ||
      viajeExiste.rows[0].estado === 'cancelado'
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: `No se puede desasignar taxi de un viaje en estado ${viajeExiste.rows[0].estado}`
      });
    }

    const result = await pool.query(
      `UPDATE viajes
       SET taxi_id = NULL,
           fecha_actualizacion = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      ok: true,
      mensaje: 'Taxi desasignado correctamente',
      viaje: result.rows[0]
    });
  } catch (error) {
    console.error('Error en PUT /viajes/:id/desasignar-taxi:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al desasignar taxi',
      error: error.message
    });
  }
});


module.exports = router; 