// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server backend aktif di http://localhost:${PORT}`);
});
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);