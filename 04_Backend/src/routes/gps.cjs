const express = require('express');
const crypto = require('crypto');

const router = express.Router();
router.get('/ping', (req, res) => {
  res.json({ ok: true, mensaje: 'GPS router vivo' });
});

router.post('/simular-test', (req, res) => {
  res.json({ ok: true, mensaje: 'POST simular-test funciona' });
});

router.post('/posicion', async (req, res) => {
  try {
    const {
      taxi_id,
      latitud,
      longitud,
      velocidad_kmh = 0,
      rumbo_grados = 0,
      fuente = 'gps'
    } = req.body;

    const lat = Number(latitud);
    const lng = Number(longitud);

    if (!taxi_id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Datos GPS inválidos'
      });
    }

    const empresaId = '4b593c63-8fdd-4c9d-bd48-54cb6ae89623';

    const result = await req.app.get('pool').query(
      `
      INSERT INTO gps_logs (
        id,
        empresa_id,
        taxi_id,
        fecha_hora_gps,
        latitud,
        longitud,
        velocidad_kmh,
        rumbo_grados,
        fuente,
        estado_senal,
        estado,
        fecha_creacion
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        NOW(),
        $3,
        $4,
        $5,
        $6,
        $7,
        'ok',
        'activo',
        NOW()
      )
      RETURNING *
      `,
      [
        empresaId,
        taxi_id,
        lat,
        lng,
        Number(velocidad_kmh) || 0,
        Number(rumbo_grados) || 0,
        fuente
      ]
    );

    const gps = result.rows[0];

    const io = req.app.get('io');

    if (io) {
      io.emit('taxi_posicion', {
        taxiId: gps.taxi_id,
        taxi_id: gps.taxi_id,
        lat: Number(gps.latitud),
        lng: Number(gps.longitud),
        latitud: Number(gps.latitud),
        longitud: Number(gps.longitud),
        velocidad_kmh: Number(gps.velocidad_kmh) || 0,
        rumbo_grados: Number(gps.rumbo_grados) || 0,
        fuente: gps.fuente,
        fecha_hora_gps: gps.fecha_hora_gps
      });
    }

    res.json({
      ok: true,
      mensaje: 'Posición GPS registrada',
      gps
    });

  } catch (error) {
    console.error('Error en POST /gps/posicion:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error al registrar posición GPS',
      error: error.message
    });
  }
});

router.post('/simular-taxi/:taxiId', (req, res) => {
  const { taxiId } = req.params;

  const puntos = [
    [-34.9060, -56.1930],
    [-34.9058, -56.1925],
    [-34.9055, -56.1920],
    [-34.9052, -56.1915],
    [-34.9050, -56.1910],
    [-34.9048, -56.1905],
    [-34.9045, -56.1900]
  ];

  const io = req.app.get('io');

  let i = 0;

  const intervalo = setInterval(() => {
    if (i >= puntos.length) {
      clearInterval(intervalo);
      return;
    }

    const [lat, lng] = puntos[i];

    io.emit('taxi_posicion', {
      taxiId,
      lat,
      lng,
      velocidad_kmh: 35,
      fuente: 'simulacion'
    });
    
    i++;
  }, 1500);

  res.json({
    ok: true,
    mensaje: 'Simulación taxi iniciada'
  });
});

const pool = require('../../config/db');

router.get('/historial/:taxiId', async (req, res) => {
  try {
    const { taxiId } = req.params;
    const { desde, hasta } = req.query;

    let query = `
      SELECT
        id,
        taxi_id,
        viaje_id,
        chofer_id,
        fecha_hora_gps,
        latitud,
        longitud,
        velocidad_kmh,
        rumbo_grados,
        fuente,
        estado_senal,
        estado
      FROM gps_logs
      WHERE taxi_id = $1
    `;

    const params = [taxiId];

    if (desde) {
      params.push(desde);
      query += ` AND fecha_hora_gps >= $${params.length}`;
    }

    if (hasta) {
      params.push(hasta);
      query += ` AND fecha_hora_gps <= $${params.length}`;
    }

    query += `
      ORDER BY fecha_hora_gps ASC
      LIMIT 5000
    `;

    const result = await pool.query(query, params);

    res.json({
      ok: true,
      taxi_id: taxiId,
      total: result.rows.length,
      puntos: result.rows
    });

  } catch (error) {
    console.error('Error consultando historial GPS:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error consultando historial GPS',
      error: error.message
    });
  }
});

router.get('/resumen-hoy/:taxiId', async (req, res) => {
  try {
    const { taxiId } = req.params;

    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS puntos_hoy,
        MIN(fecha_hora_gps) AS primer_gps,
        MAX(fecha_hora_gps) AS ultimo_gps,
        MAX(velocidad_kmh) AS velocidad_maxima
      FROM gps_logs
      WHERE taxi_id = $1
       AND fecha_hora_gps >= COALESCE($2::date, CURRENT_DATE)
       AND fecha_hora_gps < COALESCE($2::date, CURRENT_DATE) + INTERVAL '1 day'

    `, [taxiId, req.query.fecha || null]);
    
    res.json({
      ok: true,
      taxi_id: taxiId,
      resumen: result.rows[0]
    });

  } catch (error) {
    console.error('Error consultando resumen GPS de hoy:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error consultando resumen GPS de hoy',
      error: error.message
    });
  }
});

async function insertarGps(req, res, fuenteDefault, mensajeOk) {
  try {
    const {
      empresa_id,
      taxi_id,
      viaje_id = null,
      chofer_id = null,
      latitud,
      longitud,
      velocidad_kmh = null,
      rumbo_grados = null,
      fuente = fuenteDefault,
      estado_senal = 'ok',
      estado = 'activo'
    } = req.body;

    if (!empresa_id || !taxi_id || latitud == null || longitud == null) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Faltan empresa_id, taxi_id, latitud o longitud'
      });
    }

    const result = await pool.query(`
      INSERT INTO gps_logs (
        id,
        empresa_id,
        taxi_id,
        viaje_id,
        chofer_id,
        fecha_hora_gps,
        latitud,
        longitud,
        velocidad_kmh,
        rumbo_grados,
        fuente,
        estado_senal,
        estado,
        fecha_creacion
      )
      VALUES (
        $1, $2, $3, $4, $5,
        NOW(),
        $6, $7, $8, $9,
        $10, $11, $12,
        NOW()
      )
      RETURNING *
    `, [
      crypto.randomUUID(),
      empresa_id,
      taxi_id,
      viaje_id,
      chofer_id,
      latitud,
      longitud,
      velocidad_kmh,
      rumbo_grados,
      fuente,
      estado_senal,
      estado
    ]);

    const gps = result.rows[0];
    const io = req.app.get('io');

    if (io) {
      io.emit('taxi_posicion', {
        taxiId: gps.taxi_id,
        lat: Number(gps.latitud),
        lng: Number(gps.longitud),
        velocidad_kmh: gps.velocidad_kmh,
        rumbo_grados: gps.rumbo_grados,
        fecha_hora_gps: gps.fecha_hora_gps,
        fuente: gps.fuente
      });
    }

    res.json({
      ok: true,
      mensaje: mensajeOk,
      gps
    });

  } catch (error) {
    console.error('Error insertando GPS:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error insertando GPS',
      error: error.message
    });
  }
}

router.post('/test', async (req, res) => {
  return insertarGps(req, res, 'backend', 'GPS test insertado correctamente');
});

router.post('/update', async (req, res) => {
  return insertarGps(req, res, 'gps', 'GPS actualizado correctamente');
});

module.exports = router;
