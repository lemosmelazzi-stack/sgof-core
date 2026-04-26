// src/routes/taxis.cjs
const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM taxis ORDER BY id');
      res.json(result.rows);
    } catch (error) {
      console.error('Error al obtener taxis:', error);
      res.status(500).json({ error: 'Error al obtener taxis' });
    }
  });

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

  router.post('/', async (req, res) => {
  const body = req.body || {};

  const {
    empresa_id,
    codigo_movil,
    numero_interno,
    matricula,
    marca,
    modelo,
    anio,
    color
  } = body;

  if (!empresa_id || !codigo_movil || !matricula || !marca || !modelo) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Faltan datos obligatorios o no se envió body en JSON'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO taxis
      (empresa_id, codigo_movil, numero_interno, matricula, marca, modelo, anio, color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [empresa_id, codigo_movil, numero_interno, matricula, marca, modelo, anio, color]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Taxi creado correctamente',
      taxi: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear taxi:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al crear taxi',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  const {
    empresa_id,
    codigo_movil,
    numero_interno,
    matricula,
    marca,
    modelo,
    anio,
    color
  } = body;

  if (!empresa_id || !codigo_movil || !matricula || !marca || !modelo) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Faltan datos obligatorios o no se envió body en JSON'
    });
  }

  try {
    const existe = await pool.query(
      'SELECT id FROM taxis WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Taxi no encontrado'
      });
    }

    const result = await pool.query(
      `UPDATE taxis
       SET empresa_id = $1,
           codigo_movil = $2,
           numero_interno = $3,
           matricula = $4,
           marca = $5,
           modelo = $6,
           anio = $7,
           color = $8
       WHERE id = $9
       RETURNING *`,
      [empresa_id, codigo_movil, numero_interno, matricula, marca, modelo, anio, color, id]
    );

    res.json({
      ok: true,
      mensaje: 'Taxi actualizado correctamente',
      taxi: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar taxi:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al actualizar taxi',
      error: error.message
    });
  }
});
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existe = await pool.query(
      'SELECT id FROM taxis WHERE id = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Taxi no encontrado'
      });
    }

    await pool.query(
      'UPDATE asignaciones SET taxi_id = NULL WHERE taxi_id = $1',
      [id]
    );

    await pool.query(
      'UPDATE viajes SET taxi_id = NULL WHERE taxi_id = $1',
      [id]
    );

    await pool.query(
      'UPDATE gps_logs SET taxi_id = NULL WHERE taxi_id = $1',
      [id]
    );

    const result = await pool.query(
      'DELETE FROM taxis WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({
      ok: true,
      mensaje: 'Taxi eliminado correctamente',
      taxi: result.rows[0]
    });
  } catch (error) {
    console.error('Error al eliminar taxi:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error al eliminar taxi',
      error: error.message
    });
  }
});
  return router;
};
