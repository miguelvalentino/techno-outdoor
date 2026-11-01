// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint Tes Koneksi & Database
app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      message: 'Backend Outdoor Warrent Berhasil Berjalan!', 
      database_time: result.rows[0].now 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error pada Database');
  }
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`Server backend aktif di http://localhost:${PORT}`);
});

// server.js (Tambahkan baris ini)
const apiRoutes = require('./routes/api');

// Gunakan middleware API
app.use('/api', apiRoutes);