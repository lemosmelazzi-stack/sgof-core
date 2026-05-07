const express = require('express');
const router = express.Router();

module.exports = (pool) => {

  // LISTAR TAXIS
  router.get('/', async (req, res) => {

    try {

     const result = await pool.query(`
  SELECT
    t.*,
    -34.9011 AS latitud,
    -56.1645 AS longitud
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

    const result = await pool.query(`
      SELECT DISTINCT ON (taxi_id)
        taxi_id,
        latitud,
        longitud,
        velocidad_kmh,
        rumbo_grados,
        fecha_hora_gps
      FROM gps_logs
      WHERE latitud IS NOT NULL
        AND longitud IS NOT NULL
      ORDER BY taxi_id, fecha_hora_gps DESC
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
