// src/components/GuideSection.jsx
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { BookingModal, checkGuideAvailability } from './BookingModal';

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const formatDate = (date) => {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
};

export const GuideSection = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMountain, setSelectedMountain] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedGuideForModal, setSelectedGuideForModal] = useState(null);
  
  const today = new Date();
  const defaultEnd = new Date();
  defaultEnd.setDate(today.getDate() + 1); 

  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(defaultEnd));
  const [days, setDays] = useState(2); 
  const [pax, setPax] = useState(4);   
  
  const { addToCart } = useCart();

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays <= 0) {
        setEndDate(startDate);
        setDays(1);
      } else {
        setDays(diffDays);
      }
    }
  }, [startDate, endDate]);

  const fetchGuides = () => {
    fetch('http://localhost:5000/api/guides')
      .then((res) => res.json())
      .then((data) => {
        setGuides(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat data guide:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  const availableMountains = Array.from(
    new Set(
      guides
        .flatMap(g => g.mountain_region ? g.mountain_region.split(/&|,/).map(m => m.trim()) : [])
        .filter(Boolean)
    )
  );

  const filteredGuides = guides
    .filter(guide => {
      if (selectedMountain !== 'ALL') {
        if (!guide.mountain_region) return false;
        if (!guide.mountain_region.toUpperCase().includes(selectedMountain.toUpperCase())) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = guide.name?.toLowerCase().includes(q);
        const matchRegion = guide.mountain_region?.toLowerCase().includes(q);
        const matchSkills = Array.isArray(guide.skills) && guide.skills.some(s => s.toLowerCase().includes(q));
        if (!matchName && !matchRegion && !matchSkills) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
      if (sortBy === 'experience') return Number(b.experience_years || 0) - Number(a.experience_years || 0);
      if (sortBy === 'trips') return Number(b.total_trips || 0) - Number(a.total_trips || 0);
      if (sortBy === 'price_asc') return Number(a.price_per_day || 0) - Number(b.price_per_day || 0);
      if (sortBy === 'price_desc') return Number(b.price_per_day || 0) - Number(a.price_per_day || 0);
      return 0;
    });

  const handleQuickBookGuide = (guide) => {
    const check = checkGuideAvailability(guide, startDate, endDate);
    if (!check.available) {
      // Buka modal kalender agar user bisa melihat tanggal yang kosong
      setSelectedGuideForModal(guide);
      return;
    }

    const totalCost = Number(guide.price_per_day) * days;
    const displayDate = `${startDate.split('-').reverse().join('/')} s/d ${endDate.split('-').reverse().join('/')}`;

    addToCart({ 
      id: `guide-${guide.id}-${startDate}-${endDate}`,
      guide_id: guide.id,
      start_date: startDate,
      end_date: endDate,
      destination: selectedMountain !== 'ALL' ? selectedMountain : guide.mountain_region,
      type: 'booking', 
      name: `[Booking Guide] ${guide.name} (${days} Hari, ${pax} Org - ${displayDate})`, 
      price: totalCost, 
      qty: 1,
      image_url: guide.avatar_url 
    });
  };

  return (
    <section className="tab-content block fade-in">
      
      <div className="bg-brand-800 text-white rounded-3xl p-6 sm:p-8 mb-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <i className="fa-solid fa-map-location-dot absolute -right-4 -bottom-6 text-[10rem] opacity-10 -rotate-12 pointer-events-none"></i>
        
        <div className="relative z-10 md:w-1/3">
          <h2 className="text-2xl font-bold mb-2">Booking Pemandu Profesional</h2>
          <p className="text-brand-100 text-sm">Pilih tujuan gunung, tanggal pendakian, dan cek kalender ketersediaan setiap pemandu secara langsung.</p>
        </div>
        
        {/* INPUT PILIHAN GUNUNG, TANGGAL & PESERTA */}
        <div className="relative z-10 flex flex-wrap items-center gap-4 bg-black/20 p-4 rounded-2xl backdrop-blur-md w-full md:w-auto border border-white/10">
          
          {/* DROPDOWN PILIH GUNUNG */}
          <div className="flex flex-col w-full sm:w-auto">
            <label className="text-[10px] font-bold text-brand-200 uppercase mb-1">Gunung Tujuan</label>
            <select 
              value={selectedMountain}
              onChange={e => setSelectedMountain(e.target.value)}
              className="bg-white/10 text-white text-xs sm:text-sm px-3 py-2 rounded-xl outline-none font-bold cursor-pointer border border-white/20 shadow-sm"
            >
              <option value="ALL" className="bg-gray-800 text-white">Semua Gunung</option>
              {availableMountains.map((mountain, idx) => (
                <option key={idx} value={mountain} className="bg-gray-800 text-white">
                  {mountain}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 items-center">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-brand-200 uppercase mb-1">Tgl Mulai</label>
              <input 
                type="date" 
                value={startDate} 
                min={formatDate(today)}
                onChange={e => setStartDate(e.target.value)} 
                className="bg-white/10 text-white text-xs sm:text-sm px-3 py-2 rounded-xl outline-none font-bold cursor-pointer border border-white/20 shadow-sm"
              />
            </div>
            <span className="text-brand-300 font-black mt-4">-</span>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-brand-200 uppercase mb-1">Tgl Selesai</label>
              <input 
                type="date" 
                value={endDate} 
                min={startDate}
                onChange={e => setEndDate(e.target.value)} 
                className="bg-white/10 text-white text-xs sm:text-sm px-3 py-2 rounded-xl outline-none font-bold cursor-pointer border border-white/20 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 w-full pt-2 border-t border-white/10 sm:pt-0 sm:border-t-0 sm:w-auto">
            <div>
              <label className="block text-[10px] font-bold text-brand-200 uppercase mb-1">Peserta</label>
              <div className="flex items-center gap-2 bg-white/20 rounded-xl p-1">
                <button onClick={() => setPax(p => Math.max(1, p - 1))} className="h-7 w-7 rounded-lg bg-brand-700 hover:bg-brand-600 transition font-bold text-xs">-</button>
                <span className="w-10 text-center font-bold text-xs">{pax} Org</span>
                <button onClick={() => setPax(p => p + 1)} className="h-7 w-7 rounded-lg bg-brand-700 hover:bg-brand-600 transition font-bold text-xs">+</button>
              </div>
            </div>

            <div className="bg-brand-600/80 px-4 py-2 rounded-xl text-center border border-brand-500">
              <p className="text-[9px] text-brand-200 uppercase font-bold">Durasi</p>
              <p className="font-black text-sm text-white">{days} Hari</p>
            </div>
          </div>
        </div>
      </div>

      {/* BAR PENCARIAN & PENGURUTAN GUIDE */}
      <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-grow max-w-md">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
          <input
            type="text"
            placeholder="Cari nama pemandu, gunung, atau keahlian (cth: Fotografi, P3K)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-700 outline-none focus:border-brand-500"
          >
            <option value="rating">Urutkan: Rating Tertinggi</option>
            <option value="experience">Urutkan: Pengalaman Terlama</option>
            <option value="trips">Urutkan: Trip Terbanyak</option>
            <option value="price_asc">Urutkan: Tarif Termurah</option>
            <option value="price_desc">Urutkan: Tarif Tertinggi</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Mencari pemandu yang tersedia...</div>
      ) : filteredGuides.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <i className="fa-solid fa-person-hiking text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-500 text-sm font-medium">Tidak ada pemandu yang sesuai dengan kriteria pencarian tersebut.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide) => {
            const avail = checkGuideAvailability(guide, startDate, endDate);
            const workDays = Array.isArray(guide.working_days) && guide.working_days.length > 0 ? guide.working_days : ALL_DAYS;

            return (
              <div key={guide.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col hover:shadow-lg transition relative overflow-hidden group">
                
                {/* Badge Ketersediaan Tanggal di Pojok Kanan Atas */}
                <div className="flex justify-between items-center mb-3">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${
                      avail.available
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    <i className={`fa-solid ${avail.available ? 'fa-calendar-check' : 'fa-calendar-xmark'}`}></i>
                    {avail.available ? 'Tersedia di Tanggal Pilihan' : 'Jadwal Bentrok / Libur'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedGuideForModal(guide)}
                    className="text-[11px] font-bold text-brand-700 hover:underline flex items-center gap-1"
                  >
                    <i className="fa-regular fa-calendar-days"></i> Lihat Kalender
                  </button>
                </div>

                <div className="flex items-start gap-4 mb-3">
                  <div className="h-20 w-20 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-brand-100 shadow-inner">
                    <img src={guide.avatar_url || 'https://placehold.co/100x100/15803d/ffffff?text=Guide'} alt={guide.name} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                  </div>
                  <div className="min-w-0 mt-0.5">
                    <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{guide.name}</h3>
                    <p className="text-xs text-brand-600 font-bold uppercase mb-1.5 line-clamp-1">
                      <i className="fa-solid fa-mountain text-[10px] mr-1"></i>{guide.mountain_region}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-bold text-gray-800 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-md">
                        <i className="fa-solid fa-star text-yellow-400"></i> {guide.rating}
                        <span className="text-[10px] text-gray-400 font-normal">({guide.review_count || 0})</span>
                      </span>
                      <span>• {guide.experience_years} thn</span>
                      <span>• {guide.total_trips} trip</span>
                    </div>
                  </div>
                </div>

                {/* Info Hari Kerja Guide */}
                <div className="mb-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-semibold">
                    <i className="fa-solid fa-briefcase text-brand-600 mr-1"></i>Hari Kerja:
                  </span>
                  <span className="font-bold text-gray-700 truncate ml-2">
                    {workDays.length === 7 ? 'Setiap Hari (Sen–Min)' : workDays.map(d => d.slice(0, 3)).join(', ')}
                  </span>
                </div>

                {guide.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                    {guide.description}
                  </p>
                )}
                
                {guide.skills && guide.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {guide.skills.slice(0, 4).map((skill, idx) => (
                      <span key={idx} className="bg-gray-50 text-gray-600 border border-gray-200 text-[10px] px-2.5 py-0.5 rounded-full font-medium">{skill}</span>
                    ))}
                    {guide.skills.length > 4 && <span className="bg-brand-50 text-brand-700 border border-brand-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold">+{guide.skills.length - 4}</span>}
                  </div>
                )}
                
                <div className="mt-auto pt-4 border-t border-dashed border-gray-200 flex justify-between items-center gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Total Tarif ({days} Hari)</p>
                    <p className="text-base font-black text-brand-700">Rp {(Number(guide.price_per_day) * days).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGuideForModal(guide)}
                      title="Lihat Kalender Ketersediaan, Ulasan & Opsi Tambahan"
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 transition px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <i className="fa-regular fa-calendar-days"></i> Kalender & Opsi
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleQuickBookGuide(guide)}
                      className={`transition px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                        avail.available
                          ? 'bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white'
                          : 'bg-orange-50 hover:bg-orange-500 text-orange-700 hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-calendar-check"></i> {avail.available ? 'Booking' : 'Cek Jadwal'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL KALENDER, ULASAN & KONFIGURASI BOOKING */}
      <BookingModal
        isOpen={Boolean(selectedGuideForModal)}
        onClose={() => {
          setSelectedGuideForModal(null);
          fetchGuides();
        }}
        guide={selectedGuideForModal}
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialDays={days}
        initialPax={pax}
        initialMountain={selectedMountain}
      />
    </section>
  );
};
