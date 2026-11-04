// src/components/BookingModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '../context/CartContext';
import { GuideCalendar } from './GuideCalendar';

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
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

// Cek apakah rentang startDate..endDate bentrok dengan jadwal booking atau hari libur guide
export const checkGuideAvailability = (guide, startDate, endDate) => {
  if (!guide || !startDate || !endDate) return { available: true, reason: '' };

  const schedules = Array.isArray(guide.schedules) ? guide.schedules : [];
  const workingDays = Array.isArray(guide.working_days) && guide.working_days.length > 0
    ? guide.working_days
    : ALL_DAYS;

  // 1. Cek bentrok jadwal yang sudah dibooking
  const conflictSchedule = schedules.find((sch) => {
    if (!sch.start_date) return false;
    const s = sch.start_date.slice(0, 10);
    const e = (sch.end_date || sch.start_date).slice(0, 10);
    return startDate <= e && endDate >= s;
  });

  if (conflictSchedule) {
    const s = conflictSchedule.start_date.slice(0, 10).split('-').reverse().join('/');
    const e = (conflictSchedule.end_date || conflictSchedule.start_date).slice(0, 10).split('-').reverse().join('/');
    return {
      available: false,
      reason: `Pemandu sudah dibooking pada tanggal ${s} s/d ${e} (${conflictSchedule.destination || 'Pendakian'}).`
    };
  }

  // 2. Cek apakah setiap hari dalam rentang tanggal termasuk hari kerja pemandu
  const cur = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (cur <= last) {
    const dayName = DAY_NAMES_ID[cur.getDay()];
    if (!workingDays.includes(dayName)) {
      return {
        available: false,
        reason: `Hari ${dayName} bukan hari kerja aktif pemandu ini.`
      };
    }
    cur.setDate(cur.getDate() + 1);
  }

  return { available: true, reason: '' };
};

export const BookingModal = ({
  isOpen,
  onClose,
  guide,
  initialStartDate,
  initialEndDate,
  initialDays = 2,
  initialPax = 4,
  initialMountain = ''
}) => {
  const { addToCart } = useCart();

  const todayStr = formatDate(new Date());
  const [startDate, setStartDate] = useState(initialStartDate || todayStr);
  const [endDate, setEndDate] = useState(initialEndDate || todayStr);
  const [days, setDays] = useState(initialDays);
  const [pax, setPax] = useState(initialPax);
  const [destination, setDestination] = useState('');
  const [usePorter, setUsePorter] = useState(false);
  const [usePhoto, setUsePhoto] = useState(false);
  const [meetingPoint, setMeetingPoint] = useState('');

  const guideMountains = guide?.mountain_region
    ? guide.mountain_region.split(/,|&/).map(m => m.trim()).filter(Boolean)
    : ['Gunung Tujuan'];

  useEffect(() => {
    if (guide && isOpen) {
      setStartDate(initialStartDate || todayStr);
      setEndDate(initialEndDate || todayStr);
      setDays(initialDays || 2);
      setPax(initialPax || 4);
      setUsePorter(false);
      setUsePhoto(false);
      setMeetingPoint('');

      if (initialMountain && initialMountain !== 'ALL' && guideMountains.some(m => m.toLowerCase() === initialMountain.toLowerCase())) {
        setDestination(initialMountain);
      } else {
        setDestination(guideMountains[0] || guide.mountain_region || '');
      }
    }
  }, [guide, isOpen, initialStartDate, initialEndDate, initialDays, initialPax, initialMountain]);

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

  const availability = useMemo(
    () => checkGuideAvailability(guide, startDate, endDate),
    [guide, startDate, endDate]
  );

  if (!isOpen || !guide) return null;

  const baseGuidePrice = Number(guide.price_per_day || guide.price || 0) * days;
  const porterCost = usePorter ? 150000 * days : 0;
  const photoCost = usePhoto ? 100000 : 0;
  const totalPrice = baseGuidePrice + porterCost + photoCost;

  const reviewsList = Array.isArray(guide.reviews) ? guide.reviews : [];

  const handleConfirmBooking = () => {
    if (!startDate) {
      alert('Pilih tanggal mulai pendakian terlebih dahulu.');
      return;
    }

    if (!availability.available) {
      alert(availability.reason);
      return;
    }

    const displayDate = `${startDate.split('-').reverse().join('/')} s/d ${endDate.split('-').reverse().join('/')}`;
    const addons = [];
    if (usePorter) addons.push('+Porter');
    if (usePhoto) addons.push('+Dokumentasi');
    const addonLabel = addons.length > 0 ? ` [${addons.join(', ')}]` : '';
    const destLabel = destination ? ` - ${destination}` : '';
    const mpLabel = meetingPoint.trim() ? ` (Titik Kumpul: ${meetingPoint.trim()})` : '';

    addToCart({
      id: `guide-${guide.id}-${startDate}-${endDate}-${usePorter ? 'p' : ''}${usePhoto ? 'd' : ''}`,
      guide_id: guide.id,
      start_date: startDate,
      end_date: endDate,
      destination: destination || guide.mountain_region,
      type: 'booking',
      name: `[Booking Guide] ${guide.name}${destLabel} (${days} Hari, ${pax} Org - ${displayDate})${addonLabel}${mpLabel}`,
      price: totalPrice,
      qty: 1,
      image_url: guide.avatar_url
    });

    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Profil Pemandu */}
        <div className="bg-brand-900 text-white p-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute -right-6 -bottom-8 text-white/5 text-9xl pointer-events-none">
            <i className="fa-solid fa-person-hiking"></i>
          </div>

          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white/10 overflow-hidden border-2 border-brand-500 flex-shrink-0">
                <img
                  src={guide.avatar_url || 'https://placehold.co/100x100/15803d/ffffff?text=Guide'}
                  alt={guide.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-brand-300 uppercase block mb-0.5">
                  Profil, Kalender Jadwal & Booking Guide
                </span>
                <h3 className="text-xl font-bold text-white leading-tight">{guide.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-brand-100 mt-1">
                  <span className="flex items-center gap-1 font-bold text-yellow-400">
                    <i className="fa-solid fa-star"></i> {guide.rating}
                    <span className="text-brand-200 font-normal">({guide.review_count || 0} ulasan)</span>
                  </span>
                  <span>• {guide.experience_years} Tahun Pengalaman</span>
                  <span>• {guide.total_trips} Trip</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center flex-shrink-0"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {guide.description && (
            <p className="mt-3 text-xs text-brand-100/90 leading-relaxed relative z-10 bg-black/20 p-3 rounded-xl border border-white/10">
              {guide.description}
            </p>
          )}

          {/* Daftar Semua Keahlian Guide */}
          {Array.isArray(guide.skills) && guide.skills.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-1.5 relative z-10">
              {guide.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="bg-white/10 text-brand-100 text-[10px] px-2.5 py-0.5 rounded-full font-medium border border-white/10"
                >
                  <i className="fa-solid fa-check text-brand-400 mr-1"></i>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body Modal: 2 Kolom (Kiri: Kalender & Ulasan, Kanan: Konfigurasi Trip) */}
        <div className="p-6 overflow-y-auto flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* KOLOM KIRI: KALENDER KETERSEDIAAN & ULASAN PENDAKI */}
          <div className="lg:col-span-6 space-y-5">
            <GuideCalendar
              schedules={guide.schedules || []}
              workingDays={guide.working_days || ALL_DAYS}
              selectedStart={startDate}
              selectedEnd={endDate}
              onSelectRange={(newStart, newEnd) => {
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
            />

            {/* Daftar Ulasan Pelanggan */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>
                  <i className="fa-solid fa-comments text-brand-600 mr-1.5"></i>
                  Ulasan Penyewa Sebelumnya ({reviewsList.length})
                </span>
                <span className="text-yellow-600 font-black">
                  <i className="fa-solid fa-star text-yellow-400 mr-1"></i>{guide.rating} / 5.0
                </span>
              </h4>

              {reviewsList.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-3 text-center">
                  Belum ada ulasan tertulis untuk pemandu ini.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {reviewsList.map((rev) => (
                    <div key={rev.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-800 text-xs">{rev.customer_name || 'Pendaki'}</span>
                        <div className="flex items-center gap-0.5 text-yellow-400 text-[10px]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <i
                              key={i}
                              className={`${i < Number(rev.rating) ? 'fa-solid' : 'fa-regular'} fa-star`}
                            ></i>
                          ))}
                        </div>
                      </div>
                      {rev.comment && <p className="text-xs text-gray-600 leading-relaxed">{rev.comment}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {rev.created_at ? new Date(rev.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KOLOM KANAN: FORM PENGATURAN TRIP & ADD-ONS */}
          <div className="lg:col-span-6 space-y-4">
            {/* Banner Status Ketersediaan Tanggal */}
            {!availability.available ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                <i className="fa-solid fa-triangle-exclamation text-red-500 mt-0.5"></i>
                <div>
                  <p className="font-bold">Tanggal Tidak Tersedia</p>
                  <p className="mt-0.5">{availability.reason}</p>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-green-600"></i>
                <span>Jadwal tersedia untuk tanggal yang dipilih ({days} Hari).</span>
              </div>
            )}

            {/* Pilih Gunung Tujuan & Jumlah Peserta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gunung Tujuan</label>
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-brand-500"
                >
                  {guideMountains.map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jumlah Peserta</label>
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => setPax(Math.max(1, pax - 1))}
                    className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-brand-600 hover:text-white transition font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-gray-800">{pax} Orang</span>
                  <button
                    type="button"
                    onClick={() => setPax(pax + 1)}
                    className="h-7 w-7 rounded-lg bg-white border border-gray-200 hover:bg-brand-600 hover:text-white transition font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Tanggal Mulai & Selesai */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Tanggal Selesai <span className="text-brand-600">({days} Hari)</span>
                </label>
                <input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Titik Kumpul / Catatan Basecamp */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Titik Kumpul / Basecamp <span className="text-gray-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Basecamp Cibodas / Patung Kuda pukul 07:00 WIB"
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            {/* Layanan Tambahan (Add-ons) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Layanan Ekstra Pendakian (Opsional)</label>
              <div className="space-y-2">
                <label
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    usePorter ? 'bg-brand-50/60 border-brand-500' : 'border-gray-200 hover:border-brand-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${usePorter ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <i className="fa-solid fa-person-walking-luggage text-xs"></i>
                    </div>
                    <div>
                      <span className="font-bold text-gray-800 text-xs block">Bantuan Porter Logistik</span>
                      <span className="text-[11px] text-gray-500">Bantu angkut beban tenda & logistik • +Rp 150.000/hari</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={usePorter}
                    onChange={(e) => setUsePorter(e.target.checked)}
                    className="h-4 w-4 accent-green-600 cursor-pointer flex-shrink-0"
                  />
                </label>

                <label
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    usePhoto ? 'bg-brand-50/60 border-brand-500' : 'border-gray-200 hover:border-brand-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${usePhoto ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      <i className="fa-solid fa-camera text-xs"></i>
                    </div>
                    <div>
                      <span className="font-bold text-gray-800 text-xs block">Dokumentasi Foto & Video Trip</span>
                      <span className="text-[11px] text-gray-500">Dokumentasi momen puncak & perjalanan • +Rp 100.000/trip</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={usePhoto}
                    onChange={(e) => setUsePhoto(e.target.checked)}
                    className="h-4 w-4 accent-green-600 cursor-pointer flex-shrink-0"
                  />
                </label>
              </div>
            </div>

            {/* Ringkasan Rincian Biaya */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Jasa Pemandu ({days} hari × Rp {Number(guide.price_per_day || 0).toLocaleString('id-ID')})</span>
                <span className="font-bold text-gray-800">Rp {baseGuidePrice.toLocaleString('id-ID')}</span>
              </div>
              {usePorter && (
                <div className="flex justify-between text-brand-700">
                  <span>+ Porter Logistik ({days} hari × Rp 150.000)</span>
                  <span className="font-bold">Rp {porterCost.toLocaleString('id-ID')}</span>
                </div>
              )}
              {usePhoto && (
                <div className="flex justify-between text-brand-700">
                  <span>+ Paket Dokumentasi Foto & Video</span>
                  <span className="font-bold">Rp {photoCost.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer / Total & Tombol Konfirmasi */}
        <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Estimasi Biaya</p>
            <p className="text-2xl font-black text-brand-700">Rp {totalPrice.toLocaleString('id-ID')}</p>
          </div>
          <button
            type="button"
            disabled={!availability.available}
            onClick={handleConfirmBooking}
            className={`font-bold px-6 py-3.5 rounded-xl shadow-md transition flex items-center gap-2 text-sm ${
              availability.available
                ? 'bg-brand-600 hover:bg-brand-700 active:scale-95 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <i className="fa-solid fa-cart-plus"></i> Masukkan ke Keranjang
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
