// db.js
const { Pool } = require('pg');
require('dotenv').config();

const isCloud = process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
      ssl: isCloud ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('Terhubung ke database PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Koneksi database error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
