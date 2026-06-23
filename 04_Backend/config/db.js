const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

pool.on('error', (err) => {
  console.error('Error inesperado en PostgreSQL pool:', err.message);
});
pool.query('SELECT 1')
  .then(() => {
    console.log('PostgreSQL pool inicializado correctamente');
  })
  .catch((err) => {
    console.error('Error inicializando PostgreSQL pool:', err.message);
  });

module.exports = pool;
