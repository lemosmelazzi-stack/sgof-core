// ======================================================
// CONFIGURACION GENERAL
// ======================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('../config/db');
const viajesRoutes = require('./routes/viajes.cjs');
const app = express();
const taxisRoutes = require('./routes/taxis.cjs');
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/viajes', viajesRoutes);
app.use('/taxis', taxisRoutes(pool));
// ======================================================
// ENDPOINTS DE VIAJES
// ======================================================



// ======================================================
// ENDPOINTS DE UTILIDAD
// ======================================================

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      ok: true,
      mensaje: 'Conexión OK con PostgreSQL',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error en /test-db:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error conectando con PostgreSQL',
      error: error.message
    });
  }
});
// ======================================================
// ENDPOINTS DE TAXIS
// ======================================================
app.get('/mapa-taxis', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.id AS taxi_id,
        t.codigo_movil,
        t.estado,
        g.latitud,
        g.longitud
      FROM taxis t
      LEFT JOIN LATERAL (
        SELECT latitud, longitud
        FROM gps_logs
        WHERE taxi_id = t.id
        ORDER BY fecha_hora_gps DESC
        LIMIT 1
      ) g ON true
      WHERE t.activo = true
    `);

    res.json({
      ok: true,
      taxis: result.rows
    });

  } catch (error) {
    console.error('Error en /mapa-taxis:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

