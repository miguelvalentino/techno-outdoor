// src/components/GuideSection.jsx
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';

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
  
  const today = new Date();
  const defaultEnd = new Date();
  defaultEnd.setDate(today.getDate() + 2); 

  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(defaultEnd));
  const [days, setDays] = useState(2); 
  const [pax, setPax] = useState(4);   
  
  const { addToCart } = useCart();

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        setEndDate(startDate);
        setDays(1);
      } else {
        setDays(diffDays);
      }
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetch('http://localhost:5000/api/guides')
      .then((res) => res.json())
      .then((data) => {
        setGuides(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat data guide:', err);
        setLoading(false);
      });
  }, []);

  const availableMountains = Array.from(
    new Set(
      guides
        .flatMap(g => g.mountain_region ? g.mountain_region.split(/&|,/).map(m => m.trim()) : [])
        .filter(Boolean)
    )
  );

  const filteredGuides = guides.filter(guide => {
    if (selectedMountain === 'ALL') return true;
    if (!guide.mountain_region) return false;
    return guide.mountain_region.toUpperCase().includes(selectedMountain.toUpperCase());
  });

  const handleBookGuide = (guide) => {
    const totalCost = Number(guide.price_per_day) * days;
    const displayDate = `${startDate.split('-').reverse().join('/')} s/d ${endDate.split('-').reverse().join('/')}`;

    addToCart({ 
      id: `guide-${guide.id}`, 
      type: 'booking', 
      name: `[Booking Guide] ${guide.name} (${days} Hari, ${pax} Org - ${displayDate})`, 
      price: totalCost, 
      qty: 1,
      image_url: guide.avatar_url 
    });
  };

  return (
    <section className="tab-content block fade-in">
      
      <div className="bg-brand-800 text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <i className="fa-solid fa-map-location-dot absolute -right-4 -bottom-6 text-[10rem] opacity-10 -rotate-12 pointer-events-none"></i>
        
        <div className="relative z-10 md:w-1/3">
          <h2 className="text-2xl font-bold mb-2">Booking Pemandu Profesional</h2>
          <p className="text-brand-100 text-sm">Pilih tujuan gunung, tanggal, dan jumlah peserta pendakian Anda di sini.</p>
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

      {loading ? (
        <div className="text-center py-10 text-gray-500">Mencari pemandu yang tersedia...</div>
      ) : filteredGuides.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <i className="fa-solid fa-person-hiking text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-500 text-sm font-medium">Tidak ada pemandu yang tersedia untuk gunung tersebut.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide) => (
            <div key={guide.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col hover:shadow-lg transition relative overflow-hidden group">
              
              {guide.verified && (
                <div className="absolute top-3 right-3 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 border border-blue-100">
                  <i className="fa-solid fa-circle-check"></i> Terverifikasi
                </div>
              )}

              <div className="flex items-start gap-4 mb-4">
                <div className="h-20 w-20 rounded-2xl bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-brand-100 shadow-inner">
                  <img src={guide.avatar_url || 'https://placehold.co/100x100/15803d/ffffff?text=Guide'} alt={guide.name} className="h-full w-full object-cover group-hover:scale-105 transition duration-300" />
                </div>
                <div className="pr-4 mt-1">
                  <h3 className="font-bold text-gray-900 text-base leading-tight">{guide.name}</h3>
                  <p className="text-xs text-brand-600 font-bold uppercase mb-1.5 line-clamp-1">{guide.mountain_region}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1 font-semibold text-gray-700"><i className="fa-solid fa-star text-yellow-400"></i> {guide.rating}</span>
                    <span>• {guide.experience_years} thn</span>
                    <span>• {guide.total_trips} trip</span>
                  </div>
                </div>
              </div>
              
              {guide.skills && guide.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {guide.skills.slice(0, 3).map((skill, idx) => (
                    <span key={idx} className="bg-gray-50 text-gray-600 border border-gray-200 text-[10px] px-2.5 py-0.5 rounded-full font-medium">{skill}</span>
                  ))}
                  {guide.skills.length > 3 && <span className="bg-gray-50 text-gray-600 border border-gray-200 text-[10px] px-2.5 py-0.5 rounded-full font-medium">+{guide.skills.length - 3}</span>}
                </div>
              )}
              
              <div className="mt-auto pt-4 border-t border-dashed border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Total Tarif ({days} Hari)</p>
                  <p className="text-base font-black text-brand-700">Rp {(Number(guide.price_per_day) * days).toLocaleString('id-ID')}</p>
                </div>
                <button 
                  onClick={() => handleBookGuide(guide)}
                  className="bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white transition px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  <i className="fa-solid fa-calendar-check"></i> Booking
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};