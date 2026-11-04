// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 

export const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('pembelian');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState(null);

  const [returnInputActive, setReturnInputActive] = useState({}); 
  const [resiValues, setResiValues] = useState({}); 

  // --- STATE ULASAN / RATING PEMANDU ---
  const [reviewFormOpen, setReviewFormOpen] = useState({});
  const [reviewRatings, setReviewRatings] = useState({});
  const [reviewComments, setReviewComments] = useState({});
  const [submittingReviewKey, setSubmittingReviewKey] = useState(null);

  const fetchOrders = () => {
    if (!user) return;
    fetch(`http://localhost:5000/api/orders/user/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Gagal memuat riwayat:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchOrders();
  }, [user, navigate]);

  if (!user) return null; 

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pembelian') return order.order_type === 'beli';
    if (activeTab === 'penyewaan') return order.order_type === 'sewa';
    if (activeTab === 'pemandu') return order.order_type === 'booking'; 
    return false;
  });

  const getCustomerStatusStyle = (status) => {
    switch(status) {
      case 'Selesai':
      case 'Dikembalikan':
        return 'bg-green-100 text-green-700';
      case 'Dikirim':
      case 'Guide Terkonfirmasi':
        return 'bg-blue-100 text-blue-700';
      case 'Sedang Disewa':
      case 'Sedang Mendaki': 
        return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
      case 'Dalam Pengiriman Kembali':
      case 'Menunggu Konfirmasi Admin': 
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'Dibatalkan':
      case 'Reschedule/Ditolak':
        return 'bg-red-100 text-red-700';
      case 'Menunggu Pembayaran':
        return 'bg-orange-100 text-orange-700 font-bold border border-orange-200';
      default: 
        return 'bg-orange-100 text-orange-700';
    }
  };

  const handlePayNow = async (order) => {
    setPayingOrderId(order.id);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order.id}/pay`, {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok && data.snap_token && window.snap) {
        window.snap.pay(data.snap_token, {
          onSuccess: async function (result) {
            console.log('Payment success:', result);
            await fetch(`http://localhost:5000/api/orders/${order.id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'Diproses' })
            });
            alert('Pembayaran berhasil diverifikasi! Pesanan Anda sedang diproses.');
            fetchOrders();
          },
          onPending: function (result) {
            console.log('Payment pending:', result);
            alert('Menunggu pembayaran. Silakan selesaikan pembayaran sesuai instruksi yang dipilih.');
            fetchOrders();
          },
          onError: function (result) {
            console.error('Payment error:', result);
            alert('Pembayaran gagal atau terjadi kesalahan.');
          },
          onClose: function () {
            console.log('Payment popup closed');
          }
        });
      } else {
        alert(data.error || 'Gagal memuat jendela pembayaran.');
      }
    } catch (err) {
      console.error('Error pay now:', err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Dibatalkan' })
      });
      if (response.ok) {
        alert('Pesanan berhasil dibatalkan.');
        fetchOrders();
      } else {
        alert('Gagal membatalkan pesanan.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleSubmitReturn = async (orderId) => {
    const resi = resiValues[orderId];
    if (!resi || resi.trim() === '') {
      alert('Mohon masukkan nomor resi pengembalian terlebih dahulu (Contoh: RET-3239)');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'Dalam Pengiriman Kembali',
          return_resi: resi 
        })
      });

      if (response.ok) {
        alert('Nomor resi berhasil dikirim! Status pesanan diperbarui.');
        setReturnInputActive(prev => ({ ...prev, [orderId]: false }));
        fetchOrders(); 
      } else {
        alert('Gagal mengirim nomor resi.');
      }
    } catch (error) {
      console.error('Error submitting return resi:', error);
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleCompleteTrip = async (orderId) => {
    if(!window.confirm("Apakah Anda yakin ingin menyelesaikan perjalanan ini?")) return;

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Selesai' })
      });

      if (response.ok) {
        alert('Perjalanan telah diselesaikan. Silakan berikan rating dan ulasan untuk pemandu Anda!');
        fetchOrders(); 
      } else {
        alert('Gagal menyelesaikan perjalanan.');
      }
    } catch (error) {
      console.error('Error completing trip:', error);
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleSubmitGuideReview = async (orderId, guideId) => {
    if (!guideId) {
      alert('ID Pemandu tidak ditemukan pada pesanan ini.');
      return;
    }
    const key = `${orderId}-${guideId}`;
    const rating = reviewRatings[key] || 5;
    const comment = reviewComments[key] || '';

    setSubmittingReviewKey(key);
    try {
      const response = await fetch(`http://localhost:5000/api/guides/${guideId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          customer_id: user.id,
          customer_name: user.name,
          rating,
          comment
        })
      });
      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Ulasan berhasil dikirim!');
        setReviewFormOpen(prev => ({ ...prev, [key]: false }));
        fetchOrders();
      } else {
        alert(data.error || 'Gagal mengirim ulasan.');
      }
    } catch (err) {
      console.error('Error submit review:', err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSubmittingReviewKey(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex-grow w-full fade-in">
      
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

        <div className="h-24 w-24 rounded-full bg-brand-100 flex items-center justify-center border-4 border-white shadow-md flex-shrink-0 relative z-10">
          <i className="fa-solid fa-user text-4xl text-brand-600"></i>
        </div>
        
        <div className="text-center sm:text-left flex-grow relative z-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{user.name}</h1>
          <p className="text-gray-500 text-sm mb-3">{user.email}</p>
          <span className={`font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wide ${user.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
            {user.role}
          </span>

          <div className="mt-5 grid grid-cols-2 gap-y-3 gap-x-6 text-sm max-w-lg border-t border-gray-100 pt-4">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">No. HP</p>
              <p className="text-gray-800 font-medium">{user.phone || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Kota Domisili</p>
              <p className="text-gray-800 font-medium">{user.city || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Level Pendaki</p>
              <p className="text-gray-800 font-medium">{user.hiking_level || 'Pemula'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('pembelian')}
          className={`py-3 px-4 font-semibold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'pembelian' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Riwayat Pembelian
        </button>
        <button 
          onClick={() => setActiveTab('penyewaan')}
          className={`py-3 px-4 font-semibold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'penyewaan' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Riwayat Penyewaan
        </button>
        <button 
          onClick={() => setActiveTab('pemandu')}
          className={`py-3 px-4 font-semibold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'pemandu' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Booking Pemandu
        </button>
      </div>

      <div>
        {loading ? (
          <div className="text-center py-10 text-gray-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
            <p>Memuat riwayat transaksi...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <i className="fa-solid fa-box-open text-5xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Belum ada transaksi</h3>
            <p className="text-sm text-gray-500">Anda belum memiliki riwayat {activeTab} saat ini.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredOrders.map(order => (
              <div key={order.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-700">Order ID: #ORD-{order.id}</span>
                    <span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getCustomerStatusStyle(order.status)}`}>
                    {order.status || (order.order_type === 'booking' ? 'Menunggu Konfirmasi Admin' : 'Menunggu Pembayaran')}
                  </span>
                </div>
                
                <div className="p-5 flex flex-col gap-4">
                  {order.items.map((item, idx) => {
                    const targetGuideId = item.guide_id || item.product_id;
                    const reviewKey = `${order.id}-${targetGuideId}`;
                    const currentStar = reviewRatings[reviewKey] || 5;
                    const isBookingPaid = order.order_type === 'booking' && !['Menunggu Pembayaran', 'Dibatalkan', 'Reschedule/Ditolak'].includes(order.status);

                    return (
                      <div key={idx} className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="h-16 w-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <i className="fa-solid fa-image h-full w-full flex items-center justify-center text-gray-400"></i>
                            )}
                          </div>
                          
                          <div className="flex-grow min-w-0 flex flex-col justify-center">
                             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-max ${
                              order.order_type === 'sewa' ? 'bg-orange-50 text-orange-700' : 
                              order.order_type === 'booking' ? 'bg-blue-50 text-blue-700' : 
                              'bg-brand-50 text-brand-700'
                            }`}>
                              {order.order_type === 'sewa' ? 'Sewa Alat' : order.order_type === 'booking' ? 'Jasa Pemandu' : 'Beli Alat'}
                            </span>
                            <h4 className="font-bold text-gray-800 text-sm truncate mt-1">{item.name || 'Item Khusus'}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.quantity || item.qty} {order.order_type === 'booking' ? 'Paket' : 'Barang'} x Rp {Number(item.price_at_time || item.price).toLocaleString('id-ID')}
                            </p>
                          </div>

                          {/* Kondisional UI untuk Booking Guide */}
                          {order.order_type === 'booking' && (
                            <div className="sm:w-1/3 flex flex-col justify-center sm:pl-4 sm:border-l border-gray-100 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                              {(order.status === 'Guide Terkonfirmasi' || order.status === 'Sedang Mendaki') ? (
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col gap-2 justify-between">
                                  <p className="text-[10px] text-blue-700 font-bold flex items-center gap-1">
                                    <i className="fa-solid fa-circle-check"></i> Jadwal Dikonfirmasi!
                                  </p>
                                  <a 
                                    href={`https://wa.me/6281234567890?text=Halo, saya ingin koordinasi pesanan #ORD-${order.id}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
                                  >
                                    <i className="fa-brands fa-whatsapp text-sm"></i> Hubungi Guide
                                  </a>
                                  {!item.review && targetGuideId && !reviewFormOpen[reviewKey] && (
                                    <button
                                      type="button"
                                      onClick={() => setReviewFormOpen(prev => ({ ...prev, [reviewKey]: true }))}
                                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                      <i className="fa-solid fa-star"></i> Beri Rating Guide
                                    </button>
                                  )}
                                </div>
                              ) : (order.status === 'Selesai') ? (
                                <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-flag-checkered text-green-500 text-lg"></i>
                                    <div>
                                      <p className="text-[10px] text-green-700 font-bold uppercase">Trip Selesai</p>
                                      <p className="text-[10px] text-green-600 mt-0.5">Terima kasih telah menggunakan jasa kami.</p>
                                    </div>
                                  </div>
                                  {!item.review && targetGuideId && !reviewFormOpen[reviewKey] && (
                                    <button
                                      type="button"
                                      onClick={() => setReviewFormOpen(prev => ({ ...prev, [reviewKey]: true }))}
                                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                      <i className="fa-solid fa-star"></i> Beri Rating Guide
                                    </button>
                                  )}
                                </div>
                              ) : (order.status === 'Reschedule/Ditolak' || order.status === 'Dibatalkan') ? (
                                 <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-2">
                                    <i className="fa-solid fa-circle-xmark text-red-500 text-lg"></i>
                                    <div>
                                      <p className="text-[10px] text-red-700 font-bold uppercase">Tidak Tersedia</p>
                                      <p className="text-[10px] text-red-600 mt-0.5">Silakan hubungi admin untuk refund/reschedule.</p>
                                    </div>
                                 </div>
                              ) : (order.status === 'Menunggu Pembayaran') ? (
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 flex items-center gap-3">
                                  <i className="fa-solid fa-wallet text-orange-500 text-xl"></i>
                                  <div>
                                    <p className="text-[10px] text-orange-700 font-bold uppercase">Menunggu Pembayaran</p>
                                    <p className="text-[10px] text-orange-600 leading-tight mt-0.5">Selesaikan pembayaran agar jadwal guide terkunci di kalender.</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col gap-2">
                                  <div className="flex items-center gap-3">
                                    <i className="fa-solid fa-clock-rotate-left text-brand-600 text-xl"></i>
                                    <div>
                                      <p className="text-[10px] text-gray-700 font-bold uppercase">Pembayaran Diterima ({order.status})</p>
                                      <p className="text-[10px] text-gray-500 leading-tight mt-0.5">Jadwal guide sudah dikunci untuk tanggal pilihan Anda.</p>
                                    </div>
                                  </div>
                                  {!item.review && targetGuideId && !reviewFormOpen[reviewKey] && (
                                    <button
                                      type="button"
                                      onClick={() => setReviewFormOpen(prev => ({ ...prev, [reviewKey]: true }))}
                                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                      <i className="fa-solid fa-star"></i> Beri Rating Guide
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Tampilan Ulasan yang Sudah Dikirim */}
                        {order.order_type === 'booking' && item.review && (
                          <div className="bg-yellow-50/70 border border-yellow-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                  Ulasan Anda untuk Guide
                                </span>
                                <div className="flex items-center gap-0.5 text-yellow-400 text-xs">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <i key={i} className={`${i < Number(item.review.rating) ? 'fa-solid' : 'fa-regular'} fa-star`}></i>
                                  ))}
                                  <span className="text-gray-700 font-bold ml-1">({item.review.rating}/5)</span>
                                </div>
                              </div>
                              {item.review.comment && (
                                <p className="text-xs text-gray-700 italic">"{item.review.comment}"</p>
                              )}
                            </div>
                            <span className="text-[10px] text-green-700 font-bold flex items-center gap-1 flex-shrink-0">
                              <i className="fa-solid fa-circle-check"></i> Tersimpan
                            </span>
                          </div>
                        )}

                        {/* Form Input Rating & Ulasan Guide untuk Penyewa */}
                        {isBookingPaid && !item.review && reviewFormOpen[reviewKey] && (
                          <div className="bg-brand-50/50 border border-brand-200 rounded-2xl p-4 space-y-3 fade-in">
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fa-solid fa-star text-yellow-400"></i>
                                Berikan Penilaian & Ulasan untuk Pemandu Anda
                              </h5>
                              <button
                                type="button"
                                onClick={() => setReviewFormOpen(prev => ({ ...prev, [reviewKey]: false }))}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>

                            {/* Pilihan Bintang 1 - 5 */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-600 mr-1">Rating Anda:</span>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  type="button"
                                  key={star}
                                  onClick={() => setReviewRatings(prev => ({ ...prev, [reviewKey]: star }))}
                                  className="text-xl focus:outline-none transition transform hover:scale-110"
                                >
                                  <i
                                    className={`${
                                      star <= currentStar ? 'fa-solid text-yellow-400' : 'fa-regular text-gray-300'
                                    } fa-star`}
                                  ></i>
                                </button>
                              ))}
                              <span className="text-xs font-bold text-gray-800 ml-1">{currentStar} / 5 Bintang</span>
                            </div>

                            <textarea
                              rows="2"
                              placeholder="Bagikan pengalaman mendaki Anda bersama pemandu ini (keramahan, ketepatan waktu, penguasaan jalur)..."
                              value={reviewComments[reviewKey] || ''}
                              onChange={(e) => setReviewComments(prev => ({ ...prev, [reviewKey]: e.target.value }))}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-brand-500 resize-none"
                            />

                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReviewFormOpen(prev => ({ ...prev, [reviewKey]: false }))}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-4 py-2 rounded-xl transition"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={submittingReviewKey === reviewKey}
                                onClick={() => handleSubmitGuideReview(order.id, targetGuideId)}
                                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-paper-plane"></i>
                                {submittingReviewKey === reviewKey ? 'Mengirim...' : 'Kirim Ulasan'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {order.order_type === 'sewa' && order.return_resi && (
                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl flex items-center justify-between text-xs mt-2">
                      <span className="font-bold text-purple-700"><i className="fa-solid fa-truck-fast mr-1"></i> Resi Pengembalian:</span>
                      <span className="font-mono bg-white px-2 py-1 rounded border border-purple-200 text-purple-900 font-bold">{order.return_resi}</span>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50">
                  <div>
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Pembayaran</span>
                    <span className="text-lg font-black text-gray-900">Rp {Number(order.total_price).toLocaleString('id-ID')}</span>
                  </div>

                  {/* Tombol Aksi Pembayaran jika Status 'Menunggu Pembayaran' */}
                  {order.status === 'Menunggu Pembayaran' && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => handlePayNow(order)}
                        disabled={payingOrderId === order.id}
                        className="flex-1 sm:flex-initial bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2 active:scale-95 disabled:bg-gray-400"
                      >
                        {payingOrderId === order.id ? (
                          <span><i className="fa-solid fa-spinner fa-spin mr-1"></i> Memuat...</span>
                        ) : (
                          <span><i className="fa-solid fa-credit-card mr-1"></i> Bayar Sekarang</span>
                        )}
                      </button>
                      <button 
                        onClick={() => handleCancelOrder(order.id)}
                        className="text-xs font-bold text-gray-500 hover:text-red-600 px-3 py-2.5 rounded-xl hover:bg-red-50 transition border border-gray-200 hover:border-red-200"
                      >
                        Batalkan
                      </button>
                    </div>
                  )}
                  
                  {order.order_type === 'sewa' && order.status === 'Sedang Disewa' && (
                    <div className="w-full sm:w-auto">
                      {!returnInputActive[order.id] ? (
                        <button 
                          onClick={() => setReturnInputActive(prev => ({ ...prev, [order.id]: true }))}
                          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-arrow-rotate-left"></i> Ajukan Pengembalian Barang
                        </button>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                          <input 
                            type="text" 
                            placeholder="Cth: RET-3239"
                            value={resiValues[order.id] || ''}
                            onChange={(e) => setResiValues(prev => ({ ...prev, [order.id]: e.target.value }))}
                            className="text-xs px-3 py-2 border border-gray-300 rounded-xl outline-none font-medium text-gray-800 uppercase"
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleSubmitReturn(order.id)}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                            >
                              Kirim Resi
                            </button>
                            <button 
                              onClick={() => setReturnInputActive(prev => ({ ...prev, [order.id]: false }))}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {order.order_type === 'booking' && order.status === 'Sedang Mendaki' && (
                     <div className="w-full sm:w-auto">
                        <button 
                          onClick={() => handleCompleteTrip(order.id)}
                          className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-flag-checkered"></i> Konfirmasi Trip Selesai
                        </button>
                     </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
};
