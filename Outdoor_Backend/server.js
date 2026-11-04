// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      message: 'Backend Outdoor Warrent Berhasil Berjalan!', 
      database_time: result.rows[0].now 
    });
  } catch (err) {
    console.error('Error root query:', err.code || err.message || err);
    res.status(500).send('Server Error pada Database: ' + (err.code || err.message));
  }
});

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

app.listen(PORT, async () => {
  console.log(`Server backend aktif di http://localhost:${PORT}`);
  try {
    const res = await db.query('SELECT NOW()');
    console.log('✅ Berhasil terhubung ke database PostgreSQL! Waktu server:', res.rows[0].now);
  } catch (err) {
    const errMsg = err.code || err.message || 'ETIMEDOUT (Koneksi timeout)';
    console.error(`❌ Gagal terhubung ke database: [${errMsg}]`);
    if (errMsg === 'ETIMEDOUT' || err.code === 'ETIMEDOUT') {
      console.error('👉 Penyebab: Port database (5432) diblokir oleh Wi-Fi/jaringan internet Anda.');
      console.error('👉 Solusi cepat: Coba ganti koneksi internet ke Hotspot HP (Tethering).');
    }
  }
});
