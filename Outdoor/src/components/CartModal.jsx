// src/components/CartModal.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
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

  // Hitung subtotal harga sewa/beli dan total deposito jaminan sewa (50% nilai barang)
  const baseSubtotal = cartItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);
  const hasRentItems = cartItems.some(item => item.type === 'sewa');
  const totalOriginalRentValue = cartItems.reduce((sum, item) => {
    if (item.type !== 'sewa') return sum;
    return sum + Number(item.original_price || 0) * Number(item.qty || 1);
  }, 0);
  const totalDeposit = cartItems.reduce((sum, item) => {
    if (item.type !== 'sewa') return sum;
    const origPrice = Number(item.original_price || 0);
    const rentPrice = Number(item.price || 0);
    const depPerUnit = item.deposit_per_unit !== undefined
      ? Number(item.deposit_per_unit)
      : Math.max(0, Math.round(0.5 * origPrice - rentPrice));
    return sum + depPerUnit * Number(item.qty || 1);
  }, 0);
  const grandTotal = baseSubtotal + totalDeposit;

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    
    if (!user) {
      alert('Silakan Login atau Daftar terlebih dahulu untuk melanjutkan pembayaran.');
      onClose();
      return;
    }

    const distinctTypes = Array.from(new Set(cartItems.map(item => item.type || 'beli')));
    if (distinctTypes.length > 1) {
      alert('Mohon pisahkan checkout antara Pembelian Alat, Penyewaan Alat, dan Booking Guide agar pelacakan status dan stok akurat.');
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders`, {
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

        if (data.snap_token && window.snap) {
          window.snap.pay(data.snap_token, {
            onSuccess: async function (result) {
              console.log('Payment success:', result);
              try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/${orderId}/status`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'Diproses' })
                });
              } catch (e) {
                console.error(e);
              }

              clearCart();
              window.dispatchEvent(new Event('outdoor-order-paid'));

              setCheckoutResult({
                title: 'Pembayaran Berhasil!',
                message: totalDeposit > 0
                  ? `Terima kasih, ${user?.name}. Pembayaran sewa beserta Deposito Jaminan (Rp ${totalDeposit.toLocaleString('id-ID')}) telah diterima. Deposito akan dikembalikan 100% saat barang kembali dalam kondisi baik.`
                  : `Terima kasih, ${user?.name}. Pembayaran Anda telah terverifikasi dan pesanan sedang diproses.`,
                icon: 'fa-solid fa-circle-check',
                iconColor: 'bg-green-100 text-green-500',
                orderId: orderId
              });
              setIsSuccess(true);
            },
            onPending: function (result) {
              console.log('Payment pending:', result);
              setCheckoutResult({
                title: 'Menunggu Pembayaran',
                message: `Tagihan pesanan #ORD-${orderId} telah dibuat. Keranjang hanya akan dikosongkan dan stok/jadwal baru akan dikunci setelah pembayaran Anda selesai.`,
                icon: 'fa-solid fa-clock-rotate-left',
                iconColor: 'bg-amber-100 text-amber-600',
                orderId: orderId
              });
              setIsSuccess(true);
            },
            onError: async function (result) {
              console.error('Payment error:', result);
              try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/${orderId}`, { method: 'DELETE' });
              } catch (e) {
                console.error(e);
              }
              alert('Pembayaran gagal atau ditolak. Produk tetap berada di keranjang Anda.');
              setIsSuccess(false);
            },
            onClose: async function () {
              console.log('Payment window closed by user');
              try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/${orderId}`, { method: 'DELETE' });
              } catch (e) {
                console.error(e);
              }
              setIsSuccess(false);
              alert('Pembayaran belum diselesaikan. Produk tetap tersimpan di keranjang Anda.');
            }
          });
        } else {
          clearCart(); 
          window.dispatchEvent(new Event('outdoor-order-paid'));
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
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 fade-in">
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
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
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
            cartItems.map((item) => {
              const origPrice = Number(item.original_price || 0);
              const rentPrice = Number(item.price || 0);
              const itemDepPerUnit = item.type === 'sewa'
                ? (item.deposit_per_unit !== undefined ? Number(item.deposit_per_unit) : Math.max(0, Math.round(0.5 * origPrice - rentPrice)))
                : 0;

              return (
                <div key={`${item.type}-${item.id}`} className="py-4 flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-grow">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${item.type === 'sewa' ? 'bg-orange-50 text-orange-700' : item.type === 'booking' ? 'bg-blue-50 text-blue-700' : 'bg-brand-50 text-brand-700'}`}>
                        {item.type === 'sewa' ? 'Sewa Alat' : item.type === 'booking' ? 'Booking Guide' : 'Beli Alat'}
                      </span>
                      <h4 className="font-bold text-gray-800 text-sm truncate mt-1">{item.name}</h4>
                      <p className="text-xs text-gray-500">
                        Rp {item.price.toLocaleString('id-ID')} per unit
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

                  {/* Info Deposito per item sewa */}
                  {item.type === 'sewa' && origPrice > 0 && (
                    <div className={`rounded-xl px-3 py-2 text-[11px] flex items-center justify-between border ${
                      itemDepPerUnit > 0
                        ? 'bg-amber-50/80 border-amber-200/80 text-amber-900'
                        : 'bg-green-50/80 border-green-200/80 text-green-800'
                    }`}>
                      <span>
                        <i className={`fa-solid fa-shield-halved mr-1.5 ${itemDepPerUnit > 0 ? 'text-amber-600' : 'text-green-600'}`}></i>
                        {itemDepPerUnit > 0
                          ? `Deposito Jaminan 50% Harga Barang (${item.qty} unit × Rp ${itemDepPerUnit.toLocaleString('id-ID')})`
                          : `Deposito Rp 0 (Biaya sewa sudah ≥ 50% harga barang Rp ${(0.5 * origPrice).toLocaleString('id-ID')}/unit)`}
                      </span>
                      <span className="font-bold">
                        {itemDepPerUnit > 0 ? `+Rp ${(itemDepPerUnit * item.qty).toLocaleString('id-ID')}` : 'Rp 0'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-3">
            {hasRentItems && (
              <div className="bg-white rounded-xl p-3 border border-amber-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal Biaya Sewa Alat</span>
                  <span className="font-bold text-gray-800">Rp {baseSubtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>
                    <i className="fa-solid fa-shield-halved mr-1 text-amber-600"></i>
                    Deposito Jaminan (50% Nilai Barang)
                  </span>
                  <span className="font-bold">
                    {totalDeposit > 0 ? `+Rp ${totalDeposit.toLocaleString('id-ID')}` : 'Rp 0 (Terpenuhi dari Sewa)'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 pt-1 border-t border-dashed border-gray-200 leading-relaxed">
                  *Deposito dikembalikan 100% jika barang kembali aman & tepat waktu. Keterlambatan pengembalian dikenakan denda <b>2% per hari</b> dari harga asli barang{totalOriginalRentValue > 0 ? ` (Rp ${Math.round(0.02 * totalOriginalRentValue).toLocaleString('id-ID')}/hari)` : ''}.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm font-semibold">Total Pembayaran</span>
              <span className="text-xl font-black text-brand-700">Rp {grandTotal.toLocaleString('id-ID')}</span>
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
    </div>,
    document.body
  );
};
