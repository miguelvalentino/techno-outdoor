// src/components/BundleShowcase.jsx
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';

export const BundleShowcase = ({ type = 'beli', rentDays = 1 }) => {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { addToCart } = useCart();

  useEffect(() => {
    fetch(`http://localhost:5000/api/bundles?type=${type}`)
      .then((res) => res.json())
      .then((data) => {
        setBundles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat bundling:', err);
        setLoading(false);
      });
  }, [type]);

  useEffect(() => {
    if (bundles.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % bundles.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [bundles.length]);

  if (loading || bundles.length === 0) return null;

  const currentBundle = bundles[currentIndex];
  const itemsList = Array.isArray(currentBundle.items) ? currentBundle.items : [];
  
  const baseTotalPrice = itemsList.reduce((sum, item) => sum + Number(item.p || 0), 0);
  const discountPercent = Number(currentBundle.disc || 0);
  const priceAfterDiscount = baseTotalPrice - (baseTotalPrice * discountPercent) / 100;
  const finalPrice = type === 'sewa' ? priceAfterDiscount * rentDays : priceAfterDiscount;

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % bundles.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + bundles.length) % bundles.length);
  };

  return (
    <div className="mb-10 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <i className={`fa-solid ${type === 'sewa' ? 'fa-box-archive text-orange-500' : 'fa-gift text-brand-600'}`}></i> 
          {type === 'sewa' ? 'Paket Hemat Sewa Alat' : 'Paket Hemat Bundling'}
        </h2>
        
        {bundles.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold mr-1">
              {currentIndex + 1} dari {bundles.length}
            </span>
            <button onClick={handlePrev} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition">
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <button onClick={handleNext} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition">
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        )}
      </div>

      {/* KOTAK UTAMA SLIDER DENGAN WARNA BARU */}
      <div 
        className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between transition-all duration-500 ${
          type === 'sewa' 
            ? 'bg-gradient-to-br from-orange-400 to-orange-600' 
            : 'bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800'
        }`}
      >
        <div className="absolute -right-6 -bottom-6 text-white/10 text-[12rem] pointer-events-none">
          <i className={`fa-solid ${currentBundle.icon || 'fa-campground'}`}></i>
        </div>

        <div>
          <div className="flex justify-between items-start mb-3 relative z-10">
            {/* BADGE DIUBAH AGAR KONTRAS */}
            <span className={`${type === 'sewa' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'} text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md`}>
              {currentBundle.badge || 'Promo Spesial'}
            </span>
            {/* TAG KETERANGAN DIUBAH AGAR TIDAK HITAM */}
            <span className={`text-xs font-medium px-3 py-1 rounded-full backdrop-blur-sm ${type === 'sewa' ? 'bg-orange-800/20 text-white' : 'bg-black/20 text-white/80'}`}>
              {currentBundle.tag}
            </span>
          </div>

          <h3 className="text-2xl font-black mb-1 relative z-10 text-white">{currentBundle.name}</h3>
          
          {/* LIST ITEM DIUBAH WARNA BACKGROUNDNYA */}
          <div className={`rounded-2xl p-4 my-5 backdrop-blur-md space-y-2 relative z-10 border ${type === 'sewa' ? 'bg-orange-800/10 border-orange-200/30' : 'bg-white/10 border-white/10'}`}>
            {itemsList.map((item, idx) => {
              const itemPriceDisplay = type === 'sewa' ? Number(item.p || 0) * rentDays : Number(item.p || 0);
              return (
                <div key={idx} className={`flex justify-between items-center text-sm py-1 border-b last:border-none ${type === 'sewa' ? 'border-orange-200/20 text-white' : 'border-white/5 text-white/90'}`}>
                  <span className="flex items-center gap-3 font-medium">
                    <i className={`fa-solid ${item.i || 'fa-check'} ${type === 'sewa' ? 'text-orange-200' : 'text-brand-300'}`}></i> {item.n}
                  </span>
                  <span className="font-bold">
                    Rp {itemPriceDisplay.toLocaleString('id-ID')} {type === 'sewa' && <span className="text-[10px] text-orange-100 font-normal ml-1">({rentDays} hari)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-white/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2 relative z-10">
          <div>
            <p className={`text-xs uppercase tracking-wider font-bold ${type === 'sewa' ? 'text-orange-100' : 'text-white/75'}`}>
              {type === 'sewa' ? `Total Harga Sewa (${rentDays} Hari)` : 'Harga Paket Spesial'}
            </p>
            <p className="text-2xl font-black text-white">Rp {finalPrice.toLocaleString('id-ID')}</p>
          </div>
          
          <button
            onClick={() => {
              addToCart({
                id: `bundle-${currentBundle.id}`,
                type: type,
                name: type === 'sewa' ? `[Sewa ${rentDays} Hari] Paket ${currentBundle.name}` : `[Paket] ${currentBundle.name}`,
                price: finalPrice,
                qty: 1
              });
            }}
            className={`w-full sm:w-auto transition px-6 py-3 rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 ${
              type === 'sewa' 
                ? 'bg-white text-orange-600 hover:bg-orange-50' 
                : 'bg-white text-brand-900 hover:bg-gray-100'
            }`}
          >
            <i className={`fa-solid fa-cart-plus ${type === 'sewa' ? 'text-orange-500' : 'text-brand-600'}`}></i> 
            {type === 'sewa' ? 'Sewa Paket Ini' : 'Ambil Paket Ini'}
          </button>
        </div>
      </div>

      {/* Titik Indikator Slider (Dots) */}
      {bundles.length > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          {bundles.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === index 
                  ? (type === 'sewa' ? 'w-8 bg-orange-500' : 'w-8 bg-brand-600') 
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              title={`Geser ke paket ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};