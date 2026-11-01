// src/pages/AdminPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminOrders } from '../components/AdminOrders';

export const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('pesanan');
  const [stats, setStats] = useState({ totalUsers: 0, totalOrders: 0, totalRevenue: 0 });

  // --- STATE PRODUK ---
  const [products, setProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '', category: 'TENDA', price: '', stock: '', image_url: '', description: '', is_rentable: false, rent_price_per_day: ''
  });

  // --- STATE BUNDLING (Ditambah properti type) ---
  const [bundles, setBundles] = useState([]);
  const [bundleForm, setBundleForm] = useState({
    bundle_key: '',
    label: 'PAKET HEMAT',
    name: '',
    tag: '',
    badge: 'Hemat 20%',
    discount_percentage: 20,
    type: 'beli' // Pilihan: 'beli' atau 'sewa'
  });
  
  const [bundleItems, setBundleItems] = useState([
    { name: '', desc: '', price: '', icon: 'fa-tent' },
    { name: '', desc: '', price: '', icon: 'fa-backpack' }
  ]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchData = () => {
    fetch('http://localhost:5000/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error(err));
      
    fetch('http://localhost:5000/api/admin/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Gagal memuat statistik:', err));

    fetch('http://localhost:5000/api/bundles')
      .then(res => res.json())
      .then(data => setBundles(data))
      .catch(err => console.error('Gagal memuat bundling:', err));
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchData();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = isEditing ? `http://localhost:5000/api/admin/products/${editId}` : 'http://localhost:5000/api/admin/products';
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      if (response.ok) {
        alert(isEditing ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!');
        handleReset(); 
        fetchData(); 
      } else {
        alert('Proses gagal, periksa kembali data Anda.');
      }
    } catch (err) { console.error(err); }
  };

  const handleEditClick = (product) => {
    setIsEditing(true);
    setEditId(product.id);
    setForm({
      name: product.name, category: product.category, price: product.price, stock: product.stock, 
      image_url: product.image_url || '', description: product.description || '', 
      is_rentable: product.is_rentable || false, rent_price_per_day: product.rent_price_per_day || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setIsEditing(false);
    setEditId(null);
    setForm({ name: '', category: 'TENDA', price: '', stock: '', image_url: '', description: '', is_rentable: false, rent_price_per_day: '' });
  };

  const handleDelete = async (id) => {
    if (confirm('Yakin ingin menghapus produk ini?')) {
      await fetch(`http://localhost:5000/api/admin/products/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleAddItemRow = () => {
    setBundleItems([...bundleItems, { name: '', desc: '', price: '', icon: 'fa-check' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...bundleItems];
    newItems[index][field] = value;
    setBundleItems(newItems);
  };

  const handleRemoveItemRow = (index) => {
    if (bundleItems.length <= 1) return alert('Paket minimal harus memiliki 1 item.');
    setBundleItems(bundleItems.filter((_, i) => i !== index));
  };

  const handleBundleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...bundleForm,
        bundle_key: bundleForm.name.toLowerCase().replace(/\s+/g, '-'),
        items: bundleItems
      };

      const response = await fetch('http://localhost:5000/api/admin/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Paket Bundling berhasil dibuat!');
        setBundleForm({ bundle_key: '', label: 'PAKET HEMAT', name: '', tag: '', badge: 'Hemat 20%', discount_percentage: 20, type: 'beli' });
        setBundleItems([
          { name: '', desc: '', price: '', icon: 'fa-tent' },
          { name: '', desc: '', price: '', icon: 'fa-backpack' }
        ]);
        fetchData();
      } else {
        alert('Gagal membuat paket bundling.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBundle = async (id) => {
    if (confirm('Yakin ingin menghapus paket bundling ini?')) {
      await fetch(`http://localhost:5000/api/admin/bundles/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 flex-grow w-full fade-in">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
        <i className="fa-solid fa-lock text-brand-600 mr-3"></i> Admin Dashboard
      </h1>

      {/* DASHBOARD ANALYTICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-brand-50 opacity-50 text-8xl pointer-events-none"><i className="fa-solid fa-wallet"></i></div>
          <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-2xl flex-shrink-0 z-10"><i className="fa-solid fa-rupiah-sign"></i></div>
          <div className="z-10">
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Pendapatan</p>
            <h3 className="text-2xl font-black text-gray-800">Rp {stats.totalRevenue.toLocaleString('id-ID')}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-orange-50 opacity-50 text-8xl pointer-events-none"><i className="fa-solid fa-boxes-stacked"></i></div>
          <div className="h-14 w-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl flex-shrink-0 z-10"><i className="fa-solid fa-cart-flatbed"></i></div>
          <div className="z-10">
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Pesanan</p>
            <h3 className="text-2xl font-black text-gray-800">{stats.totalOrders} Transaksi</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-blue-50 opacity-50 text-8xl pointer-events-none"><i className="fa-solid fa-users"></i></div>
          <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl flex-shrink-0 z-10"><i className="fa-solid fa-users"></i></div>
          <div className="z-10">
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Pelanggan Aktif</p>
            <h3 className="text-2xl font-black text-gray-800">{stats.totalUsers} Akun</h3>
          </div>
        </div>
      </div>

      {/* Tab Navigasi Admin */}
      <div className="flex gap-4 mb-8 border-b border-gray-200 overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab('pesanan')} className={`pb-3 px-4 font-bold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'pesanan' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <i className="fa-solid fa-clipboard-list mr-2"></i> Kelola Pesanan
        </button>
        <button onClick={() => setActiveTab('produk')} className={`pb-3 px-4 font-bold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'produk' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <i className="fa-solid fa-box-open mr-2"></i> Kelola Produk
        </button>
        <button onClick={() => setActiveTab('bundling')} className={`pb-3 px-4 font-bold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'bundling' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <i className="fa-solid fa-gift mr-2"></i> Kelola Bundling
        </button>
      </div>

      {activeTab === 'pesanan' ? (
        <AdminOrders />
      ) : activeTab === 'produk' ? (
        <div className="fade-in">
          <form onSubmit={handleSubmit} className={`p-6 rounded-2xl shadow-sm border mb-10 grid sm:grid-cols-2 gap-4 transition-colors ${isEditing ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
            <div className="sm:col-span-2 flex justify-between items-center mb-2">
              <h2 className={`text-xl font-bold ${isEditing ? 'text-orange-700' : 'text-gray-800'}`}>{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
              {isEditing && <span className="bg-orange-200 text-orange-800 text-xs font-bold px-3 py-1 rounded-full animate-pulse">Mode Edit Aktif</span>}
            </div>
            
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Produk</label><input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" /></div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500">
                <option value="TENDA">TENDA</option><option value="TAS / CARRIER">TAS / CARRIER</option><option value="MEMASAK">MEMASAK</option><option value="TIDUR">TIDUR</option>
              </select>
            </div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Harga (Rp)</label><input type="number" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" /></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stok</label><input type="number" required value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL Gambar</label><input type="text" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" /></div>
            
            <div className="sm:col-span-2 border-t border-dashed border-gray-200 mt-2 pt-4">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" checked={form.is_rentable} onChange={e => setForm({...form, is_rentable: e.target.checked})} className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500" />
                <span className="font-bold text-gray-700">Produk ini bisa disewakan</span>
              </label>
              {form.is_rentable && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 fade-in">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Harga Sewa Per Hari (Rp)</label>
                  <input type="number" required={form.is_rentable} value={form.rent_price_per_day} onChange={e => setForm({...form, rent_price_per_day: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" />
                </div>
              )}
            </div>

            <div className="sm:col-span-2 flex gap-3 mt-2">
              <button type="submit" className={`${isEditing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-brand-600 hover:bg-brand-700'} text-white font-bold px-6 py-3 rounded-xl transition shadow-md flex-grow`}>
                <i className={`fa-solid ${isEditing ? 'fa-floppy-disk' : 'fa-plus'} mr-2`}></i> {isEditing ? 'Simpan Perubahan' : 'Simpan Produk'}
              </button>
              {isEditing && <button type="button" onClick={handleReset} className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-6 py-3 rounded-xl transition shadow-sm">Batal</button>}
            </div>
          </form>

          {/* Tabel Produk */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex justify-between items-center">
              Daftar Produk di Database <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">{products.length} Item</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                  <tr><th className="p-3">Nama</th><th className="p-3">Kategori</th><th className="p-3">Harga</th><th className="p-3">Stok</th><th className="p-3 text-center">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-gray-400">Belum ada produk.</td></tr> : products.map(p => (
                    <tr key={p.id} className="hover:bg-brand-50/50 transition">
                      <td className="p-3 font-semibold text-gray-800 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <i className="fa-solid fa-image text-gray-400 flex items-center justify-center h-full w-full"></i>}
                        </div>
                        <div>
                          {p.name}
                          {p.is_rentable && <span className="ml-2 bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Sewa</span>}
                        </div>
                      </td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3 text-brand-700 font-bold">Rp {Number(p.price).toLocaleString('id-ID')}</td>
                      <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{p.stock}</span></td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEditClick(p)} className="bg-orange-50 text-orange-600 hover:bg-orange-100 h-8 w-8 rounded-lg transition"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-600 hover:bg-red-100 h-8 w-8 rounded-lg transition"><i className="fa-solid fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* KELOLA BUNDLING TAB */
        <div className="fade-in">
          <form onSubmit={handleBundleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-10">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Buat Paket Bundling / Promo Baru</h2>
            
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Judul Paket Utama</label>
                <input type="text" required value={bundleForm.name} onChange={e => setBundleForm({...bundleForm, name: e.target.value})} placeholder="Contoh: Paket Camping Ceria 4 Orang" className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipe Bundling</label>
                <select value={bundleForm.type} onChange={e => setBundleForm({...bundleForm, type: e.target.value})} className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 bg-white font-semibold">
                  <option value="beli">Bundling Jual (Beli Alat)</option>
                  <option value="sewa">Bundling Sewa (Sewa Alat)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Keterangan Singkat (Tag)</label>
                <input type="text" value={bundleForm.tag} onChange={e => setBundleForm({...bundleForm, tag: e.target.value})} placeholder="Contoh: Cocok untuk keluarga / 4 orang" className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Label Badge Promo</label>
                <input type="text" value={bundleForm.badge} onChange={e => setBundleForm({...bundleForm, badge: e.target.value})} placeholder="Contoh: Hemat 20%" className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Persentase Diskon (%)</label>
                <input type="number" value={bundleForm.discount_percentage} onChange={e => setBundleForm({...bundleForm, discount_percentage: e.target.value})} placeholder="20" className="w-full border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" />
              </div>
            </div>

            {/* Daftar Item di dalam Paket */}
            <div className="border-t border-dashed pt-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-700 text-sm">Daftar Item / Komponen di Paket Ini</h3>
                <button type="button" onClick={handleAddItemRow} className="bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                  <i className="fa-solid fa-plus mr-1"></i> Tambah Item
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {bundleItems.map((item, index) => (
                  <div key={index} className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <input type="text" required value={item.name} onChange={e => handleItemChange(index, 'name', e.target.value)} placeholder="Nama Barang" className="flex-grow border rounded-lg px-3 py-2 text-sm bg-white" />
                    <input type="text" value={item.desc} onChange={e => handleItemChange(index, 'desc', e.target.value)} placeholder="Deskripsi Singkat" className="w-1/3 border rounded-lg px-3 py-2 text-sm bg-white hidden sm:block" />
                    <input type="number" required value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} placeholder="Harga (Rp)" className="w-32 border rounded-lg px-3 py-2 text-sm bg-white" />
                    <button type="button" onClick={() => handleRemoveItemRow(index)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"><i className="fa-solid fa-trash"></i></button>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition shadow-md">
              Simpan & Publikasikan Paket Bundling
            </button>
          </form>

          {/* Daftar Paket Bundling Aktif */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Daftar Paket Bundling Aktif ({bundles.length})</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {bundles.map((bundle) => (
                <div key={bundle.db_id} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between relative bg-white shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2">
                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{bundle.badge}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${bundle.type === 'sewa' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>Tipe: {bundle.type || 'beli'}</span>
                      </div>
                      <button onClick={() => handleDeleteBundle(bundle.db_id)} className="text-red-500 hover:text-red-700 text-sm" title="Hapus Paket"><i className="fa-solid fa-trash"></i></button>
                    </div>
                    <h3 className="font-bold text-gray-800 text-base">{bundle.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{bundle.tag}</p>
                    <div className="bg-gray-50 rounded-lg p-2.5 mb-3 space-y-1">
                      {bundle.items.map((it, idx) => (
                        <div key={idx} className="text-xs flex justify-between text-gray-600">
                          <span>• {it.n}</span>
                          <span className="font-semibold">Rp {Number(it.p).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};