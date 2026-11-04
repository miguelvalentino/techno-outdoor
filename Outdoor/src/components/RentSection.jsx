// src/components/RentSection.jsx
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { BundleShowcase } from './BundleShowcase';

const formatDate = (date) => {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
};

export const RentSection = () => {
  const [rentProducts, setRentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const defaultEnd = new Date();
  defaultEnd.setDate(today.getDate() + 2);

  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(defaultEnd));
  const [rentDays, setRentDays] = useState(2);
  
  const { addToCart } = useCart();

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        setEndDate(startDate);
        setRentDays(1);
      } else {
        setRentDays(diffDays);
      }
    }
  }, [startDate, endDate]);

  const fetchRentProducts = () => {
    fetch('http://localhost:5000/api/products')
      .then(res => res.json())
      .then(data => {
        const rentableItems = Array.isArray(data) ? data.filter(product => product.is_rentable === true) : [];
        setRentProducts(rentableItems);
        setLoading(false);
      })
      .catch(err => {
        console.error('Gagal memuat produk sewa:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRentProducts();
    const handleOrderPaid = () => fetchRentProducts();
    window.addEventListener('outdoor-order-paid', handleOrderPaid);
    return () => window.removeEventListener('outdoor-order-paid', handleOrderPaid);
  }, []);

  const handleRent = (product) => {
    const rentStock = Number(product.rent_stock ?? 0);
    const totalRentPrice = Number(product.rent_price_per_day) * rentDays;
    const originalPrice = Number(product.price || 0);
    const depositPerUnit = Math.max(0, Math.round(0.5 * originalPrice - totalRentPrice));
    const displayDate = `${startDate.split('-').reverse().join('/')} s/d ${endDate.split('-').reverse().join('/')}`;

    addToCart({ 
      id: product.id, 
      type: 'sewa', 
      name: `[Sewa ${rentDays} Hari] ${product.name} (${displayDate})`, 
      price: totalRentPrice,
      original_price: originalPrice,
      deposit_per_unit: depositPerUnit,
      qty: 1,
      stock: rentStock, 
      image_url: product.image_url
    });
  };

  return (
    <section className="tab-content block fade-in">
      
      {/* Header & Pengaturan Durasi Sewa */}
      <div className="bg-orange-600 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <i className="fa-solid fa-tent absolute -right-4 -bottom-6 text-[10rem] opacity-10 pointer-events-none"></i>
        
        <div className="relative z-10 md:w-1/2">
          <h2 className="text-2xl font-bold mb-2">Pusat Penyewaan Alat</h2>
          <p className="text-orange-100 text-sm">Sewa perlengkapan mendaki berkualitas tinggi. Tentukan tanggal sewa Anda untuk melihat total biaya.</p>
        </div>
        
        {/* INPUT TANGGAL SEWA DENGAN TEKS PUTIH BERSIH */}
        <div className="relative z-10 bg-black/20 p-4 rounded-2xl backdrop-blur-md w-full md:w-auto flex flex-col sm:flex-row items-center gap-4 border border-white/10">
          <div className="flex gap-4 items-center">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-orange-200 uppercase mb-1">Tgl Ambil</label>
              <input 
                type="date" 
                value={startDate} 
                min={formatDate(today)}
                onChange={e => setStartDate(e.target.value)} 
                className="bg-white/10 text-white text-xs sm:text-sm px-3 py-2 rounded-xl outline-none font-bold cursor-pointer border border-white/20 shadow-sm"
              />
            </div>
            <span className="text-orange-200 font-black mt-4">-</span>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-orange-200 uppercase mb-1">Tgl Kembali</label>
              <input 
                type="date" 
                value={endDate} 
                min={startDate}
                onChange={e => setEndDate(e.target.value)} 
                className="bg-white/10 text-white text-xs sm:text-sm px-3 py-2 rounded-xl outline-none font-bold cursor-pointer border border-white/20 shadow-sm"
              />
            </div>
          </div>
          <div className="bg-orange-500/50 border border-orange-400 px-4 py-2 rounded-xl mt-2 sm:mt-0 w-full sm:w-auto text-center">
            <p className="text-[10px] text-orange-100 uppercase font-bold">Total Waktu</p>
            <p className="font-black text-xl text-white">{rentDays} Hari</p>
          </div>
        </div>
      </div>

      <BundleShowcase type="sewa" rentDays={rentDays} />

      <h3 className="text-xl font-bold text-gray-800 mb-6">Daftar Alat Satuan Sewa</h3>

      {loading ? (
        <div className="text-center py-10 text-gray-500">
          <i className="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
          <p>Mencari alat yang tersedia...</p>
        </div>
      ) : rentProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <i className="fa-solid fa-box-open text-5xl text-gray-300 mb-4"></i>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Belum ada barang untuk disewa</h3>
          <p className="text-gray-500 text-sm">Admin belum menambahkan katalog penyewaan alat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {rentProducts.map(product => {
            const rentStock = Number(product.rent_stock ?? 0);
            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition group">
                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                  <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider z-10 shadow-sm">
                    Disewakan
                  </div>
                  
                  {/* BADGE SISA STOK SEWA TERPISAH */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm ${rentStock > 0 ? 'bg-white/90 text-orange-800 backdrop-blur-sm' : 'bg-red-600 text-white'}`}>
                      {rentStock > 0 ? `Stok Sewa: ${rentStock}` : 'Stok Sewa Habis'}
                    </span>
                  </div>

                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover group-hover:scale-110 transition duration-500" />
                  ) : (
                    <i className="fa-solid fa-image h-full w-full flex items-center justify-center text-gray-400 text-3xl"></i>
                  )}
                </div>
                
                <div className="p-4 flex flex-col flex-grow">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{product.category}</span>
                  <h3 className="font-bold text-gray-800 text-sm mb-2 line-clamp-2">{product.name}</h3>
                  
                  <div className="mt-auto pt-3 border-t border-gray-100 space-y-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Sewa ({rentDays} Hari)</p>
                        <p className="font-black text-orange-600">Rp {(Number(product.rent_price_per_day) * rentDays).toLocaleString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-semibold">Harga Asli</p>
                        <p className="text-xs font-bold text-gray-600">Rp {Number(product.price || 0).toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                    {Math.max(0, Math.round(0.5 * Number(product.price || 0) - Number(product.rent_price_per_day) * rentDays)) > 0 && (
                      <div className="bg-amber-50 border border-amber-200/70 rounded-lg px-2 py-1 flex items-center justify-between text-[10px] text-amber-800">
                        <span className="font-semibold"><i className="fa-solid fa-shield-halved mr-1"></i>Deposito (50%):</span>
                        <span className="font-bold">+Rp {Math.max(0, Math.round(0.5 * Number(product.price || 0) - Number(product.rent_price_per_day) * rentDays)).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleRent(product)}
                    disabled={rentStock <= 0}
                    className={`mt-3 w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${rentStock > 0 ? 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    {rentStock > 0 ? <><i className="fa-solid fa-plus"></i> Sewa</> : 'Stok Sewa Habis'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
