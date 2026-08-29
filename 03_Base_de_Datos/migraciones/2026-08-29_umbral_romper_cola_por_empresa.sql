ALTER TABLE configuracion_empresa
ADD COLUMN IF NOT EXISTS umbral_km_romper_cola numeric NOT NULL DEFAULT 1.0;

INSERT INTO configuracion_empresa (
  id,
  empresa_id,
  nombre_comercial
)
SELECT
  '7c1e4f6a-2b93-4d8a-9f51-6e2c0a7b3d84',
  '4b593c63-8fdd-4c9d-bd48-54cb6ae89623',
  'SGOF DEMO'
WHERE NOT EXISTS (
  SELECT 1
  FROM configuracion_empresa
  WHERE empresa_id = '4b593c63-8fdd-4c9d-bd48-54cb6ae89623'
);

UPDATE configuracion_empresa
SET
  umbral_km_romper_cola = 0.5,
  fecha_actualizacion = CURRENT_TIMESTAMP
WHERE empresa_id = '4b593c63-8fdd-4c9d-bd48-54cb6ae89623';
