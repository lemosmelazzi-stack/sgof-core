async function obtenerCola(pool) {
  const resultado = await pool.query(`
    SELECT
      id,
      codigo_movil,
      estado,
      orden_cola,
      fecha_ultimo_cambio_cola,
      motivo_cambio_cola
    FROM taxis
    WHERE
    orden_cola IS NOT NULL
    AND estado = 'disponible'
    ORDER BY orden_cola ASC;
  `);

  return resultado.rows;
}

async function reordenarCola(pool) {
  const resultado = await pool.query(`
    WITH cola_ordenada AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY orden_cola ASC) AS nuevo_orden
      FROM taxis
      WHERE orden_cola IS NOT NULL
    )
    UPDATE taxis t
    SET
      orden_cola = c.nuevo_orden,
      fecha_ultimo_cambio_cola = NOW(),
      motivo_cambio_cola = 'Reordenamiento automático de cola'
    FROM cola_ordenada c
    WHERE t.id = c.id
    RETURNING
      t.id,
      t.codigo_movil,
      t.estado,
      t.orden_cola,
      t.fecha_ultimo_cambio_cola,
      t.motivo_cambio_cola;
  `);

  return resultado.rows;
}

async function moverTaxiAlFinal(pool, taxiId, motivo = 'Movimiento manual de cola') {
  await pool.query(`
    UPDATE taxis
    SET
      orden_cola = (
        SELECT COALESCE(MAX(orden_cola), 0) + 1
        FROM taxis
      ),
      fecha_ultimo_cambio_cola = NOW(),
      motivo_cambio_cola = $2
    WHERE id = $1;
  `, [taxiId, motivo]);

  await reordenarCola(pool);

  return await obtenerCola(pool);
}

async function obtenerPrimerTaxiDisponible(pool) {
  const resultado = await pool.query(`
    SELECT
      id,
      codigo_movil,
      estado,
      orden_cola,
      fecha_ultimo_cambio_cola,
      motivo_cambio_cola
    FROM taxis
    WHERE
      orden_cola IS NOT NULL
      AND estado = 'disponible'
    ORDER BY orden_cola ASC
    LIMIT 1;
  `);

  return resultado.rows[0] || null;
}

module.exports = {
  obtenerCola,
  reordenarCola,
  moverTaxiAlFinal,
  obtenerPrimerTaxiDisponible
};

async function moverTaxiAlFinal(pool, taxiId, motivo = 'Movimiento manual de cola') {
  await pool.query(`
    UPDATE taxis
    SET
      orden_cola = (
        SELECT COALESCE(MAX(orden_cola), 0) + 1
        FROM taxis
      ),
      fecha_ultimo_cambio_cola = NOW(),
      motivo_cambio_cola = $2
    WHERE id = $1;
  `, [taxiId, motivo]);

  await reordenarCola(pool);

  return await obtenerCola(pool);
}

async function reordenarCola(pool) {
  const resultado = await pool.query(`
    WITH cola_ordenada AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY orden_cola ASC) AS nuevo_orden
      FROM taxis
      WHERE orden_cola IS NOT NULL
        AND estado = 'disponible'
        AND activo = true
    )
    UPDATE taxis t
    SET
      orden_cola = c.nuevo_orden,
      fecha_ultimo_cambio_cola = NOW(),
      motivo_cambio_cola = 'Reordenamiento automático de cola'
    FROM cola_ordenada c
    WHERE t.id = c.id
    RETURNING
      t.id,
      t.codigo_movil,
      t.estado,
      t.orden_cola,
      t.fecha_ultimo_cambio_cola,
      t.motivo_cambio_cola;
  `);

  return resultado.rows;
}

async function obtenerPrimerTaxiDisponible(pool) {
  const resultado = await pool.query(`
    SELECT
      id,
      codigo_movil,
      estado,
      orden_cola,
      fecha_ultimo_cambio_cola,
      motivo_cambio_cola
    FROM taxis
    WHERE
      orden_cola IS NOT NULL
      AND estado = 'disponible'
    ORDER BY orden_cola ASC
    LIMIT 1;
  `);

  return resultado.rows[0] || null;
}
module.exports = {
  obtenerCola,
  moverTaxiAlFinal,
  reordenarCola,
  obtenerPrimerTaxiDisponible
};

