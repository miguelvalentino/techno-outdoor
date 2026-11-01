// src/components/CartModal.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const CartModal = ({ isOpen, onClose }) => {
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newOrderId, setNewOrderId] = useState(null);

  if (!isOpen) return null;

  const grandTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    
    if (!user) {
      alert('Silakan Login atau Daftar terlebih dahulu untuk melanjutkan pembayaran.');
      onClose();
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: user.id,
          total_price: grandTotal,
          items: cartItems
        })
      });

      const data = await response.json();

      if (response.ok) {
        setNewOrderId(data.order_id);
        clearCart(); 
        setIsSuccess(true); 
      } else {
        alert('Gagal memproses pesanan. Silakan coba lagi.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 fade-in">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 text-center shadow-2xl scale-up">
          <div className="mx-auto w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">
            <i className="fa-solid fa-check-to-slot"></i>
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Checkout Berhasil!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Terima kasih, <strong>{user?.name}</strong>. Pesanan Anda sedang diproses.
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-8">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">ID Pesanan Anda</p>
            <p className="text-xl font-bold text-brand-700">#ORD-{newOrderId}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                setIsSuccess(false);
                setNewOrderId(null);
                onClose();
                navigate('/profile'); 
              }}
              className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl hover:bg-brand-700 transition shadow-lg shadow-brand-500/30"
            >
              Lihat Status Pesanan
            </button>
            <button 
              onClick={() => {
                setIsSuccess(false);
                setNewOrderId(null);
                onClose();
              }}
              className="w-full bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition"
            >
              Tutup & Lanjut Belanja
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-brand-800 text-white">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-cart-shopping text-brand-500"></i>
            <h3 className="font-bold text-lg">Keranjang Belanjaan</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-grow divide-y divide-gray-100">
          {cartItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <i className="fa-solid fa-cart-arrow-down text-4xl mb-3 text-gray-300"></i>
              <p>Belum ada produk di keranjang.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-grow">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${item.type === 'sewa' ? 'bg-red-50 text-red-700' : item.type === 'booking' ? 'bg-blue-50 text-blue-700' : 'bg-brand-50 text-brand-700'}`}>
                    {item.type === 'sewa' ? 'Sewa Alat' : item.type === 'booking' ? 'Booking Guide' : 'Beli Alat'}
                  </span>
                  <h4 className="font-bold text-gray-800 text-sm truncate mt-1">{item.name}</h4>
                  <p className="text-xs text-gray-500">
                    Rp {item.price.toLocaleString('id-ID')} per item
                  </p>
                </div>
                
                <div className="flex items-center justify-between w-full sm:w-auto gap-4 flex-shrink-0">
                  {/* TOMBOL PENGATUR KUANTITAS DENGAN VALIDASI STOK */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <button 
                      onClick={() => updateQuantity(item.id, item.type, item.qty - 1, item.stock)}
                      className="px-2.5 py-1 text-xs font-bold hover:bg-gray-200 transition text-gray-600"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-bold text-gray-800">{item.qty}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.type, item.qty + 1, item.stock)}
                      className="px-2.5 py-1 text-xs font-bold hover:bg-gray-200 transition text-gray-600"
                    >
                      +
                    </button>
                  </div>

                  <p className="font-bold text-brand-700 text-sm min-w-[80px] text-right">
                    Rp {(item.price * item.qty).toLocaleString('id-ID')}
                  </p>

                  <button 
                    onClick={() => removeFromCart(item.id, item.type)}
                    className="text-gray-400 hover:text-red-500 transition p-1"
                    title="Hapus"
                  >
                    <i className="fa-regular fa-trash-can"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-5 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm">Total Pembayaran</span>
              <span className="text-xl font-bold text-brand-700">Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={isProcessing}
              className={`w-full text-white font-semibold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 active:scale-95'}`}
            >
              {isProcessing ? (
                <span><i className="fa-solid fa-spinner fa-spin mr-2"></i> Memproses...</span>
              ) : (
                <span><i className="fa-solid fa-bag-shopping"></i> Lanjutkan ke Pembayaran</span>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};