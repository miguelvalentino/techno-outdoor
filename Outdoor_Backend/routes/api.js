// routes/api.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const snap = require('../midtrans');

const DEFAULT_WORKING_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

let guideTablesInitialized = false;
const ensureGuideTables = async () => {
  if (guideTablesInitialized) return;
  try {
    // 1. Kolom tambahan tabel guides
    await db.query('ALTER TABLE guides ADD COLUMN IF NOT EXISTS description TEXT');
    await db.query("ALTER TABLE guides ADD COLUMN IF NOT EXISTS working_days TEXT[] DEFAULT ARRAY['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']");

    // 2. Kolom tambahan tabel order_items & orders (termasuk sistem Deposito & Barang Rusak per-unit)
    await db.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS id SERIAL');
    await db.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS guide_id INT');
    await db.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS original_price NUMERIC DEFAULT 0');
    await db.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS deposit_per_unit NUMERIC DEFAULT 0');
    await db.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS damaged_qty INT DEFAULT 0');

    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT false');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_returned BOOLEAN DEFAULT false');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_forfeited NUMERIC DEFAULT 0');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_refunded NUMERIC DEFAULT 0');
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(60) DEFAULT 'Tidak Ada'");
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS damage_note TEXT');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS late_days INT DEFAULT 0');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS late_fee NUMERIC DEFAULT 0');
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS penalty_bill NUMERIC DEFAULT 0');
    await db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS penalty_status VARCHAR(40) DEFAULT 'Tidak Ada'");

    // 3. Kolom stok sewa terpisah pada tabel products
    await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS rent_stock INT');
    await db.query('UPDATE products SET rent_stock = COALESCE(stock, 5) WHERE rent_stock IS NULL');
    await db.query('ALTER TABLE products ALTER COLUMN rent_stock SET DEFAULT 0');

    // 4. Kolom foto profil & jaminan identitas (NIK KTP + Rekening Bank) pada tabel users
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS nik VARCHAR(30)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50)');

    // 5. Tabel ulasan & jadwal kalender guide
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
    console.error('Error initializing tables:', err.message);
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

// Helper sinkronisasi stok jual (stock) & stok sewa (rent_stock) serta deposito secara idempotent
const syncOrderInventory = async (orderId, newStatus, inspectionPayload = null) => {
  const orderRes = await db.query(
    `SELECT id, order_type, status,
            COALESCE(stock_deducted, false) as stock_deducted,
            COALESCE(stock_returned, false) as stock_returned,
            COALESCE(deposit_amount, 0) as deposit_amount
     FROM orders WHERE id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) return;
  const order = orderRes.rows[0];

  const itemsRes = await db.query(
    `SELECT oi.id as order_item_id, oi.product_id, oi.quantity, oi.item_type,
            COALESCE(oi.original_price, p.price, 0) as original_price,
            COALESCE(oi.deposit_per_unit, 0) as deposit_per_unit,
            COALESCE(oi.damaged_qty, 0) as damaged_qty
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1 AND oi.product_id IS NOT NULL`,
    [orderId]
  );

  const isPaidActive = !['Menunggu Pembayaran', 'Dibatalkan', 'Reschedule/Ditolak'].includes(newStatus);
  const isCancelled = ['Dibatalkan', 'Reschedule/Ditolak'].includes(newStatus);
  const isRentalCompleted = order.order_type === 'sewa' && ['Dikembalikan', 'Selesai', 'Dikembalikan (Ada Kerusakan)', 'Dikembalikan (Terlambat)'].includes(newStatus);

  // KASUS A: Order baru saja dibayar -> Kurangi stok sesuai tipe item (beli -> stock, sewa -> rent_stock)
  if (isPaidActive && !order.stock_deducted) {
    for (const item of itemsRes.rows) {
      const qty = Number(item.quantity || 1);
      const isRent = item.item_type === 'sewa' || order.order_type === 'sewa';
      if (isRent) {
        await db.query(
          'UPDATE products SET rent_stock = GREATEST(0, COALESCE(rent_stock, 0) - $1) WHERE id = $2',
          [qty, item.product_id]
        );
      } else {
        await db.query(
          'UPDATE products SET stock = GREATEST(0, COALESCE(stock, 0) - $1) WHERE id = $2',
          [qty, item.product_id]
        );
      }
    }

    const nextDepositStatus = order.order_type === 'sewa' && Number(order.deposit_amount) > 0
      ? 'Ditahan'
      : 'Tidak Ada';

    await db.query(
      'UPDATE orders SET stock_deducted = true, stock_returned = false, deposit_status = CASE WHEN deposit_status = \'Belum Dibayar\' OR deposit_status = \'Tidak Ada\' THEN $2 ELSE deposit_status END WHERE id = $1',
      [orderId, nextDepositStatus]
    );
  }
  // KASUS B: Order yang sudah memotong stok dibatalkan -> Kembalikan stok penuh
  else if (isCancelled && order.stock_deducted && !order.stock_returned) {
    for (const item of itemsRes.rows) {
      const qty = Number(item.quantity || 1);
      const isRent = item.item_type === 'sewa' || order.order_type === 'sewa';
      if (isRent) {
        await db.query(
          'UPDATE products SET rent_stock = COALESCE(rent_stock, 0) + $1 WHERE id = $2',
          [qty, item.product_id]
        );
      } else {
        await db.query(
          'UPDATE products SET stock = COALESCE(stock, 0) + $1 WHERE id = $2',
          [qty, item.product_id]
        );
      }
    }
    await db.query(
      "UPDATE orders SET stock_deducted = false, stock_returned = true, deposit_status = 'Dibatalkan' WHERE id = $1",
      [orderId]
    );
  }
  // KASUS C: Penyewaan selesai / dikembalikan -> Hitung barang bagus vs barang rusak, denda keterlambatan (2%/hari dari harga asli), potongan deposito, & tagihan kekurangan (penalty_bill)
  else if (isRentalCompleted && order.stock_deducted && !order.stock_returned) {
    const damagedMap = (inspectionPayload && inspectionPayload.damagedMap) || {};
    const lateDays = Math.max(0, Number(inspectionPayload?.late_days || 0));
    const allDamagedDefault = newStatus === 'Dikembalikan (Ada Kerusakan)' && (!inspectionPayload || !inspectionPayload.damagedMap);

    let damageFineTotal = 0;
    let totalOriginalValue = 0;
    let totalDamagedUnits = 0;
    let totalRentedUnits = 0;

    for (const item of itemsRes.rows) {
      const qty = Number(item.quantity || 1);
      const origPrice = Number(item.original_price || 0);
      totalRentedUnits += qty;
      totalOriginalValue += origPrice * qty;

      let damagedQty = 0;
      const mapKey = item.order_item_id || item.product_id;
      if (damagedMap[mapKey] !== undefined) {
        damagedQty = Math.min(qty, Math.max(0, Number(damagedMap[mapKey]) || 0));
      } else if (damagedMap[item.product_id] !== undefined) {
        damagedQty = Math.min(qty, Math.max(0, Number(damagedMap[item.product_id]) || 0));
      } else if (allDamagedDefault) {
        damagedQty = qty;
      }

      const goodQty = Math.max(0, qty - damagedQty);
      totalDamagedUnits += damagedQty;

      await db.query(
        'UPDATE order_items SET damaged_qty = $1 WHERE order_id = $2 AND product_id = $3',
        [damagedQty, orderId, item.product_id]
      );

      if (goodQty > 0) {
        await db.query(
          'UPDATE products SET rent_stock = COALESCE(rent_stock, 0) + $1 WHERE id = $2',
          [goodQty, item.product_id]
        );
      }

      // Kompensasi barang rusak: jika ada deposit_per_unit maka ambil sebesar deposit_per_unit, namun jika deposito Rp 0 (karena sewa >= 5 hari), kompensasi kerusakan adalah 50% harga asli per unit rusak!
      const damageUnitPenalty = Number(item.deposit_per_unit || 0) > 0
        ? Number(item.deposit_per_unit)
        : Math.round(0.5 * origPrice);
      damageFineTotal += damagedQty * damageUnitPenalty;
    }

    // Denda Keterlambatan = 2% per hari keterlambatan dari Total Harga Asli Barang yang disewa
    const lateFeeTotal = Math.round(0.02 * totalOriginalValue * lateDays);
    const totalFines = Math.round(damageFineTotal + lateFeeTotal);

    const totalDeposit = Number(order.deposit_amount || 0);
    // Potong dari deposito terlebih dahulu
    const finalForfeited = Math.min(totalDeposit, totalFines);
    const finalRefunded = Math.max(0, totalDeposit - finalForfeited);
    // Jika total denda melebihi deposito (misal deposito Rp 0 karena sewa 5 hari, atau denda telat + rusak > deposito), sisanya menjadi Tagihan Denda (penalty_bill) yang wajib dibayar user!
    const penaltyBill = Math.max(0, totalFines - totalDeposit);
    const penaltyStatus = penaltyBill > 0 ? 'Belum Lunas' : 'Tidak Ada';

    let finalDepositStatus = 'Tidak Ada';
    if (totalDeposit > 0) {
      if (finalForfeited === 0) {
        finalDepositStatus = 'Dikembalikan 100%';
      } else if (finalRefunded === 0) {
        finalDepositStatus = penaltyBill > 0
          ? 'Hangus + Kurang Bayar Denda'
          : 'Hangus Total';
      } else {
        finalDepositStatus = 'Dikembalikan Sebagian';
      }
    } else if (penaltyBill > 0) {
      finalDepositStatus = 'Tagihan Denda Aktif';
    }

    let finalOrderStatus = newStatus;
    if (totalDamagedUnits > 0) {
      finalOrderStatus = 'Dikembalikan (Ada Kerusakan)';
    } else if (lateDays > 0) {
      finalOrderStatus = 'Dikembalikan (Terlambat)';
    }
    const damageNote = inspectionPayload?.damage_note !== undefined ? inspectionPayload.damage_note : null;

    await db.query(
      `UPDATE orders
       SET status = $1,
           stock_returned = true,
           deposit_forfeited = $2,
           deposit_refunded = $3,
           deposit_status = $4,
           damage_note = COALESCE($5, damage_note),
           late_days = $6,
           late_fee = $7,
           penalty_bill = $8,
           penalty_status = $9
       WHERE id = $10`,
      [
        finalOrderStatus,
        finalForfeited,
        finalRefunded,
        finalDepositStatus,
        damageNote,
        lateDays,
        lateFeeTotal,
        penaltyBill,
        penaltyStatus,
        orderId
      ]
    );
  }
};

// --- 0. PAYMENT CONFIG & WEBHOOK ---
router.get('/payment/client-key', (req, res) => {
  res.json({ clientKey: process.env.MIDTRANS_CLIENT_KEY || '' });
});

router.post('/payment/notification', async (req, res) => {
  try {
    await ensureGuideTables();
    const notification = req.body || {};
    const {
      order_id: orderIdRaw,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus
    } = notification;

    // Midtrans "Test notification URL" / ping bisa mengirim body kosong.
    if (!orderIdRaw || !statusCode || !grossAmount || !signatureKey) {
      return res.status(200).json({ status: 'OK' });
    }

    // Verifikasi signature Midtrans secara lokal (tanpa memanggil API status Midtrans).
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${orderIdRaw}${statusCode}${grossAmount}${process.env.MIDTRANS_SERVER_KEY || ''}`)
      .digest('hex');

    if (expectedSignature !== signatureKey) {
      console.warn('Midtrans notification signature tidak valid untuk order:', orderIdRaw);
      // Tetap 200 agar Midtrans tidak retry terus-menerus; notifikasi tidak diproses.
      return res.status(200).json({ status: 'OK' });
    }

    const orderId = String(orderIdRaw).split('-')[1] || null;

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

    if (orderId && /^\d+$/.test(orderId)) {
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);
      await db.query('UPDATE guide_schedules SET status = $1 WHERE order_id = $2', [newStatus, orderId]);
      await syncOrderInventory(orderId, newStatus);
    }

    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('Error handling midtrans notification:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    await ensureGuideTables();
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

router.put('/admin/bundles/:id', async (req, res) => {
  const { id } = req.params;
  const { bundle_key, label, name, tag, badge, discount_percentage, type, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Paket harus memiliki minimal satu item.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const bundleResult = await client.query(
      `UPDATE bundles
       SET bundle_key = $1, label = $2, name = $3, tag = $4, badge = $5,
           discount_percentage = $6, type = $7
       WHERE id = $8
       RETURNING id`,
      [
        bundle_key || 'paket-' + Date.now(),
        label || 'PAKET HEMAT',
        name,
        tag || '',
        badge || '',
        Number(discount_percentage) || 0,
        type || 'beli',
        id
      ]
    );

    if (bundleResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Paket bundling tidak ditemukan.' });
    }

    await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [id]);
    for (const item of items) {
      await client.query(
        'INSERT INTO bundle_items (bundle_id, item_name, item_desc, price, icon) VALUES ($1, $2, $3, $4, $5)',
        [id, item.name, item.desc || '', Number(item.price) || 0, item.icon || 'fa-check']
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Paket bundling berhasil diperbarui.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error update bundle:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui paket bundling.' });
  } finally {
    client.release();
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

    const reviewsRes = await db.query('SELECT * FROM guide_reviews ORDER BY created_at DESC');
    const allReviews = reviewsRes.rows;

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

router.post('/guides/:id/reviews', async (req, res) => {
  const { id } = req.params;
  const { order_id, customer_id, customer_name, rating, comment } = req.body;
  try {
    await ensureGuideTables();
    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));

    if (order_id) {
      const orderCheck = await db.query('SELECT id, customer_id, status FROM orders WHERE id = $1', [order_id]);
      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Data pesanan tidak ditemukan.' });
      }
      const orderData = orderCheck.rows[0];
      if (orderData.status === 'Menunggu Pembayaran' || orderData.status === 'Dibatalkan' || orderData.status === 'Reschedule/Ditolak') {
        return res.status(400).json({ error: 'Ulasan hanya dapat diberikan setelah pembayaran pesanan berhasil.' });
      }

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


// --- 3. AUTHENTICATION, EDIT PROFILE & DELETE ACCOUNT ---
router.post('/auth/register', async (req, res) => {
  const { name, email, password, phone, city, address, shoe_size, hiking_level, nik, bank_name, bank_account } = req.body;
  try {
    await ensureGuideTables();
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'Email sudah terdaftar!' });

    const newUser = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, city, address, shoe_size, hiking_level, nik, bank_name, bank_account, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'customer')
       RETURNING id, name, email, role, phone, city, address, shoe_size, hiking_level, nik, bank_name, bank_account, avatar_url`,
      [
        name,
        email,
        password,
        phone || null,
        city || null,
        address || null,
        shoe_size || null,
        hiking_level || 'Pemula',
        nik || null,
        bank_name || null,
        bank_account || null
      ]
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
    await ensureGuideTables();
    const userResult = await db.query(
      'SELECT id, name, email, role, phone, city, address, shoe_size, hiking_level, nik, bank_name, bank_account, avatar_url FROM users WHERE email = $1 AND password_hash = $2',
      [email, password]
    );
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Email atau kata sandi salah!' });
    res.json({ message: 'Login berhasil', user: userResult.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal melakukan login' });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, city, address, shoe_size, hiking_level, nik, bank_name, bank_account, avatar_url, new_password } = req.body;
  try {
    await ensureGuideTables();
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    const existing = userCheck.rows[0];

    if (email && email !== existing.email) {
      const emailTaken = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailTaken.rows.length > 0) {
        return res.status(400).json({ error: 'Email tersebut sudah digunakan oleh akun lain.' });
      }
    }

    const finalPassword = new_password && String(new_password).trim() !== ''
      ? String(new_password).trim()
      : existing.password_hash;

    const updated = await db.query(
      `UPDATE users
       SET name = $1, email = $2, phone = $3, city = $4, address = $5, shoe_size = $6,
           hiking_level = $7, nik = $8, bank_name = $9, bank_account = $10, avatar_url = $11, password_hash = $12
       WHERE id = $13
       RETURNING id, name, email, role, phone, city, address, shoe_size, hiking_level, nik, bank_name, bank_account, avatar_url`,
      [
        name || existing.name,
        email || existing.email,
        phone ?? existing.phone,
        city ?? existing.city,
        address ?? existing.address,
        shoe_size ?? existing.shoe_size,
        hiking_level || existing.hiking_level || 'Pemula',
        nik !== undefined ? nik : existing.nik,
        bank_name !== undefined ? bank_name : existing.bank_name,
        bank_account !== undefined ? bank_account : existing.bank_account,
        avatar_url !== undefined ? avatar_url : existing.avatar_url,
        finalPassword,
        id
      ]
    );

    res.json({ message: 'Profil berhasil diperbarui!', user: updated.rows[0] });
  } catch (err) {
    console.error('Error update user profile:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui profil: ' + err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureGuideTables();
    const userRes = await db.query('SELECT id, name, role FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const targetUser = userRes.rows[0];

    if (targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Akun Administrator tidak dapat dihapus.' });
    }

    const activeOrderCheck = await db.query(
      `SELECT id, order_type, status, COALESCE(penalty_bill, 0) as penalty_bill, penalty_status FROM orders
       WHERE customer_id = $1
         AND (
           status IN ('Diproses', 'Dikirim', 'Sedang Disewa', 'Dalam Pengiriman Kembali', 'Menunggu Konfirmasi Admin', 'Guide Terkonfirmasi', 'Sedang Mendaki')
           OR (COALESCE(penalty_bill, 0) > 0 AND penalty_status = 'Belum Lunas')
         )
       LIMIT 1`,
      [id]
    );

    if (activeOrderCheck.rows.length > 0) {
      const activeOrd = activeOrderCheck.rows[0];
      if (Number(activeOrd.penalty_bill) > 0 && activeOrd.penalty_status === 'Belum Lunas') {
        return res.status(400).json({
          error: `Tidak dapat menghapus akun karena Anda masih memiliki Tagihan Denda Keterlambatan/Kerusakan yang belum dilunasi pada pesanan #ORD-${activeOrd.id} sebesar Rp ${Number(activeOrd.penalty_bill).toLocaleString('id-ID')}.`
        });
      }
      return res.status(400).json({
        error: `Tidak dapat menghapus akun karena Anda masih memiliki transaksi aktif (#ORD-${activeOrd.id} - Status: ${activeOrd.status}). Selesaikan atau batalkan pesanan terlebih dahulu.`
      });
    }

    const userOrders = await db.query('SELECT id, status FROM orders WHERE customer_id = $1', [id]);
    for (const ord of userOrders.rows) {
      if (ord.status === 'Menunggu Pembayaran') {
        await db.query('DELETE FROM guide_schedules WHERE order_id = $1', [ord.id]);
        await db.query('DELETE FROM order_items WHERE order_id = $1', [ord.id]);
        await db.query('DELETE FROM orders WHERE id = $1', [ord.id]);
      } else {
        await db.query('UPDATE orders SET customer_id = NULL WHERE id = $1', [ord.id]);
      }
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Akun Anda berhasil dihapus secara permanen.' });
  } catch (err) {
    console.error('Error delete account:', err.message);
    res.status(500).json({ error: 'Gagal menghapus akun: ' + err.message });
  }
});


// --- 4. ORDERS, PEMBAYARAN, DEPOSITO 50% & STOK TERPISAH ---
router.post('/orders', async (req, res) => {
  const { customer_id, total_price, items, order_type } = req.body;
  try {
    await ensureGuideTables();
    const finalOrderType = order_type || (items.length > 0 && items[0].type === 'sewa' ? 'sewa' : 'beli');
    const hasMidtrans = Boolean(process.env.MIDTRANS_SERVER_KEY);
    const initialStatus = hasMidtrans ? 'Menunggu Pembayaran' : (finalOrderType === 'booking' ? 'Menunggu Konfirmasi Admin' : 'Diproses');

    // Safeguard 1: Blokir pembuatan pesanan baru jika user masih memiliki Tagihan Denda Keterlambatan/Kerusakan yang Belum Lunas!
    if (customer_id) {
      const unpaidPenaltyRes = await db.query(
        "SELECT id, penalty_bill FROM orders WHERE customer_id = $1 AND COALESCE(penalty_bill, 0) > 0 AND penalty_status = 'Belum Lunas' LIMIT 1",
        [customer_id]
      );
      if (unpaidPenaltyRes.rows.length > 0) {
        const pOrd = unpaidPenaltyRes.rows[0];
        return res.status(400).json({
          error: `Akun Anda memiliki Tagihan Denda Keterlambatan/Kerusakan yang belum dilunasi pada pesanan #ORD-${pOrd.id} sebesar Rp ${Number(pOrd.penalty_bill).toLocaleString('id-ID')}. Silakan lunasi terlebih dahulu di menu Profil.`
        });
      }
    }

    // Prepared items & perhitungan Deposito Sewa 50% dari harga asli barang
    let calculatedBaseSubtotal = 0;
    let calculatedTotalDeposit = 0;
    const enrichedItems = [];

    for (let item of items) {
      const qty = Math.max(1, Number(item.qty || 1));
      const unitPrice = Number(item.price || 0);
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

        calculatedBaseSubtotal += unitPrice * qty;
        enrichedItems.push({
          ...item,
          qty,
          productId: null,
          guideId: gId,
          originalPrice: unitPrice,
          depositPerUnit: 0
        });
      } else if (typeof item.id === 'number') {
        const prodRes = await db.query('SELECT id, name, price, stock, rent_stock FROM products WHERE id = $1', [item.id]);
        if (prodRes.rows.length === 0) {
          return res.status(404).json({ error: `Produk "${item.name}" tidak ditemukan di database.` });
        }
        const prod = prodRes.rows[0];
        const isRent = item.type === 'sewa' || finalOrderType === 'sewa';
        const availStock = isRent ? Number(prod.rent_stock ?? 0) : Number(prod.stock ?? 0);

        if (qty > availStock) {
          return res.status(400).json({
            error: `Maaf, stok ${isRent ? 'sewa' : 'beli'} untuk "${prod.name}" tidak mencukupi (Tersisa: ${availStock} unit).`
          });
        }

        const originalPrice = Number(prod.price || item.original_price || 0);
        // Rumus Deposito: Toko wajib memegang minimal 50% dari harga asli barang per unit
        const depositPerUnit = isRent
          ? Math.max(0, Math.round(0.5 * originalPrice - unitPrice))
          : 0;

        calculatedBaseSubtotal += unitPrice * qty;
        calculatedTotalDeposit += depositPerUnit * qty;

        enrichedItems.push({
          ...item,
          qty,
          productId: prod.id,
          guideId: null,
          originalPrice,
          depositPerUnit
        });
      } else {
        // Bundling item (id berupa string 'bundle-...')
        const isRent = item.type === 'sewa' || finalOrderType === 'sewa';
        const originalPrice = Number(item.original_price || 0);
        const depositPerUnit = isRent && originalPrice > 0
          ? Math.max(0, Math.round(0.5 * originalPrice - unitPrice))
          : 0;

        calculatedBaseSubtotal += unitPrice * qty;
        calculatedTotalDeposit += depositPerUnit * qty;

        enrichedItems.push({
          ...item,
          qty,
          productId: null,
          guideId: null,
          originalPrice,
          depositPerUnit
        });
      }
    }

    const finalGrandTotal = Math.round(calculatedBaseSubtotal + calculatedTotalDeposit) || Math.round(Number(total_price || 0));
    const initialDepositStatus = finalOrderType === 'sewa' && calculatedTotalDeposit > 0
      ? (hasMidtrans ? 'Belum Dibayar' : 'Ditahan')
      : 'Tidak Ada';

    const newOrder = await db.query(
      `INSERT INTO orders (customer_id, total_price, deposit_amount, deposit_forfeited, deposit_refunded, deposit_status, status, order_type, stock_deducted, stock_returned)
       VALUES ($1, $2, $3, 0, 0, $4, $5, $6, false, false) RETURNING id`,
      [customer_id, finalGrandTotal, calculatedTotalDeposit, initialDepositStatus, initialStatus, finalOrderType]
    );
    const orderId = newOrder.rows[0].id;

    const userRes = await db.query('SELECT name, email, phone FROM users WHERE id = $1', [customer_id]);
    const customer = userRes.rows[0] || {};

    for (let item of enrichedItems) {
      const safeItemImage = item.image_url && item.image_url.startsWith('data:image') && item.guideId
        ? ''
        : (item.image_url || '');

      await db.query(
        `INSERT INTO order_items (order_id, product_id, guide_id, quantity, price_at_time, original_price, deposit_per_unit, damaged_qty, item_name, item_image, item_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)`,
        [
          orderId,
          item.productId,
          item.guideId,
          item.qty,
          item.price,
          item.originalPrice,
          item.depositPerUnit,
          item.name,
          safeItemImage,
          item.type || finalOrderType || 'beli'
        ]
      );

      if (item.guideId) {
        const parsedRange = (item.start_date && item.end_date)
          ? { start_date: item.start_date, end_date: item.end_date }
          : parseDateRangeFromItemName(item.name);

        if (parsedRange) {
          await db.query(
            `INSERT INTO guide_schedules (guide_id, order_id, customer_name, destination, start_date, end_date, note, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              item.guideId,
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

    if (!hasMidtrans) {
      await syncOrderInventory(orderId, initialStatus);
    }

    let snapToken = null;
    let redirectUrl = null;

    if (hasMidtrans) {
      try {
        const midtransItems = enrichedItems.map((item, idx) => ({
          id: String(item.id || idx).substring(0, 50),
          price: Math.round(Number(item.price)),
          quantity: Number(item.qty || 1),
          name: String(item.name || 'Item').substring(0, 50)
        }));

        // Tambahkan baris Deposito Jaminan ke Midtrans jika ada deposito sewa
        if (calculatedTotalDeposit > 0) {
          midtransItems.push({
            id: `DEPOSIT-${orderId}`,
            price: Math.round(calculatedTotalDeposit),
            quantity: 1,
            name: 'Deposito Jaminan Sewa (50% Nilai Barang)'
          });
        }

        const parameter = {
          transaction_details: {
            order_id: `ORD-${orderId}-${Date.now()}`,
            gross_amount: finalGrandTotal
          },
          customer_details: {
            first_name: customer.name || 'Customer',
            email: customer.email || 'customer@example.com',
            phone: customer.phone || '08123456789'
          },
          item_details: midtransItems
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
    } else {
      const orderItems = await db.query(
        'SELECT oi.product_id, oi.quantity, oi.item_type, p.name, p.stock, p.rent_stock FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1',
        [order.id]
      );
      for (const item of orderItems.rows) {
        const isRent = item.item_type === 'sewa' || order.order_type === 'sewa';
        const avail = isRent ? Number(item.rent_stock ?? 0) : Number(item.stock ?? 0);
        if (Number(item.quantity || 1) > avail) {
          return res.status(400).json({
            error: `Maaf, stok ${isRent ? 'sewa' : 'beli'} untuk "${item.name}" saat ini sudah habis atau tidak mencukupi (Tersisa: ${avail} unit).`
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
        SELECT oi.id as order_item_id,
               oi.product_id,
               COALESCE(oi.guide_id, CASE WHEN oi.item_type = 'booking' THEN oi.product_id ELSE NULL END) as guide_id,
               oi.quantity, oi.price_at_time,
               COALESCE(oi.original_price, p.price, 0) as original_price,
               COALESCE(oi.deposit_per_unit, 0) as deposit_per_unit,
               COALESCE(oi.damaged_qty, 0) as damaged_qty,
               oi.item_type,
               COALESCE(oi.item_name, p.name, g.name) as name, 
               COALESCE(NULLIF(oi.item_image, ''), p.image_url, g.avatar_url) as image_url 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.id 
        LEFT JOIN guides g ON COALESCE(oi.guide_id, CASE WHEN oi.item_type = 'booking' THEN oi.product_id ELSE NULL END) = g.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC
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
  const { name, category, description, price, rent_price_per_day, stock, rent_stock, image_url, is_rentable } = req.body;
  try {
    await ensureGuideTables();
    const query = `
      INSERT INTO products (name, category, description, price, rent_price_per_day, stock, rent_stock, image_url, is_rentable) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
    `;
    const newProduct = await db.query(query, [
      name,
      category,
      description,
      Number(price) || 0,
      Number(rent_price_per_day) || 0,
      Number(stock) || 0,
      Number(rent_stock) || 0,
      image_url,
      Boolean(is_rentable)
    ]);
    res.status(201).json({ message: 'Produk ditambahkan', product: newProduct.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal menambah produk' });
  }
});

router.put('/admin/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, description, price, rent_price_per_day, stock, rent_stock, image_url, is_rentable } = req.body;
  try {
    await ensureGuideTables();
    const query = `
      UPDATE products
      SET name=$1, category=$2, description=$3, price=$4, rent_price_per_day=$5,
          stock=$6, rent_stock=$7, image_url=$8, is_rentable=$9 
      WHERE id=$10 RETURNING *;
    `;
    const updatedProduct = await db.query(query, [
      name,
      category,
      description,
      Number(price) || 0,
      Number(rent_price_per_day) || 0,
      Number(stock) || 0,
      Number(rent_stock) || 0,
      image_url,
      Boolean(is_rentable),
      id
    ]);
    res.json({ message: 'Produk diperbarui', product: updatedProduct.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal memperbarui produk' });
  }
});

router.patch('/admin/products/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { stock, rent_stock } = req.body;
  try {
    await ensureGuideTables();
    const currentRes = await db.query('SELECT stock, rent_stock FROM products WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    const cur = currentRes.rows[0];
    const nextStock = stock !== undefined ? Math.max(0, Number(stock)) : Number(cur.stock || 0);
    const nextRentStock = rent_stock !== undefined ? Math.max(0, Number(rent_stock)) : Number(cur.rent_stock || 0);

    const updated = await db.query(
      'UPDATE products SET stock = $1, rent_stock = $2 WHERE id = $3 RETURNING *',
      [nextStock, nextRentStock, id]
    );
    res.json({ message: 'Stok berhasil diperbarui', product: updated.rows[0] });
  } catch (err) {
    console.error('Error quick update stock:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui stok' });
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
      SELECT o.*,
             u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             u.nik as customer_nik, u.bank_name as customer_bank_name, u.bank_account as customer_bank_account
      FROM orders o 
      LEFT JOIN users u ON o.customer_id = u.id 
      ORDER BY o.created_at DESC
    `;
    const ordersResult = await db.query(query);
    
    const fullOrders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await db.query(`
        SELECT oi.id as order_item_id,
               oi.product_id, oi.guide_id, oi.quantity, oi.price_at_time,
               COALESCE(oi.original_price, p.price, 0) as original_price,
               COALESCE(oi.deposit_per_unit, 0) as deposit_per_unit,
               COALESCE(oi.damaged_qty, 0) as damaged_qty,
               oi.item_type,
               COALESCE(oi.item_name, p.name, g.name) as name, 
               COALESCE(NULLIF(oi.item_image, ''), p.image_url, g.avatar_url) as image_url 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.id 
        LEFT JOIN guides g ON COALESCE(oi.guide_id, CASE WHEN oi.item_type = 'booking' THEN oi.product_id ELSE NULL END) = g.id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC
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
    const { status, return_resi, damaged_items, damage_note } = req.body;
    if (return_resi !== undefined) {
      await db.query('UPDATE orders SET status = $1, return_resi = $2 WHERE id = $3', [status, return_resi, req.params.id]);
    } else {
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    }

    // Sinkronkan pengurangan / pengembalian stok produk (beli & sewa) serta perhitungan deposito per unit
    await syncOrderInventory(req.params.id, status, {
      damagedMap: damaged_items,
      damage_note
    });

    // Sinkronkan status jadwal kalender guide jika order ini adalah booking guide
    if (status === 'Dibatalkan' || status === 'Reschedule/Ditolak') {
      await db.query("UPDATE guide_schedules SET status = 'Dibatalkan' WHERE order_id = $1", [req.params.id]);
    } else {
      await db.query('UPDATE guide_schedules SET status = $1 WHERE order_id = $2', [status, req.params.id]);
    }

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

// Endpoint khusus Admin: Inspeksi Pengembalian Barang Sewa (per-unit bagus vs rusak), Denda Keterlambatan (2%/hari dari harga asli), & penyelesaian Deposito
router.post('/orders/:id/inspect-return', async (req, res) => {
  const { id } = req.params;
  const { damaged_items, damage_note, late_days } = req.body;
  try {
    await ensureGuideTables();
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }

    await syncOrderInventory(id, 'Dikembalikan', {
      damagedMap: damaged_items || {},
      damage_note: damage_note || '',
      late_days: Number(late_days || 0)
    });

    const updatedOrder = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    res.json({
      message: 'Inspeksi pengembalian barang sewa, keterlambatan, dan perhitungan deposito berhasil disimpan!',
      order: updatedOrder.rows[0]
    });
  } catch (err) {
    console.error('Error inspect return:', err.message);
    res.status(500).json({ error: 'Gagal memproses inspeksi pengembalian: ' + err.message });
  }
});

// Endpoint Pelanggan: Membayar Tagihan Denda Kekurangan (penalty_bill) via Midtrans Snap
router.post('/orders/:id/pay-penalty', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureGuideTables();
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    }
    const order = orderRes.rows[0];
    const penaltyAmount = Math.round(Number(order.penalty_bill || 0));

    if (penaltyAmount <= 0 || order.penalty_status === 'Lunas') {
      return res.status(400).json({ error: 'Tidak ada tagihan denda yang perlu dibayar pada pesanan ini.' });
    }

    const hasMidtrans = Boolean(process.env.MIDTRANS_SERVER_KEY);
    if (!hasMidtrans) {
      await db.query("UPDATE orders SET penalty_status = 'Lunas' WHERE id = $1", [id]);
      return res.json({ paid_directly: true, message: 'Tagihan denda berhasil dilunasi!' });
    }

    const userRes = await db.query('SELECT name, email, phone FROM users WHERE id = $1', [order.customer_id]);
    const customer = userRes.rows[0] || {};

    const parameter = {
      transaction_details: {
        order_id: `PEN-${order.id}-${Date.now()}`,
        gross_amount: penaltyAmount
      },
      customer_details: {
        first_name: customer.name || 'Customer',
        email: customer.email || 'customer@example.com',
        phone: customer.phone || '08123456789'
      },
      item_details: [
        {
          id: `PENALTY-${order.id}`,
          price: penaltyAmount,
          quantity: 1,
          name: `Tagihan Denda Sewa #ORD-${order.id}`.substring(0, 50)
        }
      ]
    };

    const transaction = await snap.createTransaction(parameter);
    res.json({ snap_token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (err) {
    console.error('Error pay penalty:', err.message);
    res.status(500).json({ error: 'Gagal membuat pembayaran denda: ' + err.message });
  }
});

// Endpoint Konfirmasi Pelunasan Tagihan Denda (Oleh Sistem Midtrans onSuccess maupun Manual oleh Admin)
router.put('/orders/:id/penalty-paid', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureGuideTables();
    await db.query(
      `UPDATE orders
       SET penalty_status = 'Lunas',
           deposit_status = CASE WHEN deposit_status = 'Tagihan Denda Aktif' THEN 'Denda Lunas' ELSE deposit_status END
       WHERE id = $1`,
      [id]
    );
    res.json({ message: 'Tagihan denda telah ditandai LUNAS!' });
  } catch (err) {
    console.error('Error mark penalty paid:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui status denda.' });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    await ensureGuideTables();
    await db.query('DELETE FROM guide_schedules WHERE order_id = $1', [req.params.id]);
    await db.query('DELETE FROM order_items WHERE order_id = $1', [req.params.id]);
    await db.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Pesanan berhasil dihapus' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal menghapus pesanan' });
  }
});

router.get('/admin/stats', async (req, res) => {
  try {
    await ensureGuideTables();
    const usersRes = await db.query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
    const ordersRes = await db.query("SELECT COUNT(*) FROM orders");
    // Pendapatan Bersih Toko = Harga sewa/beli murni (total_price - deposit_amount) DITAMBAH deposito yang hangus (deposit_forfeited) DITAMBAH tagihan denda tambahan yang sudah lunas (penalty_bill)
    const revenueRes = await db.query(`
      SELECT SUM(
        (COALESCE(total_price, 0) - COALESCE(deposit_amount, 0))
        + COALESCE(deposit_forfeited, 0)
        + CASE WHEN penalty_status = 'Lunas' THEN COALESCE(penalty_bill, 0) ELSE 0 END
      ) as sum
      FROM orders
      WHERE status NOT IN ('Dibatalkan', 'Menunggu Pembayaran', 'Reschedule/Ditolak')
    `);
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
