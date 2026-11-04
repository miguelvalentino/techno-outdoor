// routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const snap = require('../midtrans');

const DEFAULT_WORKING_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

let guideTablesInitialized = false;
const ensureGuideTables = async () => {
  if (guideTablesInitialized) return;
  try {
    await db.query('ALTER TABLE guides ADD COLUMN IF NOT EXISTS description TEXT');
    await db.query("ALTER TABLE guides ADD COLUMN IF NOT EXISTS working_days TEXT[] DEFAULT ARRAY['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']");
    await db.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS guide_id INT');
    await db.query(`
      CREATE TABLE IF NOT EXISTS guide_reviews (
        id SERIAL PRIMARY KEY,
        order_id INT,
        guide_id INT REFERENCES guides(id) ON DELETE CASCADE,
        customer_id INT REFERENCES users(id) ON DELETE CASCADE,
        customer_name VARCHAR(100),
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS guide_schedules (
        id SERIAL PRIMARY KEY,
        guide_id INT REFERENCES guides(id) ON DELETE CASCADE,
        order_id INT,
        customer_name VARCHAR(100),
        destination VARCHAR(150),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        note TEXT,
        status VARCHAR(50) DEFAULT 'Terjadwal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    guideTablesInitialized = true;
  } catch (err) {
    console.error('Error initializing guide tables:', err.message);
  }
};

// Helper untuk mengekstrak tanggal DD/MM/YYYY s/d DD/MM/YYYY dari nama item order
const parseDateRangeFromItemName = (itemName) => {
  if (!itemName) return null;
  const match = itemName.match(/(\d{2})\/(\d{2})\/(\d{4})\s*s\/d\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, d1, m1, y1, d2, m2, y2] = match;
  return {
    start_date: `${y1}-${m1}-${d1}`,
    end_date: `${y2}-${m2}-${d2}`
  };
};

// --- 0. PAYMENT CONFIG & WEBHOOK ---
router.get('/payment/client-key', (req, res) => {
  res.json({ clientKey: process.env.MIDTRANS_CLIENT_KEY || '' });
});

router.post('/payment/notification', async (req, res) => {
  try {
    await ensureGuideTables();
    const statusResponse = await snap.transaction.notification(req.body);
    const orderIdRaw = statusResponse.order_id;
    const orderId = orderIdRaw ? orderIdRaw.split('-')[1] : null;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    let newStatus = 'Menunggu Pembayaran';
    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        newStatus = 'Diproses';
      }
    } else if (transactionStatus === 'settlement') {
      newStatus = 'Diproses';
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
      newStatus = 'Dibatalkan';
    } else if (transactionStatus === 'pending') {
      newStatus = 'Menunggu Pembayaran';
    }

    if (orderId) {
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);
      await db.query('UPDATE guide_schedules SET status = $1 WHERE order_id = $2', [newStatus, orderId]);
    }

    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('Error handling midtrans notification:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal mengambil data produk' });
  }
});

router.get('/bundles', async (req, res) => {
  const { type } = req.query;
  try {
    let queryStr = 'SELECT * FROM bundles';
    let queryParams = [];

    if (type) {
      queryStr += ' WHERE type = $1';
      queryParams.push(type);
    }
    queryStr += ' ORDER BY id ASC';

    const bundlesResult = await db.query(queryStr, queryParams);
    const bundles = bundlesResult.rows;

    const fullBundles = await Promise.all(bundles.map(async (bundle) => {
      const itemsResult = await db.query('SELECT * FROM bundle_items WHERE bundle_id = $1', [bundle.id]);
      return {
        id: bundle.bundle_key,
        db_id: bundle.id,
        type: bundle.type || 'beli',
        label: bundle.label,
        name: bundle.name,
        tag: bundle.tag,
        badge: bundle.badge,
        disc: bundle.discount_percentage,
        icon: bundle.icon,
        color: bundle.color,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          i: item.icon,
          n: item.item_name,
          d: item.item_desc,
          p: Number(item.price)
        }))
      };
    }));

    res.json(fullBundles);
  } catch (err) {
    console.error('Error get bundles:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data bundling' });
  }
});

router.post('/admin/bundles', async (req, res) => {
  const { bundle_key, label, name, tag, badge, discount_percentage, type, items } = req.body;
  
  try {
    await db.query('BEGIN');

    const bundleQuery = `
      INSERT INTO bundles (bundle_key, label, name, tag, badge, discount_percentage, type) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;
    `;
    const bundleRes = await db.query(bundleQuery, [
      bundle_key || 'paket-' + Date.now(), 
      label || 'PAKET HEMAT', 
      name, 
      tag, 
      badge, 
      discount_percentage || 0,
      type || 'beli' 
    ]);
    
    const bundleId = bundleRes.rows[0].id;

    if (items && items.length > 0) {
      for (let item of items) {
        await db.query(
          'INSERT INTO bundle_items (bundle_id, item_name, item_desc, price, icon) VALUES ($1, $2, $3, $4, $5)',
          [bundleId, item.name, item.desc || '', item.price || 0, item.icon || 'fa-check']
        );
      }
    }

    await db.query('COMMIT');
    res.status(201).json({ message: 'Paket bundling berhasil dibuat!' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error add bundle:', err.message);
    res.status(500).json({ error: 'Gagal membuat paket bundling' });
  }
});

router.delete('/admin/bundles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM bundles WHERE id = $1', [id]);
    res.json({ message: 'Paket bundling berhasil dihapus' });
  } catch (err) {
    console.error('Error delete bundle:', err.message);
    res.status(500).json({ error: 'Gagal menghapus paket bundling' });
  }
});


// --- 2. ENDPOINT GUIDE, JADWAL KALENDER & ULASAN ---
router.get('/guides', async (req, res) => {
  try {
    await ensureGuideTables();
    const result = await db.query('SELECT * FROM guides ORDER BY rating DESC, id ASC');
    const guides = result.rows;

    // Ambil semua ulasan guide
    const reviewsRes = await db.query('SELECT * FROM guide_reviews ORDER BY created_at DESC');
    const allReviews = reviewsRes.rows;

    // PENTING: Hanya ambil jadwal yang SUDAH DIBAYAR / AKTIF (bukan 'Menunggu Pembayaran' atau 'Dibatalkan')
    const schedulesRes = await db.query(`
      SELECT gs.id, gs.guide_id, gs.order_id, gs.customer_name, gs.destination,
             TO_CHAR(gs.start_date, 'YYYY-MM-DD') as start_date,
             TO_CHAR(gs.end_date, 'YYYY-MM-DD') as end_date,
             gs.note,
             COALESCE(o.status, gs.status) as status
      FROM guide_schedules gs
      LEFT JOIN orders o ON gs.order_id = o.id
      WHERE COALESCE(o.status, gs.status) NOT IN ('Menunggu Pembayaran', 'Dibatalkan', 'Reschedule/Ditolak')
      ORDER BY gs.start_date ASC
    `);
    const allSchedules = [...schedulesRes.rows];

    // Ambil juga dari order_items yang bertipe booking & SUDAH DIBAYAR (jika ada order lama yang belum masuk guide_schedules)
    const bookingOrdersRes = await db.query(`
      SELECT o.id as order_id, o.status, u.name as customer_name,
             COALESCE(oi.guide_id, oi.product_id) as guide_id, oi.item_name
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN users u ON o.customer_id = u.id
      WHERE o.order_type = 'booking'
        AND o.status NOT IN ('Menunggu Pembayaran', 'Dibatalkan', 'Reschedule/Ditolak')
    `);

    for (const row of bookingOrdersRes.rows) {
      if (!row.guide_id) continue;
      const alreadyExists = allSchedules.some(
        s => s.order_id && Number(s.order_id) === Number(row.order_id) && Number(s.guide_id) === Number(row.guide_id)
      );
      if (!alreadyExists) {
        const parsed = parseDateRangeFromItemName(row.item_name);
        if (parsed) {
          allSchedules.push({
            id: `ord-${row.order_id}`,
            guide_id: row.guide_id,
            order_id: row.order_id,
            customer_name: row.customer_name || 'Pelanggan',
            destination: 'Pendakian Gunung',
            start_date: parsed.start_date,
            end_date: parsed.end_date,
            note: `Order #ORD-${row.order_id}`,
            status: row.status || 'Diproses'
          });
        }
      }
    }

    const enrichedGuides = guides.map(g => {
      const gReviews = allReviews.filter(r => Number(r.guide_id) === Number(g.id));
      const gSchedules = allSchedules.filter(s => Number(s.guide_id) === Number(g.id));
      const avgRating = gReviews.length > 0
        ? (gReviews.reduce((sum, r) => sum + Number(r.rating), 0) / gReviews.length).toFixed(1)
        : Number(g.rating || 5.0).toFixed(1);

      return {
        ...g,
        rating: avgRating,
        review_count: gReviews.length,
        reviews: gReviews,
        working_days: Array.isArray(g.working_days) && g.working_days.length > 0 ? g.working_days : DEFAULT_WORKING_DAYS,
        schedules: gSchedules
      };
    });

    res.json(enrichedGuides);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal mengambil data guide' });
  }
});

router.post('/admin/guides', async (req, res) => {
  const { name, mountain_region, description, price_per_day, rating, total_trips, experience_years, skills, working_days, avatar_url } = req.body;
  try {
    await ensureGuideTables();

    const parsedSkills = Array.isArray(skills)
      ? skills.map(s => String(s).trim()).filter(Boolean)
      : typeof skills === 'string' && skills.trim() !== ''
        ? skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const parsedWorkingDays = Array.isArray(working_days) && working_days.length > 0
      ? working_days
      : DEFAULT_WORKING_DAYS;

    const query = `
      INSERT INTO guides (name, mountain_region, description, price_per_day, rating, total_trips, experience_years, verified, skills, working_days, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10) RETURNING *;
    `;
    const newGuide = await db.query(query, [
      name,
      mountain_region,
      description || '',
      Number(price_per_day) || 0,
      Number(rating) || 5.0,
      Number(total_trips) || 0,
      Number(experience_years) || 1,
      parsedSkills,
      parsedWorkingDays,
      avatar_url || ''
    ]);
    res.status(201).json({ message: 'Pemandu berhasil ditambahkan!', guide: newGuide.rows[0] });
  } catch (err) {
    console.error('Error add guide:', err.message);
    res.status(500).json({ error: 'Gagal menambahkan data pemandu: ' + err.message });
  }
});

router.put('/admin/guides/:id', async (req, res) => {
  const { id } = req.params;
  const { name, mountain_region, description, price_per_day, rating, total_trips, experience_years, skills, working_days, avatar_url } = req.body;
  try {
    await ensureGuideTables();

    const parsedSkills = Array.isArray(skills)
      ? skills.map(s => String(s).trim()).filter(Boolean)
      : typeof skills === 'string' && skills.trim() !== ''
        ? skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const parsedWorkingDays = Array.isArray(working_days) && working_days.length > 0
      ? working_days
      : DEFAULT_WORKING_DAYS;

    const query = `
      UPDATE guides
      SET name = $1, mountain_region = $2, description = $3, price_per_day = $4, rating = $5, total_trips = $6,
          experience_years = $7, skills = $8, working_days = $9, avatar_url = $10
      WHERE id = $11 RETURNING *;
    `;
    const updatedGuide = await db.query(query, [
      name,
      mountain_region,
      description || '',
      Number(price_per_day) || 0,
      Number(rating) || 5.0,
      Number(total_trips) || 0,
      Number(experience_years) || 1,
      parsedSkills,
      parsedWorkingDays,
      avatar_url || '',
      id
    ]);
    res.json({ message: 'Data pemandu berhasil diperbarui!', guide: updatedGuide.rows[0] });
  } catch (err) {
    console.error('Error update guide:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui data pemandu: ' + err.message });
  }
});

router.delete('/admin/guides/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM guides WHERE id = $1', [req.params.id]);
    res.json({ message: 'Pemandu berhasil dihapus' });
  } catch (err) {
    console.error('Error delete guide:', err.message);
    res.status(500).json({ error: 'Gagal menghapus pemandu' });
  }
});

// Endpoint Admin: Menambah jadwal booking / blokir tanggal manual ke kalender guide
router.post('/admin/guides/:id/schedules', async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date, destination, customer_name, note } = req.body;
  try {
    await ensureGuideTables();
    const result = await db.query(
      `INSERT INTO guide_schedules (guide_id, customer_name, destination, start_date, end_date, note, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Terjadwal') RETURNING *`,
      [id, customer_name || 'Jadwal Admin', destination || 'Pendakian', start_date, end_date || start_date, note || '']
    );
    res.status(201).json({ message: 'Jadwal berhasil ditambahkan ke kalender!', schedule: result.rows[0] });
  } catch (err) {
    console.error('Error add guide schedule:', err.message);
    res.status(500).json({ error: 'Gagal menambahkan jadwal pemandu' });
  }
});

router.delete('/admin/guides/schedules/:scheduleId', async (req, res) => {
  const { scheduleId } = req.params;
  try {
    await ensureGuideTables();
    await db.query('DELETE FROM guide_schedules WHERE id = $1', [scheduleId]);
    res.json({ message: 'Jadwal berhasil dihapus dari kalender' });
  } catch (err) {
    console.error('Error delete schedule:', err.message);
    res.status(500).json({ error: 'Gagal menghapus jadwal' });
  }
});

// Endpoint Pelanggan: Memberikan Rating & Ulasan kepada Guide yang sudah disewa & dibayar
router.post('/guides/:id/reviews', async (req, res) => {
  const { id } = req.params;
  const { order_id, customer_id, customer_name, rating, comment } = req.body;
  try {
    await ensureGuideTables();
    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));

    if (order_id) {
      // Pastikan pesanan benar-benar ada dan sudah dibayar (bukan Menunggu Pembayaran / Dibatalkan)
      const orderCheck = await db.query('SELECT id, customer_id, status FROM orders WHERE id = $1', [order_id]);
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Data pesanan tidak ditemukan.' });
      }
      const orderData = orderCheck.rows[0];
      if (orderData.status === 'Menunggu Pembayaran' || orderData.status === 'Dibatalkan' || orderData.status === 'Reschedule/Ditolak') {
        return res.status(400).json({ error: 'Ulasan hanya dapat diberikan setelah pembayaran pesanan berhasil.' });
      }

      // Cek apakah order_id ini sudah pernah memberikan ulasan untuk guide ini
      const existing = await db.query(
        'SELECT id FROM guide_reviews WHERE order_id = $1 AND guide_id = $2',
        [order_id, id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Anda sudah memberikan ulasan untuk pemandu pada pesanan ini.' });
      }
    }

    const insertRes = await db.query(
      `INSERT INTO guide_reviews (order_id, guide_id, customer_id, customer_name, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [order_id || null, id, customer_id || null, customer_name || 'Pendaki', numericRating, comment || '']
    );

    // Hitung ulang rata-rata rating pemandu dan perbarui tabel guides
    const avgRes = await db.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews FROM guide_reviews WHERE guide_id = $1',
      [id]
    );
    const newAvg = Number(avgRes.rows[0].avg_rating || numericRating).toFixed(2);
    await db.query(
      'UPDATE guides SET rating = $1, total_trips = GREATEST(COALESCE(total_trips, 0), $2) WHERE id = $3',
      [newAvg, Number(avgRes.rows[0].total_reviews || 1), id]
    );

    res.status(201).json({
      message: 'Terima kasih! Rating dan ulasan Anda berhasil disimpan.',
      review: insertRes.rows[0],
      new_rating: newAvg
    });
  } catch (err) {
    console.error('Error submit guide review:', err.message);
    res.status(500).json({ error: 'Gagal menyimpan ulasan: ' + err.message });
  }
});

router.post('/bookings', async (req, res) => {
  const { customer_id, guide_id, destination, start_date, total_days, include_porter, include_photo, total_price } = req.body;
  try {
    const query = `
      INSERT INTO guide_bookings (customer_id, guide_id, destination, start_date, total_days, include_porter, include_photo, total_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Menunggu Konfirmasi') RETURNING *;
    `;
    const newBooking = await db.query(query, [customer_id, guide_id, destination, start_date, total_days, include_porter, include_photo, total_price]);
    res.status(201).json({ message: 'Booking guide berhasil!', booking: newBooking.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal memproses booking guide' });
  }
});


router.post('/auth/register', async (req, res) => {
  const { name, email, password, phone, city, address, shoe_size, hiking_level } = req.body;
  try {
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'Email sudah terdaftar!' });

    const newUser = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, city, address, shoe_size, hiking_level, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'customer') RETURNING id, name, email, role, phone, city, hiking_level`,
      [name, email, password, phone || null, city || null, address || null, shoe_size || null, hiking_level || 'Pemula']
    );
    res.status(201).json({ message: 'Registrasi berhasil', user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal melakukan pendaftaran' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await db.query('SELECT id, name, email, role, phone, city, hiking_level FROM users WHERE email = $1 AND password_hash = $2', [email, password]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Email atau kata sandi salah!' });
    res.json({ message: 'Login berhasil', user: userResult.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal melakukan login' });
  }
});


router.post('/orders', async (req, res) => {
  const { customer_id, total_price, items, order_type } = req.body;
  try {
    await ensureGuideTables();
    const finalOrderType = order_type || (items.length > 0 && items[0].type === 'sewa' ? 'sewa' : 'beli');
    const hasMidtrans = Boolean(process.env.MIDTRANS_SERVER_KEY);
    const initialStatus = hasMidtrans ? 'Menunggu Pembayaran' : (finalOrderType === 'booking' ? 'Menunggu Konfirmasi Admin' : 'Diproses');

    // Validasi anti double-booking sebelum membuat pesanan guide
    for (let item of items) {
      const isGuideItem = item.type === 'booking' || finalOrderType === 'booking' || (typeof item.id === 'string' && item.id.startsWith('guide-'));
      if (isGuideItem) {
        let gId = item.guide_id ? Number(item.guide_id) : null;
        if (!gId && typeof item.id === 'string' && item.id.startsWith('guide-')) {
          const matchId = item.id.match(/^guide-(\d+)/);
          gId = matchId ? parseInt(matchId[1], 10) : null;
        }
        const parsedRange = (item.start_date && item.end_date)
          ? { start_date: item.start_date, end_date: item.end_date }
          : parseDateRangeFromItemName(item.name);

        if (gId && parsedRange) {
          const conflictRes = await db.query(
            `SELECT gs.id FROM guide_schedules gs
             LEFT JOIN orders o ON gs.order_id = o.id
             WHERE gs.guide_id = $1
               AND COALESCE(o.status, gs.status) NOT IN ('Menunggu Pembayaran', 'Dibatalkan', 'Reschedule/Ditolak')
               AND gs.start_date <= $3::date AND gs.end_date >= $2::date
             LIMIT 1`,
            [gId, parsedRange.start_date, parsedRange.end_date]
          );
          if (conflictRes.rows.length > 0) {
            return res.status(400).json({
              error: 'Maaf, pemandu ini sudah dibooking pada tanggal tersebut. Silakan pilih tanggal lain di kalender.'
            });
          }
        }
      }
    }

    const newOrder = await db.query(
      'INSERT INTO orders (customer_id, total_price, status, order_type) VALUES ($1, $2, $3, $4) RETURNING id',
      [customer_id, total_price, initialStatus, finalOrderType]
    );
    const orderId = newOrder.rows[0].id;

    const userRes = await db.query('SELECT name, email, phone FROM users WHERE id = $1', [customer_id]);
    const customer = userRes.rows[0] || {};

    for (let item of items) {
      const isGuideItem = item.type === 'booking' || finalOrderType === 'booking' || (typeof item.id === 'string' && item.id.startsWith('guide-'));
      let productId = null;
      let guideId = null;

      if (isGuideItem) {
        if (item.guide_id) {
          guideId = Number(item.guide_id);
        } else if (typeof item.id === 'string' && item.id.startsWith('guide-')) {
          const matchId = item.id.match(/^guide-(\d+)/);
          guideId = matchId ? parseInt(matchId[1], 10) : null;
        } else if (typeof item.id === 'number') {
          guideId = item.id;
        }
        // PENTING: productId dibiarkan NULL untuk item guide agar tidak melanggar Foreign Key ke tabel products!
        productId = null;
      } else if (typeof item.id === 'number') {
        productId = item.id;
      }

      // Hindari menyimpan string base64 raksasa di kolom item_image jika sudah ada relasi guide_id / product_id
      const safeItemImage = item.image_url && item.image_url.startsWith('data:image') && guideId
        ? ''
        : (item.image_url || '');

      await db.query(
        'INSERT INTO order_items (order_id, product_id, guide_id, quantity, price_at_time, item_name, item_image, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [orderId, productId, guideId, item.qty || 1, item.price, item.name, safeItemImage, item.type || finalOrderType || 'beli']
      );

      // Catat jadwal ke guide_schedules dengan status awal (jika 'Menunggu Pembayaran', belum memblokir kalender sampai dibayar!)
      if (isGuideItem && guideId) {
        const parsedRange = (item.start_date && item.end_date)
          ? { start_date: item.start_date, end_date: item.end_date }
          : parseDateRangeFromItemName(item.name);

        if (parsedRange) {
          await db.query(
            `INSERT INTO guide_schedules (guide_id, order_id, customer_name, destination, start_date, end_date, note, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              guideId,
              orderId,
              customer.name || 'Pelanggan',
              item.destination || 'Pendakian Gunung',
              parsedRange.start_date,
              parsedRange.end_date,
              `Order #ORD-${orderId}`,
              initialStatus
            ]
          );
        }
      }
    }

    let snapToken = null;
    let redirectUrl = null;

    if (hasMidtrans) {
      try {
        const parameter = {
          transaction_details: {
            order_id: `ORD-${orderId}-${Date.now()}`,
            gross_amount: Math.round(Number(total_price))
          },
          customer_details: {
            first_name: customer.name || 'Customer',
            email: customer.email || 'customer@example.com',
            phone: customer.phone || '08123456789'
          },
          item_details: items.map((item, idx) => ({
            id: String(item.id || idx).substring(0, 50),
            price: Math.round(Number(item.price)),
            quantity: Number(item.qty || 1),
            name: String(item.name || 'Item').substring(0, 50)
          }))
        };

        const transaction = await snap.createTransaction(parameter);
        snapToken = transaction.token;
        redirectUrl = transaction.redirect_url;
      } catch (midtransErr) {
        console.error('Midtrans transaction creation error:', midtransErr.message);
      }
    }

    res.status(201).json({ 
      message: 'Checkout berhasil', 
      order_id: orderId,
      snap_token: snapToken,
      redirect_url: redirectUrl
    });
  } catch (err) {
    console.error('Error create order:', err.message);
    res.status(500).json({ error: 'Gagal memproses pesanan: ' + err.message });
  }
});

// Endpoint untuk membayar ulang pesanan yang berstatus 'Menunggu Pembayaran'
router.post('/orders/:id/pay', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureGuideTables();
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    const order = orderRes.rows[0];

    // Cek apakah tanggal guide pada order ini sudah dibooking dan dibayar orang lain sementara order ini masih pending
    if (order.order_type === 'booking') {
      const mySchedules = await db.query('SELECT * FROM guide_schedules WHERE order_id = $1', [order.id]);
      for (const sch of mySchedules.rows) {
        const conflictRes = await db.query(
          `SELECT gs.id FROM guide_schedules gs
           LEFT JOIN orders o ON gs.order_id = o.id
           WHERE gs.guide_id = $1
             AND gs.order_id != $2
             AND COALESCE(o.status, gs.status) NOT IN ('Menunggu Pembayaran', 'Dibatalkan', 'Reschedule/Ditolak')
             AND gs.start_date <= $4::date AND gs.end_date >= $3::date
           LIMIT 1`,
          [sch.guide_id, order.id, sch.start_date, sch.end_date]
        );
        if (conflictRes.rows.length > 0) {
          return res.status(400).json({
            error: 'Maaf, jadwal pemandu pada tanggal tersebut sudah dibooking dan dibayar oleh pengguna lain.'
          });
        }
      }
    }

    const userRes = await db.query('SELECT name, email, phone FROM users WHERE id = $1', [order.customer_id]);
    const customer = userRes.rows[0] || {};

    const grossAmount = Math.round(Number(order.total_price));
    const parameter = {
      transaction_details: {
        order_id: `ORD-${order.id}-${Date.now()}`,
        gross_amount: grossAmount
      },
      customer_details: {
        first_name: customer.name || 'Customer',
        email: customer.email || 'customer@example.com',
        phone: customer.phone || '08123456789'
      },
      item_details: [
        {
          id: `ORD-${order.id}`,
          price: grossAmount,
          quantity: 1,
          name: `Pembayaran Pesanan #ORD-${order.id}`
        }
      ]
    };

    const transaction = await snap.createTransaction(parameter);
    res.json({ snap_token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (err) {
    console.error('Error generating pay token:', err.message);
    res.status(500).json({ error: 'Gagal memproses pembayaran: ' + err.message });
  }
});

router.get('/orders/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    await ensureGuideTables();
    const ordersResult = await db.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [userId]);
    const userReviewsRes = await db.query('SELECT * FROM guide_reviews WHERE customer_id = $1', [userId]);
    const userReviews = userReviewsRes.rows;

    const fullOrders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await db.query(`
        SELECT oi.product_id,
               COALESCE(oi.guide_id, CASE WHEN oi.item_type = 'booking' THEN oi.product_id ELSE NULL END) as guide_id,
               oi.quantity, oi.price_at_time, oi.item_type,
               COALESCE(oi.item_name, p.name, g.name) as name, 
               COALESCE(NULLIF(oi.item_image, ''), p.image_url, g.avatar_url) as image_url 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.id 
        LEFT JOIN guides g ON COALESCE(oi.guide_id, CASE WHEN oi.item_type = 'booking' THEN oi.product_id ELSE NULL END) = g.id
        WHERE oi.order_id = $1
      `, [order.id]);

      const itemsWithReview = itemsResult.rows.map(item => {
        const targetGuideId = item.guide_id || item.product_id;
        const existingReview = userReviews.find(
          r => Number(r.order_id) === Number(order.id) && Number(r.guide_id) === Number(targetGuideId)
        );
        return {
          ...item,
          guide_id: targetGuideId,
          review: existingReview || null
        };
      });

      return { ...order, items: itemsWithReview };
    }));
    res.json(fullOrders);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal mengambil riwayat pesanan' });
  }
});


router.post('/admin/products', async (req, res) => {
  const { name, category, description, price, rent_price_per_day, stock, image_url, is_rentable } = req.body;
  try {
    const query = `
      INSERT INTO products (name, category, description, price, rent_price_per_day, stock, image_url, is_rentable) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
    `;
    const newProduct = await db.query(query, [name, category, description, price, rent_price_per_day || 0, stock || 0, image_url, is_rentable || false]);
    res.status(201).json({ message: 'Produk ditambahkan', product: newProduct.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal menambah produk' });
  }
});

router.put('/admin/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, description, price, rent_price_per_day, stock, image_url, is_rentable } = req.body;
  try {
    const query = `
      UPDATE products SET name=$1, category=$2, description=$3, price=$4, rent_price_per_day=$5, stock=$6, image_url=$7, is_rentable=$8 
      WHERE id=$9 RETURNING *;
    `;
    const updatedProduct = await db.query(query, [name, category, description, price, rent_price_per_day || 0, stock || 0, image_url, is_rentable || false, id]);
    res.json({ message: 'Produk diperbarui', product: updatedProduct.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal memperbarui produk' });
  }
});

router.delete('/admin/products/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Produk berhasil dihapus' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal menghapus produk' });
  }
});

router.get('/orders/all', async (req, res) => {
  try {
    await ensureGuideTables();
    const query = `
      SELECT o.*, u.name as customer_name, u.email as customer_email 
      FROM orders o 
      LEFT JOIN users u ON o.customer_id = u.id 
      ORDER BY o.created_at DESC
    `;
    const ordersResult = await db.query(query);
    
    const fullOrders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await db.query(`
        SELECT oi.product_id, oi.guide_id, oi.quantity, oi.price_at_time, oi.item_type,
               COALESCE(oi.item_name, p.name, g.name) as name, 
               COALESCE(NULLIF(oi.item_image, ''), p.image_url, g.avatar_url) as image_url 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.id 
        LEFT JOIN guides g ON COALESCE(oi.guide_id, CASE WHEN oi.item_type = 'booking' THEN oi.product_id ELSE NULL END) = g.id
        WHERE oi.order_id = $1
      `, [order.id]);
      return { ...order, items: itemsResult.rows };
    }));

    res.json(fullOrders);
  } catch (err) {
    console.error('Error get all orders:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data pesanan' });
  }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    await ensureGuideTables();
    const { status, return_resi } = req.body;
    if (return_resi !== undefined) {
      await db.query('UPDATE orders SET status = $1, return_resi = $2 WHERE id = $3', [status, return_resi, req.params.id]);
    } else {
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    }

    // Sinkronkan status jadwal kalender guide jika order ini adalah booking guide
    if (status === 'Dibatalkan' || status === 'Reschedule/Ditolak') {
      await db.query("UPDATE guide_schedules SET status = 'Dibatalkan' WHERE order_id = $1", [req.params.id]);
    } else {
      await db.query('UPDATE guide_schedules SET status = $1 WHERE order_id = $2', [status, req.params.id]);
    }

    // Jika status Selesai pada order booking, tambah total_trips pada guide terkait
    if (status === 'Selesai') {
      const orderItems = await db.query(
        "SELECT COALESCE(oi.guide_id, oi.product_id) as guide_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.id = $1 AND o.order_type = 'booking'",
        [req.params.id]
      );
      for (const row of orderItems.rows) {
        if (row.guide_id) {
          await db.query('UPDATE guides SET total_trips = COALESCE(total_trips, 0) + 1 WHERE id = $1', [row.guide_id]);
        }
      }
    }

    res.json({ message: 'Status berhasil diperbarui' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal memperbarui status' });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    await ensureGuideTables();
    await db.query('DELETE FROM guide_schedules WHERE order_id = $1', [req.params.id]);
    await db.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Pesanan berhasil dihapus' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal menghapus pesanan' });
  }
});

router.get('/admin/stats', async (req, res) => {
  try {
    const usersRes = await db.query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
    const ordersRes = await db.query("SELECT COUNT(*) FROM orders");
    const revenueRes = await db.query("SELECT SUM(total_price) FROM orders WHERE status != 'Dibatalkan'");
    const guidesRes = await db.query("SELECT COUNT(*) FROM guides");
    res.json({
      totalUsers: parseInt(usersRes.rows[0].count) || 0,
      totalOrders: parseInt(ordersRes.rows[0].count) || 0,
      totalRevenue: parseInt(revenueRes.rows[0].sum) || 0,
      totalGuides: parseInt(guidesRes.rows[0].count) || 0
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal mengambil statistik bisnis' });
  }
});

module.exports = router;
