// routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../db');

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


// --- 2. ENDPOINT GUIDE & BOOKING ---
router.get('/guides', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM guides ORDER BY rating DESC, id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal mengambil data guide' });
  }
});

router.post('/admin/guides', async (req, res) => {
  const { name, mountain_region, description, price_per_day, rating, total_trips, experience_years, verified, skills, avatar_url } = req.body;
  try {
    await db.query('ALTER TABLE guides ADD COLUMN IF NOT EXISTS description TEXT');

    const parsedSkills = Array.isArray(skills)
      ? skills.map(s => String(s).trim()).filter(Boolean)
      : typeof skills === 'string' && skills.trim() !== ''
        ? skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const query = `
      INSERT INTO guides (name, mountain_region, description, price_per_day, rating, total_trips, experience_years, verified, skills, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
    `;
    const newGuide = await db.query(query, [
      name,
      mountain_region,
      description || '',
      Number(price_per_day) || 0,
      Number(rating) || 5.0,
      Number(total_trips) || 0,
      Number(experience_years) || 1,
      verified !== undefined ? Boolean(verified) : true,
      parsedSkills,
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
  const { name, mountain_region, description, price_per_day, rating, total_trips, experience_years, verified, skills, avatar_url } = req.body;
  try {
    await db.query('ALTER TABLE guides ADD COLUMN IF NOT EXISTS description TEXT');

    const parsedSkills = Array.isArray(skills)
      ? skills.map(s => String(s).trim()).filter(Boolean)
      : typeof skills === 'string' && skills.trim() !== ''
        ? skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const query = `
      UPDATE guides
      SET name = $1, mountain_region = $2, description = $3, price_per_day = $4, rating = $5, total_trips = $6,
          experience_years = $7, verified = $8, skills = $9, avatar_url = $10
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
      verified !== undefined ? Boolean(verified) : true,
      parsedSkills,
      avatar_url || '',
      id
    ]);
    res.json({ message: 'Data pemandu berhasil diperbarui!', guide: updatedGuide.rows[0] });
  } catch (err) {
    console.error('Error update guide:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui data pemandu: ' + err.message });
  }
});

router.patch('/admin/guides/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;
  try {
    const updated = await db.query(
      'UPDATE guides SET verified = $1 WHERE id = $2 RETURNING *',
      [Boolean(verified), id]
    );
    res.json({ message: 'Status verifikasi diperbarui', guide: updated.rows[0] });
  } catch (err) {
    console.error('Error verify guide:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui status verifikasi' });
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
    const finalOrderType = order_type || (items.length > 0 && items[0].type === 'sewa' ? 'sewa' : 'beli');
    const initialStatus = finalOrderType === 'booking' ? 'Menunggu Konfirmasi Admin' : 'Diproses';

    const newOrder = await db.query(
      'INSERT INTO orders (customer_id, total_price, status, order_type) VALUES ($1, $2, $3, $4) RETURNING id',
      [customer_id, total_price, initialStatus, finalOrderType]
    );
    const orderId = newOrder.rows[0].id;

    for (let item of items) {
      const productId = typeof item.id === 'string' ? parseInt(item.id.replace('guide-', '')) || null : item.id;
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_time, item_name, item_image, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [orderId, productId, item.qty, item.price, item.name, item.image_url || '', item.type || 'beli']
      );
    }
    res.status(201).json({ message: 'Checkout berhasil', order_id: orderId });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal memproses pesanan' });
  }
});

router.get('/orders/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const ordersResult = await db.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [userId]);
    const fullOrders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await db.query(`
        SELECT oi.quantity, oi.price_at_time, 
               COALESCE(oi.item_name, p.name) as name, 
               COALESCE(oi.item_image, p.image_url) as image_url 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [order.id]);
      return { ...order, items: itemsResult.rows };
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
    const query = `
      SELECT o.*, u.name as customer_name, u.email as customer_email 
      FROM orders o 
      LEFT JOIN users u ON o.customer_id = u.id 
      ORDER BY o.created_at DESC
    `;
    const ordersResult = await db.query(query);
    
    const fullOrders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await db.query(`
        SELECT oi.quantity, oi.price_at_time, oi.item_type,
               COALESCE(oi.item_name, p.name) as name, 
               COALESCE(oi.item_image, p.image_url) as image_url 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.id 
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
    const { status, return_resi } = req.body;
    if (return_resi !== undefined) {
      await db.query('UPDATE orders SET status = $1, return_resi = $2 WHERE id = $3', [status, return_resi, req.params.id]);
    } else {
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    }
    res.json({ message: 'Status berhasil diperbarui' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Gagal memperbarui status' });
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
