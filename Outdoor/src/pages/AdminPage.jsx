// src/pages/AdminPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminOrders } from '../components/AdminOrders';
import { ImageCropModal } from '../components/ImageCropModal';
import { GuideCalendar } from '../components/GuideCalendar';

const PRESET_MOUNTAINS = [
  'Gede Pangrango',
  'Rinjani',
  'Semeru',
  'Merbabu',
  'Prau',
  'Sindoro',
  'Kerinci',
  'Papandayan'
];

const PRESET_SKILLS = [
  'First Aid / P3K',
  'Navigasi Darat',
  'Fotografi Outdoor',
  'Masak Gunung',
  'Bahasa Inggris',
  'SAR & Rescue',
  'Manajemen Logistik',
  'Porter Support'
];

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('pesanan');
  const [stats, setStats] = useState({ totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalGuides: 0 });

  // --- STATE PRODUK ---
  const [products, setProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '', category: 'TENDA', price: '', stock: '', image_url: '', description: '', is_rentable: false, rent_price_per_day: ''
  });

  // --- STATE BUNDLING ---
  const [bundles, setBundles] = useState([]);
  const [bundleForm, setBundleForm] = useState({
    bundle_key: '',
    label: 'PAKET HEMAT',
    name: '',
    tag: '',
    badge: 'Hemat 20%',
    discount_percentage: 20,
    type: 'beli'
  });
  
  const [bundleItems, setBundleItems] = useState([
    { name: '', desc: '', price: '', icon: 'fa-tent' },
    { name: '', desc: '', price: '', icon: 'fa-backpack' }
  ]);

  // --- STATE PEMANDU (GUIDE) ---
  const [guides, setGuides] = useState([]);
  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [editGuideId, setEditGuideId] = useState(null);
  const [guideSearch, setGuideSearch] = useState('');
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [guideForm, setGuideForm] = useState({
    name: '',
    mountain_region: '',
    description: '',
    price_per_day: '',
    rating: '5.0',
    total_trips: '0',
    experience_years: '1',
    skills: ['First Aid / P3K', 'Navigasi Darat'],
    working_days: [...ALL_DAYS],
    avatar_url: ''
  });

  // --- STATE UPLOAD & CROP FOTO ---
  const guideFileInputRef = useRef(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageToCrop, setRawImageToCrop] = useState('');

  // --- STATE MODAL KALENDER JADWAL PEMANDU (ADMIN) ---
  const [scheduleModalGuide, setScheduleModalGuide] = useState(null);
  const [newScheduleForm, setNewScheduleForm] = useState({
    start_date: '',
    end_date: '',
    destination: '',
    customer_name: '',
    note: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchData = () => {
    fetch('http://localhost:5000/api/products')
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
      
    fetch('http://localhost:5000/api/admin/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Gagal memuat statistik:', err));

    fetch('http://localhost:5000/api/bundles')
      .then(res => res.json())
      .then(data => setBundles(Array.isArray(data) ? data : []))
      .catch(err => console.error('Gagal memuat bundling:', err));

    fetch('http://localhost:5000/api/guides')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setGuides(list);
        if (scheduleModalGuide) {
          const updated = list.find(g => g.id === scheduleModalGuide.id);
          if (updated) setScheduleModalGuide(updated);
        }
      })
      .catch(err => console.error('Gagal memuat data pemandu:', err));
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchData();
    }
  }, [user]);

  // --- HANDLERS PRODUK ---
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

  // --- HANDLERS BUNDLING ---
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

  // --- HANDLERS PEMANDU (GUIDE) ---
  const handleToggleMountainChip = (mountain) => {
    const currentRegions = guideForm.mountain_region
      ? guideForm.mountain_region.split(',').map(m => m.trim()).filter(Boolean)
      : [];
    const exists = currentRegions.some(m => m.toLowerCase() === mountain.toLowerCase());
    const nextRegions = exists
      ? currentRegions.filter(m => m.toLowerCase() !== mountain.toLowerCase())
      : [...currentRegions, mountain];
    setGuideForm({ ...guideForm, mountain_region: nextRegions.join(', ') });
  };

  const handleToggleSkill = (skill) => {
    const exists = guideForm.skills.includes(skill);
    const nextSkills = exists
      ? guideForm.skills.filter(s => s !== skill)
      : [...guideForm.skills, skill];
    setGuideForm({ ...guideForm, skills: nextSkills });
  };

  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;
    if (!guideForm.skills.includes(trimmed)) {
      setGuideForm({ ...guideForm, skills: [...guideForm.skills, trimmed] });
    }
    setCustomSkillInput('');
  };

  const handleToggleWorkingDay = (dayName) => {
    const exists = guideForm.working_days.includes(dayName);
    if (exists && guideForm.working_days.length <= 1) {
      alert('Pemandu minimal harus memiliki 1 hari kerja aktif.');
      return;
    }
    const nextDays = exists
      ? guideForm.working_days.filter(d => d !== dayName)
      : ALL_DAYS.filter(d => guideForm.working_days.includes(d) || d === dayName);
    setGuideForm({ ...guideForm, working_days: nextDays });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageToCrop(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenCropExisting = () => {
    if (!guideForm.avatar_url) return;
    setRawImageToCrop(guideForm.avatar_url);
    setCropModalOpen(true);
  };

  const handleGuideSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = isEditingGuide
        ? `http://localhost:5000/api/admin/guides/${editGuideId}`
        : 'http://localhost:5000/api/admin/guides';
      const method = isEditingGuide ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guideForm)
      });

      if (response.ok) {
        alert(isEditingGuide ? 'Data pemandu berhasil diperbarui!' : 'Pemandu baru berhasil ditambahkan!');
        handleGuideReset();
        fetchData();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || 'Gagal menyimpan data pemandu. Periksa kembali isian Anda.');
      }
    } catch (err) {
      console.error('Error submit guide:', err);
    }
  };

  const handleEditGuideClick = (guide) => {
    setIsEditingGuide(true);
    setEditGuideId(guide.id);
    setGuideForm({
      name: guide.name || '',
      mountain_region: guide.mountain_region || '',
      description: guide.description || '',
      price_per_day: guide.price_per_day || '',
      rating: guide.rating || '5.0',
      total_trips: guide.total_trips ?? '0',
      experience_years: guide.experience_years ?? '1',
      skills: Array.isArray(guide.skills) ? guide.skills : [],
      working_days: Array.isArray(guide.working_days) && guide.working_days.length > 0 ? guide.working_days : [...ALL_DAYS],
      avatar_url: guide.avatar_url || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGuideReset = () => {
    setIsEditingGuide(false);
    setEditGuideId(null);
    setCustomSkillInput('');
    setGuideForm({
      name: '',
      mountain_region: '',
      description: '',
      price_per_day: '',
      rating: '5.0',
      total_trips: '0',
      experience_years: '1',
      skills: ['First Aid / P3K', 'Navigasi Darat'],
      working_days: [...ALL_DAYS],
      avatar_url: ''
    });
  };

  const handleDeleteGuide = async (id) => {
    if (confirm('Yakin ingin menghapus pemandu ini dari sistem?')) {
      await fetch(`http://localhost:5000/api/admin/guides/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  // --- HANDLERS JADWAL KALENDER PEMANDU (ADMIN) ---
  const handleAddGuideSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleModalGuide) return;
    if (!newScheduleForm.start_date) {
      alert('Pilih tanggal mulai terlebih dahulu.');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/admin/guides/${scheduleModalGuide.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newScheduleForm,
          end_date: newScheduleForm.end_date || newScheduleForm.start_date
        })
      });
      if (response.ok) {
        setNewScheduleForm({ start_date: '', end_date: '', destination: '', customer_name: '', note: '' });
        fetchData();
      } else {
        alert('Gagal menambahkan jadwal ke kalender.');
      }
    } catch (err) {
      console.error('Error add schedule:', err);
    }
  };

  const handleDeleteGuideSchedule = async (scheduleId) => {
    if (!confirm('Hapus tanda booking tanggal ini dari kalender pemandu?')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/admin/guides/schedules/${scheduleId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error delete schedule:', err);
    }
  };

  const filteredGuides = guides.filter((g) => {
    return (
      g.name?.toLowerCase().includes(guideSearch.toLowerCase()) ||
      g.mountain_region?.toLowerCase().includes(guideSearch.toLowerCase())
    );
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 flex-grow w-full fade-in">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
        <i className="fa-solid fa-lock text-brand-600 mr-3"></i> Admin Dashboard
      </h1>

      {/* DASHBOARD ANALYTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-brand-50 opacity-50 text-7xl pointer-events-none"><i className="fa-solid fa-wallet"></i></div>
          <div className="h-13 w-13 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl flex-shrink-0 z-10"><i className="fa-solid fa-rupiah-sign"></i></div>
          <div className="z-10 min-w-0">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Pendapatan</p>
            <h3 className="text-xl font-black text-gray-800 truncate">Rp {Number(stats.totalRevenue || 0).toLocaleString('id-ID')}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-orange-50 opacity-50 text-7xl pointer-events-none"><i className="fa-solid fa-boxes-stacked"></i></div>
          <div className="h-13 w-13 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl flex-shrink-0 z-10"><i className="fa-solid fa-cart-flatbed"></i></div>
          <div className="z-10">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Pesanan</p>
            <h3 className="text-xl font-black text-gray-800">{stats.totalOrders} Transaksi</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-blue-50 opacity-50 text-7xl pointer-events-none"><i className="fa-solid fa-users"></i></div>
          <div className="h-13 w-13 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl flex-shrink-0 z-10"><i className="fa-solid fa-users"></i></div>
          <div className="z-10">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Pelanggan Aktif</p>
            <h3 className="text-xl font-black text-gray-800">{stats.totalUsers} Akun</h3>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('pemandu')}
          title="Klik untuk Kelola Pemandu"
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden cursor-pointer hover:border-brand-300 hover:shadow-md transition"
        >
          <div className="absolute -right-4 -bottom-4 text-brand-50 opacity-60 text-7xl pointer-events-none"><i className="fa-solid fa-person-hiking"></i></div>
          <div className="h-13 w-13 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-xl flex-shrink-0 z-10"><i className="fa-solid fa-map-location-dot"></i></div>
          <div className="z-10">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Pemandu Aktif</p>
            <h3 className="text-xl font-black text-gray-800">{guides.length || stats.totalGuides || 0} Guide</h3>
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
        <button onClick={() => setActiveTab('pemandu')} className={`pb-3 px-4 font-bold text-sm whitespace-nowrap border-b-2 transition flex items-center gap-2 ${activeTab === 'pemandu' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <i className="fa-solid fa-person-hiking"></i> Kelola Pemandu
          <span className="bg-brand-100 text-brand-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{guides.length}</span>
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deskripsi Produk</label>
              <textarea rows="2" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Spesifikasi alat, kapasitas, bahan, dll..." className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 resize-none" />
            </div>
            
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
      ) : activeTab === 'bundling' ? (
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
      ) : (
        /* TAB KELOLA PEMANDU (GUIDE) */
        <div className="fade-in">
          <form
            onSubmit={handleGuideSubmit}
            className={`p-6 rounded-2xl shadow-sm border mb-10 grid sm:grid-cols-2 gap-5 transition-colors ${
              isEditingGuide ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
            }`}
          >
            <div className="sm:col-span-2 flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-gray-100">
              <div>
                <h2 className={`text-xl font-bold flex items-center gap-2 ${isEditingGuide ? 'text-orange-700' : 'text-gray-800'}`}>
                  <i className={`fa-solid ${isEditingGuide ? 'fa-user-pen text-orange-600' : 'fa-person-hiking text-brand-600'}`}></i>
                  {isEditingGuide ? 'Edit Profil Pemandu' : 'Tambah Pemandu Gunung Baru'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Lengkapi informasi pemandu, foto profil (bisa unggah file & crop), wilayah gunung, jadwal hari kerja, serta tarif harian.
                </p>
              </div>
              {isEditingGuide && (
                <span className="bg-orange-200 text-orange-800 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                  Mode Edit Pemandu Aktif
                </span>
              )}
            </div>

            {/* Nama & Tarif */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap Pemandu</label>
              <input
                type="text"
                required
                placeholder="Contoh: Budi Santoso"
                value={guideForm.name}
                onChange={(e) => setGuideForm({ ...guideForm, name: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tarif Jasa Per Hari (Rp)</label>
              <input
                type="number"
                required
                placeholder="Contoh: 350000"
                value={guideForm.price_per_day}
                onChange={(e) => setGuideForm({ ...guideForm, price_per_day: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500"
              />
            </div>

            {/* Gunung Spesialisasi + Chip Cepat */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Gunung / Wilayah Spesialisasi <span className="text-gray-400 font-normal">(Pisahkan dengan koma jika lebih dari satu)</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Rinjani, Semeru, Gede Pangrango"
                value={guideForm.mountain_region}
                onChange={(e) => setGuideForm({ ...guideForm, mountain_region: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 mb-2"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400 font-semibold mr-1">Pilihan Cepat:</span>
                {PRESET_MOUNTAINS.map((m) => {
                  const isSelected = guideForm.mountain_region
                    .toLowerCase()
                    .split(',')
                    .map(s => s.trim())
                    .includes(m.toLowerCase());
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => handleToggleMountainChip(m)}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border transition ${
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-brand-50 hover:text-brand-700'
                      }`}
                    >
                      <i className={`fa-solid ${isSelected ? 'fa-check mr-1' : 'fa-mountain mr-1 opacity-60'}`}></i>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pengalaman & Total Trip (Rating otomatis dari ulasan pelanggan) */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pengalaman Mendaki (Tahun)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={guideForm.experience_years}
                  onChange={(e) => setGuideForm({ ...guideForm, experience_years: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Trip Selesai Awal</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={guideForm.total_trips}
                  onChange={(e) => setGuideForm({ ...guideForm, total_trips: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* PEMILIHAN HARI KERJA PEMANDU */}
            <div className="sm:col-span-2 border-t border-dashed border-gray-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    <i className="fa-solid fa-calendar-check text-brand-600 mr-1"></i>
                    Hari Kerja Aktif Pemandu ({guideForm.working_days.length} Hari / Minggu)
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Pilih hari di mana pemandu ini bersedia menerima jadwal pendakian.
                  </p>
                </div>

                {/* Preset Hari Kerja */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGuideForm({ ...guideForm, working_days: [...ALL_DAYS] })}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition"
                  >
                    Setiap Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideForm({ ...guideForm, working_days: ['Jumat', 'Sabtu', 'Minggu'] })}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
                  >
                    Weekend (Jum–Min)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideForm({ ...guideForm, working_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] })}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                  >
                    Weekday (Sen–Jum)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 mt-2">
                {ALL_DAYS.map((dayName) => {
                  const isActive = guideForm.working_days.includes(dayName);
                  return (
                    <button
                      type="button"
                      key={dayName}
                      onClick={() => handleToggleWorkingDay(dayName)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                        isActive
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <i className={`fa-solid ${isActive ? 'fa-circle-check text-[10px]' : 'fa-xmark text-[10px]'}`}></i>
                      {dayName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Deskripsi / Bio Lengkap Pemandu */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Deskripsi / Bio & Pengalaman Pemandu
              </label>
              <textarea
                rows="3"
                placeholder="Ceritakan pengalaman pemandu, jalur pendakian yang dikuasai, lisensi resmi (APGI), bahasa yang dikuasai, atau catatan layanan khusus..."
                value={guideForm.description}
                onChange={(e) => setGuideForm({ ...guideForm, description: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 resize-none text-sm"
              />
            </div>

            {/* FOTO PROFIL: LINK URL ATAU UPLOAD FILE + FITUR CROP MANUAL */}
            <div className="sm:col-span-2 border-t border-dashed border-gray-200 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Foto Profil Pemandu (Gunakan Link URL atau Upload File & Crop)
              </label>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <div className="flex-grow space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Tempel link URL gambar (https://...) atau unggah file di samping ->"
                      value={guideForm.avatar_url?.startsWith('data:image') ? '' : guideForm.avatar_url}
                      onChange={(e) => setGuideForm({ ...guideForm, avatar_url: e.target.value })}
                      className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                    />
                    <input
                      ref={guideFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => guideFileInputRef.current?.click()}
                      className="bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="fa-solid fa-upload"></i> Upload File Foto
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Saat memilih file foto dari komputer, jendela <strong>Crop Manual</strong> akan otomatis terbuka agar Anda bisa menyesuaikan posisi wajah pemandu.
                  </p>
                </div>

                {/* Kotak Preview Avatar + Tombol Crop Ulang / Hapus */}
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-3 flex-shrink-0">
                  <div className="h-16 w-16 rounded-2xl bg-brand-100 overflow-hidden border-2 border-brand-200 flex items-center justify-center flex-shrink-0">
                    {guideForm.avatar_url ? (
                      <img src={guideForm.avatar_url} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <i className="fa-solid fa-person-hiking text-brand-600 text-2xl"></i>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="font-bold text-gray-700 text-xs">Preview Foto</p>
                    {guideForm.avatar_url ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleOpenCropExisting}
                          className="bg-white hover:bg-brand-50 text-brand-700 border border-gray-200 text-[11px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                        >
                          <i className="fa-solid fa-crop-simple"></i> Crop
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuideForm({ ...guideForm, avatar_url: '' })}
                          className="bg-white hover:bg-red-50 text-red-600 border border-gray-200 text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                          title="Hapus Foto"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">Belum ada foto</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Keahlian / Skills Interaktif */}
            <div className="sm:col-span-2 border-t border-dashed border-gray-200 pt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Keahlian & Sertifikasi Pemandu ({guideForm.skills.length} Dipilih)
              </label>

              {/* Preset Skills */}
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_SKILLS.map((skill) => {
                  const active = guideForm.skills.includes(skill);
                  return (
                    <button
                      type="button"
                      key={skill}
                      onClick={() => handleToggleSkill(skill)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition flex items-center gap-1.5 ${
                        active
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <i className={`fa-solid ${active ? 'fa-circle-check' : 'fa-plus text-gray-400'}`}></i>
                      {skill}
                    </button>
                  );
                })}
              </div>

              {/* Input Skill Tambahan */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Tambah keahlian lain (misal: Fotografi Drone, Bahasa Jepang)..."
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSkill();
                    }
                  }}
                  className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSkill}
                  className="bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold px-4 py-2 rounded-xl text-xs transition flex-shrink-0"
                >
                  <i className="fa-solid fa-plus mr-1"></i> Tambah Keahlian
                </button>
              </div>

              {/* Daftar Chip Skill Aktif */}
              {guideForm.skills.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase mr-1">Keahlian Aktif:</span>
                  {guideForm.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="bg-white border border-brand-200 text-brand-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-2 shadow-sm"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleToggleSkill(skill)}
                        className="text-gray-400 hover:text-red-500 transition"
                        title="Hapus keahlian"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tombol Submit / Batal */}
            <div className="sm:col-span-2 flex gap-3 mt-2">
              <button
                type="submit"
                className={`${
                  isEditingGuide ? 'bg-orange-500 hover:bg-orange-600' : 'bg-brand-600 hover:bg-brand-700'
                } text-white font-bold px-6 py-3 rounded-xl transition shadow-md flex-grow`}
              >
                <i className={`fa-solid ${isEditingGuide ? 'fa-floppy-disk' : 'fa-plus'} mr-2`}></i>
                {isEditingGuide ? 'Simpan Perubahan Pemandu' : 'Simpan & Publikasikan Pemandu'}
              </button>
              {isEditingGuide && (
                <button
                  type="button"
                  onClick={handleGuideReset}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-6 py-3 rounded-xl transition shadow-sm"
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* DAFTAR PEMANDU DI DATABASE */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  Daftar Pemandu Gunung Terdaftar
                  <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full font-bold">
                    {filteredGuides.length} Guide
                  </span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pantau jadwal kalender booking, hari kerja aktif, ulasan pelanggan, atau perbarui profil pemandu.
                </p>
              </div>

              {/* Pencarian Pemandu */}
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Cari nama / gunung..."
                  value={guideSearch}
                  onChange={(e) => setGuideSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-brand-500 bg-gray-50 focus:bg-white transition w-full sm:w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                  <tr>
                    <th className="p-3">Profil Pemandu</th>
                    <th className="p-3">Gunung Spesialisasi</th>
                    <th className="p-3">Hari Kerja</th>
                    <th className="p-3">Rating & Rekam Jejak</th>
                    <th className="p-3">Tarif / Hari</th>
                    <th className="p-3 text-center">Kalender Jadwal</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGuides.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-10 text-center text-gray-400">
                        <i className="fa-solid fa-person-hiking text-4xl mb-2 text-gray-300 block"></i>
                        Tidak ada data pemandu yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredGuides.map((g) => (
                      <tr key={g.id} className="hover:bg-brand-50/40 transition align-middle">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-brand-100">
                              <img
                                src={g.avatar_url || 'https://placehold.co/100x100/15803d/ffffff?text=Guide'}
                                alt={g.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{g.name}</p>
                              <p className="text-[11px] text-gray-400">ID: #GDE-{g.id}</p>
                              {g.description && (
                                <p className="text-[11px] text-gray-500 line-clamp-1 max-w-[200px] mt-0.5">{g.description}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(g.mountain_region || '-')
                              .split(/,|&/)
                              .map((m) => m.trim())
                              .filter(Boolean)
                              .map((m, idx) => (
                                <span
                                  key={idx}
                                  className="bg-brand-50 text-brand-700 border border-brand-100 text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
                                >
                                  <i className="fa-solid fa-mountain text-[9px] mr-1"></i>
                                  {m}
                                </span>
                              ))}
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {(Array.isArray(g.working_days) && g.working_days.length > 0 ? g.working_days : ALL_DAYS).length === 7 ? (
                              <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                Setiap Hari (Sen–Min)
                              </span>
                            ) : (
                              (g.working_days || []).map((d, idx) => (
                                <span key={idx} className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                  {d.slice(0, 3)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-gray-800 flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-md">
                              <i className="fa-solid fa-star text-yellow-400"></i> {g.rating}
                              <span className="text-[10px] text-gray-400 font-normal">({g.review_count || 0} ulasan)</span>
                            </span>
                            <span className="text-gray-500">{g.experience_years} thn</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{g.total_trips} trip</span>
                          </div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <span className="text-brand-700 font-black">
                            Rp {Number(g.price_per_day || 0).toLocaleString('id-ID')}
                          </span>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setScheduleModalGuide(g)}
                            className="bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white border border-brand-200 text-xs font-bold px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1.5"
                          >
                            <i className="fa-regular fa-calendar-days"></i>
                            <span>Kalender ({(g.schedules || []).length})</span>
                          </button>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditGuideClick(g)}
                              className="bg-orange-50 text-orange-600 hover:bg-orange-100 h-8 w-8 rounded-lg transition"
                              title="Edit Pemandu"
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGuide(g.id)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 h-8 w-8 rounded-lg transition"
                              title="Hapus Pemandu"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CROP FOTO PEMANDU */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageToCrop}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={(croppedDataUrl) => setGuideForm({ ...guideForm, avatar_url: croppedDataUrl })}
      />

      {/* MODAL KALENDER & JADWAL PEMANDU (ADMIN) */}
      {scheduleModalGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-3">
                <img
                  src={scheduleModalGuide.avatar_url || 'https://placehold.co/100x100/15803d/ffffff?text=Guide'}
                  alt={scheduleModalGuide.name}
                  className="h-12 w-12 rounded-xl object-cover border border-brand-200"
                />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Kalender & Jadwal Booking: {scheduleModalGuide.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Kelola tanggal ketika pemandu sedang bertugas atau tandai tanggal booking manual.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalGuide(null)}
                className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Kalender Visual */}
              <GuideCalendar
                schedules={scheduleModalGuide.schedules || []}
                workingDays={scheduleModalGuide.working_days || ALL_DAYS}
                isAdmin={true}
                onDeleteSchedule={handleDeleteGuideSchedule}
              />

              {/* Form Tambah Tanda Tanggal Booking Manual */}
              <form onSubmit={handleAddGuideSchedule} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-calendar-plus text-brand-600"></i>
                  Tandai Tanggal Sudah Dibooking
                </h4>
                <p className="text-[11px] text-gray-500">
                  Pesanan dari pelanggan otomatis masuk ke kalender. Gunakan form ini jika ingin memblokir tanggal tambahan secara manual.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dari Tanggal</label>
                    <input
                      type="date"
                      required
                      value={newScheduleForm.start_date}
                      onChange={(e) =>
                        setNewScheduleForm({
                          ...newScheduleForm,
                          start_date: e.target.value,
                          end_date: newScheduleForm.end_date || e.target.value
                        })
                      }
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sampai Tanggal</label>
                    <input
                      type="date"
                      required
                      min={newScheduleForm.start_date}
                      value={newScheduleForm.end_date}
                      onChange={(e) => setNewScheduleForm({ ...newScheduleForm, end_date: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Gunung / Kegiatan</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pendakian Rinjani 4D3N"
                    value={newScheduleForm.destination}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, destination: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Penyewa / Keterangan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Rombongan Andi / Cuti Pribadi"
                    value={newScheduleForm.customer_name}
                    onChange={(e) => setNewScheduleForm({ ...newScheduleForm, customer_name: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i> Tandai Tanggal di Kalender
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
