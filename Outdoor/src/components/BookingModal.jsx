// src/components/BookingModal.jsx
import { useState, useEffect } from 'react';

export const BookingModal = ({ isOpen, onClose, guide }) => {
  const [days, setDays] = useState(2);
  const [usePorter, setUsePorter] = useState(false);
  const [usePhoto, setUsePhoto] = useState(false);
  const [date, setDate] = useState('');
  const [totalPrice, setTotalPrice] = useState(0);

  useEffect(() => {
    if (guide) {
      let base = guide.price * days;
      if (usePorter) base += 150000 * days;
      if (usePhoto) base += 100000;
      setTotalPrice(base);
    }
  }, [days, usePorter, usePhoto, guide]);

  if (!isOpen || !guide) return null;

  const handleConfirm = () => {
    if (!date) {
      alert('Pilih tanggal mulai pendakian terlebih dahulu.');
      return;
    }
    alert(`Berhasil booking guide ${guide.name} untuk tanggal ${date} (${days} hari). Total: Rp ${totalPrice.toLocaleString('id-ID')}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        
        {/* Header Modal */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-500 uppercase">Booking Guide</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{guide.name}</h3>
            <p className="text-sm text-gray-500">{guide.spec}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form Pengaturan */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tanggal Mulai</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" 
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Durasi (hari)</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setDays(Math.max(1, days - 1))} className="h-9 w-9 rounded-full bg-gray-100 hover:bg-brand-600 hover:text-white transition">-</button>
              <span className="w-6 text-center font-bold">{days}</span>
              <button onClick={() => setDays(days + 1)} className="h-9 w-9 rounded-full bg-gray-100 hover:bg-brand-600 hover:text-white transition">+</button>
            </div>
          </div>

          {/* Opsi Tambahan */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-brand-500 transition">
            <span>
              <span className="font-medium text-gray-800 block">Porter tambahan</span>
              <span className="text-xs text-gray-500">+ Rp 150.000 / hari</span>
            </span>
            <input 
              type="checkbox" 
              checked={usePorter} 
              onChange={(e) => setUsePorter(e.target.checked)} 
              className="h-5 w-5 accent-green-600 cursor-pointer" 
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-brand-500 transition">
            <span>
              <span className="font-medium text-gray-800 block">Dokumentasi foto</span>
              <span className="text-xs text-gray-500">+ Rp 100.000 sekali bayar</span>
            </span>
            <input 
              type="checkbox" 
              checked={usePhoto} 
              onChange={(e) => setUsePhoto(e.target.checked)} 
              className="h-5 w-5 accent-green-600 cursor-pointer" 
            />
          </label>
        </div>

        {/* Footer / Total & Tombol Konfirmasi */}
        <div className="mt-5 pt-4 border-t border-dashed border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Estimasi total</p>
            <p className="text-2xl font-bold text-brand-700">Rp {totalPrice.toLocaleString('id-ID')}</p>
          </div>
          <button 
            onClick={handleConfirm}
            className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-semibold px-6 py-3 rounded-xl shadow-md transition"
          >
            Konfirmasi
          </button>
        </div>

      </div>
    </div>
  );
};