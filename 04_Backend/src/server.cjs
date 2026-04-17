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


// ======================================================
// SERVIDOR
// ======================================================

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
