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
  const [checkoutResult, setCheckoutResult] = useState({
    title: 'Checkout Berhasil!',
    message: '',
    icon: 'fa-solid fa-check-to-slot',
    iconColor: 'bg-green-100 text-green-500',
    orderId: null
  });

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

    let currentOrderType = 'beli';
    if (cartItems.some(item => item.type === 'booking')) {
      currentOrderType = 'booking';
    } else if (cartItems.some(item => item.type === 'sewa')) {
      currentOrderType = 'sewa';
    }
    
    try {
      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: user.id,
          total_price: grandTotal,
          order_type: currentOrderType,
          items: cartItems
        })
      });

      const data = await response.json();

      if (response.ok) {
        const orderId = data.order_id;

        // Jika Snap Token tersedia dari Midtrans
        if (data.snap_token && window.snap) {
          window.snap.pay(data.snap_token, {
            onSuccess: async function (result) {
              console.log('Payment success:', result);
              // Segera perbarui status order menjadi Diproses
              try {
                await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'Diproses' })
                });
              } catch (e) {
                console.error(e);
              }

              clearCart();
              setCheckoutResult({
                title: 'Pembayaran Berhasil!',
                message: `Terima kasih, ${user?.name}. Pembayaran Anda telah terverifikasi dan pesanan sedang diproses.`,
                icon: 'fa-solid fa-circle-check',
                iconColor: 'bg-green-100 text-green-500',
                orderId: orderId
              });
              setIsSuccess(true);
            },
            onPending: function (result) {
              console.log('Payment pending:', result);
              clearCart();
              setCheckoutResult({
                title: 'Menunggu Pembayaran',
                message: `Tagihan pesanan Anda telah dibuat. Silakan selesaikan pembayaran sesuai metode yang Anda pilih di halaman Profil.`,
                icon: 'fa-solid fa-clock-rotate-left',
                iconColor: 'bg-amber-100 text-amber-600',
                orderId: orderId
              });
              setIsSuccess(true);
            },
            onError: async function (result) {
              console.error('Payment error:', result);
              // Hapus order yang gagal agar tidak menumpuk di database
              try {
                await fetch(`http://localhost:5000/api/orders/${orderId}`, { method: 'DELETE' });
              } catch (e) {
                console.error(e);
              }
              alert('Pembayaran gagal atau ditolak. Produk tetap berada di keranjang Anda.');
              setIsSuccess(false);
            },
            onClose: async function () {
              console.log('Payment window closed by user');
              // User membatalkan pembayaran: hapus order yang belum dibayar
              try {
                await fetch(`http://localhost:5000/api/orders/${orderId}`, { method: 'DELETE' });
              } catch (e) {
                console.error(e);
              }
              // JANGAN kosongkan keranjang dan JANGAN munculkan modal sukses
              setIsSuccess(false);
              alert('Pembayaran dibatalkan. Produk tetap tersimpan di keranjang Anda.');
            }
          });
        } else {
          // Fallback jika tidak menggunakan Midtrans
          clearCart(); 
          setCheckoutResult({
            title: 'Checkout Berhasil!',
            message: `Terima kasih, ${user?.name}. Pesanan Anda sedang diproses.`,
            icon: 'fa-solid fa-check-to-slot',
            iconColor: 'bg-green-100 text-green-500',
            orderId: orderId
          });
          setIsSuccess(true); 
        }
      } else {
        alert(data.error || 'Gagal memproses pesanan. Silakan coba lagi.');
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
          <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner ${checkoutResult.iconColor}`}>
            <i className={checkoutResult.icon}></i>
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">{checkoutResult.title}</h2>
          <p className="text-gray-500 text-sm mb-6">
            {checkoutResult.message}
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-8">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">ID Pesanan Anda</p>
            <p className="text-xl font-bold text-brand-700">#ORD-{checkoutResult.orderId}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                setIsSuccess(false);
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
