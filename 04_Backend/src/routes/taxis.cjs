const express = require('express');
const router = express.Router();
const colaTaxis = require('../services/colaTaxis.cjs');

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
  'Reintentando consulta PostgreSQL en taxis:',
  sql.substring(0, 80)
);

    await new Promise(resolve => setTimeout(resolve, 300));

    return queryConReintento(pool, sql, params, intentos - 1);
  }
}

module.exports = (pool) => {

  // LISTAR TAXIS
  router.get('/', async (req, res) => {

    try {
const result = await queryConReintento(pool, `
  SELECT
    t.id AS taxi_id,
    t.codigo_movil,
    t.estado,
    -34.9011 AS latitud,
    -56.1645 AS longitud,
    0 AS velocidad_kmh,
    0 AS rumbo_grados
  FROM taxis t
  ORDER BY t.id
`);

      res.json(result.rows);

    } catch (error) {

      console.error('Error al obtener taxis:', error);

      res.status(500).json({
        error: 'Error al obtener taxis'
      });

    }

  });

  // POSICIONES GPS ACTUALES
router.get('/positions', async (req, res) => {

 try {
  const result = await queryConReintento(pool, `
  SELECT DISTINCT ON (g.taxi_id)
  g.taxi_id,
  g.latitud,
  g.longitud,
  g.velocidad_kmh,
  g.rumbo_grados,
  g.fecha_hora_gps,
  g.fuente,
  t.estado,
  t.estado AS estado_operativo,
  t.codigo_movil
FROM gps_logs g
LEFT JOIN taxis t
  ON t.id = g.taxi_id
WHERE g.latitud IS NOT NULL
  AND g.longitud IS NOT NULL
ORDER BY g.taxi_id, g.fecha_hora_gps DESC
`);

    res.json({
      ok: true,
      taxis: result.rows
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error obteniendo posiciones GPS'
    });

  }

});


  router.get('/cola', async (req, res) => {
  try {
    const cola = await colaTaxis.obtenerCola(pool);

    res.json({
      ok: true,
      data: cola
    });

  } catch (error) {
    console.error('Error obteniendo cola de taxis:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error obteniendo cola de taxis'
    });
  }
});

  // TAXI POR ID
  router.get('/:id', async (req, res) => {

    const { id } = req.params;

    try {

      const result = await pool.query(
        'SELECT * FROM taxis WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          ok: false,
          mensaje: 'Taxi no encontrado'
        });

      }

      res.json(result.rows[0]);

    } catch (error) {

      console.error('Error al obtener taxi por id:', error);

      res.status(500).json({
        ok: false,
        mensaje: 'Error al obtener taxi',
        error: error.message
      });

    }

  });

  return router;

};

