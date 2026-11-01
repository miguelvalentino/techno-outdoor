// src/components/BuySection.jsx
import { useState, useEffect } from 'react';
import { BundleShowcase } from './BundleShowcase';
import { useCart } from '../context/CartContext'; 

export const BuySection = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { addToCart } = useCart(); 

  useEffect(() => {
    fetch('http://localhost:5000/api/products')
      .then((res) => res.json())
      .then((data) => {
        const buyableItems = data.filter(product => Number(product.price) > 0);
        setProducts(buyableItems);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat produk:', err);
        setLoading(false);
      });
  }, []);

  return (
    <section className="tab-content block fade-in">
      
      <BundleShowcase />

      <div className="flex justify-between items-center mb-6 mt-8">
        <h2 className="text-2xl font-bold text-gray-800">Alat Camping & Outdoor Baru</h2>
        <div className="flex gap-2">
          <select className="border rounded-md px-3 py-1.5 text-sm text-gray-600 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="pop">Terpopuler</option>
            <option value="asc">Termurah</option>
            <option value="desc">Termahal</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Memuat produk dari database...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <i className="fa-solid fa-box-open text-5xl text-gray-300 mb-4"></i>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Katalog Masih Kosong</h3>
          <p className="text-gray-500 text-sm">Belum ada barang yang dijual saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="relative h-48 overflow-hidden bg-gray-100">
                <img 
                  src={product.image_url || 'https://placehold.co/400x300/15803d/ffffff?text=Outdoor'} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                />
                
                {/* BADGE SISA STOK DI ATAS GAMBAR */}
                <div className="absolute top-2 right-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm ${product.stock > 0 ? 'bg-white/90 text-brand-800 backdrop-blur-sm' : 'bg-red-600 text-white'}`}>
                    {product.stock > 0 ? `Stok: ${product.stock}` : 'Habis'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-xs text-brand-600 font-semibold mb-1">{product.category}</p>
                <h3 className="font-bold text-gray-800 mb-2 line-clamp-1">{product.name}</h3>
                
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-lg font-bold text-brand-700">Rp {Number(product.price).toLocaleString('id-ID')}</p>
                  </div>
                  
                      {/* TOMBOL BERSIH HANYA SATU IKON */}
                      <button 
                        onClick={() => addToCart({ 
                          id: product.id, 
                          type: 'beli', 
                          name: product.name, 
                          price: Number(product.price), 
                          qty: 1,
                          stock: product.stock, 
                          image_url: product.image_url 
                        })}
                        disabled={product.stock <= 0}
                        className={`h-10 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs font-bold ${
                          product.stock > 0 
                            ? 'bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {product.stock > 0 ? (
                          <>
                            <i className="fa-solid fa-plus"></i> 
                            <span>Keranjang</span>
                          </>
                        ) : (
                          'Stok Habis'
                        )}
                      </button>
                  
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};