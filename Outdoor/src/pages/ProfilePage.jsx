// src/pages/ProfilePage.jsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ImageCropModal } from '../components/ImageCropModal';

export const ProfilePage = () => {
  const { user, updateUser, logout } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('pembelian');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [payingPenaltyOrderId, setPayingPenaltyOrderId] = useState(null);

  const [returnInputActive, setReturnInputActive] = useState({}); 
  const [resiValues, setResiValues] = useState({}); 

  // --- STATE ULASAN / RATING PEMANDU ---
  const [reviewFormOpen, setReviewFormOpen] = useState({});
  const [reviewRatings, setReviewRatings] = useState({});
  const [reviewComments, setReviewComments] = useState({});
  const [submittingReviewKey, setSubmittingReviewKey] = useState(null);

  // --- STATE EDIT PROFIL & UPLOAD/CROP FOTO ---
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    nik: '',
    bank_name: 'BCA',
    bank_account: '',
    city: '',
    address: '',
    shoe_size: '',
    hiking_level: 'Pemula',
    avatar_url: '',
    new_password: ''
  });
  const avatarFileInputRef = useRef(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageToCrop, setRawImageToCrop] = useState('');

  // --- STATE HAPUS AKUN (KHUSUS USER BIASA / CUSTOMER) ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  const openEditProfileModal = () => {
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      nik: user.nik || '',
      bank_name: user.bank_name || 'BCA',
      bank_account: user.bank_account || '',
      city: user.city || '',
      address: user.address || '',
      shoe_size: user.shoe_size || '',
      hiking_level: user.hiking_level || 'Pemula',
      avatar_url: user.avatar_url || '',
      new_password: ''
    });
    setIsEditProfileOpen(true);
  };

  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageToCrop(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const response = await fetch(`http://localhost:5000/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      const data = await response.json();
      if (response.ok) {
        updateUser(data.user);
        setIsEditProfileOpen(false);
        alert(data.message || 'Profil berhasil diperbarui!');
      } else {
        alert(data.error || 'Gagal memperbarui profil.');
      }
    } catch (err) {
      console.error('Error save profile:', err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (user.role === 'admin') return;
    if (deleteConfirmText.trim().toUpperCase() !== 'HAPUS') {
      alert('Mohon ketik kata HAPUS untuk mengonfirmasi penghapusan akun.');
      return;
    }

    setDeletingAccount(true);
    try {
      const response = await fetch(`http://localhost:5000/api/users/${user.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Akun Anda berhasil dihapus.');
        setIsDeleteModalOpen(false);
        clearCart();
        logout();
        navigate('/');
      } else {
        alert(data.error || 'Gagal menghapus akun.');
      }
    } catch (err) {
      console.error('Error delete account:', err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setDeletingAccount(false);
    }
  };

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
      case 'Dikembalikan (Ada Kerusakan)':
        return 'bg-red-100 text-red-700 border border-red-200';
      case 'Dikirim':
      case 'Guide Terkonfirmasi':
        return 'bg-blue-100 text-blue-700';
      case 'Sedang Disewa':
      case 'Sedang Mendaki': 
        return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
      case 'Dalam Pengiriman Kembali':
      case 'Menunggu Konfirmasi Admin': 
      case 'Diproses':
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
            // Kosongkan keranjang & beri tahu halaman katalog bahwa pembayaran sukses
            clearCart();
            window.dispatchEvent(new Event('outdoor-order-paid'));
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

  // --- BAYAR TAGIHAN DENDA KETERLAMBATAN / KERUSAKAN (MELALUI MIDTRANS SNAP) ---
  const handlePayPenalty = async (order) => {
    setPayingPenaltyOrderId(order.id);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order.id}/pay-penalty`, {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok && data.snap_token && window.snap) {
        window.snap.pay(data.snap_token, {
          onSuccess: async function (result) {
            console.log('Penalty payment success:', result);
            await fetch(`http://localhost:5000/api/orders/${order.id}/penalty-paid`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' }
            });
            alert('Pembayaran tagihan denda berhasil dilunasi! Akun Anda kini bebas dari tunggakan.');
            fetchOrders();
          },
          onPending: function () {
            alert('Menunggu pembayaran denda. Silakan selesaikan pembayaran sesuai instruksi.');
            fetchOrders();
          },
          onError: function () {
            alert('Pembayaran denda gagal atau terjadi kesalahan.');
          },
          onClose: function () {
            console.log('Penalty popup closed');
          }
        });
      } else {
        alert(data.error || 'Gagal memuat pembayaran tagihan denda.');
      }
    } catch (err) {
      console.error('Error pay penalty:', err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setPayingPenaltyOrderId(null);
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
      
      {/* KARTU PROFIL UTAMA */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

        {/* Avatar dengan tombol ganti cepat */}
        <div className="relative group flex-shrink-0 z-10">
          <div className="h-24 w-24 rounded-full bg-brand-100 flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <i className="fa-solid fa-user text-4xl text-brand-600"></i>
            )}
          </div>
          <button
            type="button"
            onClick={openEditProfileModal}
            title="Ganti Foto & Edit Profil"
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-md flex items-center justify-center text-xs transition border-2 border-white"
          >
            <i className="fa-solid fa-camera"></i>
          </button>
        </div>
        
        <div className="text-center sm:text-left flex-grow relative z-10 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-0.5">{user.name}</h1>
              <p className="text-gray-500 text-sm mb-2">{user.email}</p>
              <span className={`font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wide ${user.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {user.role}
              </span>
            </div>

            {/* TOMBOL AKSI PROFIL: EDIT PROFIL (SEMUA) & HAPUS AKUN (KHUSUS USER BIASA / BUKAN ADMIN) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
              <button
                type="button"
                onClick={openEditProfileModal}
                className="bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white border border-brand-200 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs"
              >
                <i className="fa-solid fa-user-pen"></i> Edit Profil
              </button>

              {user.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmText('');
                    setIsDeleteModalOpen(true);
                  }}
                  className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs"
                >
                  <i className="fa-solid fa-user-xmark"></i> Hapus Akun
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-6 text-sm border-t border-gray-100 pt-4">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">No. HP / WA</p>
              <p className="text-gray-800 font-medium">{user.phone || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">NIK KTP (Jaminan)</p>
              <p className="text-gray-800 font-mono text-xs font-bold">{user.nik || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Rekening Refund / Tagih</p>
              <p className="text-gray-800 font-medium text-xs">
                {user.bank_account ? `${user.bank_name || 'Bank'} • ${user.bank_account}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Kota Domisili</p>
              <p className="text-gray-800 font-medium">{user.city || '-'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Level Pendaki</p>
              <p className="text-gray-800 font-medium">{user.hiking_level || 'Pemula'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Ukuran Sepatu</p>
              <p className="text-gray-800 font-medium">{user.shoe_size || '-'}</p>
            </div>
            {user.address && (
              <div className="col-span-2 sm:col-span-2 pt-1">
                <p className="text-gray-400 text-xs font-bold uppercase mb-0.5">Alamat Lengkap</p>
                <p className="text-gray-700 text-xs">{user.address}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PERINGATAN TAGIHAN DENDA KETERLAMBATAN / KERUSAKAN YANG BELUM LUNAS */}
      {orders.some(o => Number(o.penalty_bill || 0) > 0 && o.penalty_status !== 'Lunas') && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 text-lg">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-red-900 uppercase tracking-wide">
                Anda Memiliki Tagihan Denda Sewa yang Belum Lunas!
              </h3>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                Terdapat denda keterlambatan pengembalian (2%/hari) atau kerusakan unit yang melebihi saldo deposito Anda. Mohon lunasi tagihan di tab <b>Riwayat Penyewaan</b> agar akun Anda dapat melakukan transaksi baru kembali.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('penyewaan')}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition flex-shrink-0"
          >
            Lihat & Bayar Tagihan
          </button>
        </div>
      )}

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
                            {order.order_type === 'sewa' && Number(item.deposit_per_unit || 0) > 0 && (
                              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                                <i className="fa-solid fa-shield-halved mr-1"></i>
                                Deposito Jaminan: Rp {Number(item.deposit_per_unit).toLocaleString('id-ID')}/unit
                                {order.stock_returned && (
                                  <span className="ml-2">
                                    • Bagus: <b>{Math.max(0, Number(item.quantity || 1) - Number(item.damaged_qty || 0))}</b>
                                    {Number(item.damaged_qty || 0) > 0 && (
                                      <span className="text-red-600 font-bold"> • Rusak: {item.damaged_qty} unit</span>
                                    )}
                                  </span>
                                )}
                              </p>
                            )}
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

                  {/* KOTAK INFORMASI DEPOSITO JAMINAN SEWA, DENDA KETERLAMBATAN (2%/HARI) & TAGIHAN DENDA */}
                  {order.order_type === 'sewa' && (
                    <div className={`rounded-2xl p-4 border text-xs space-y-2.5 ${
                      Number(order.penalty_bill || 0) > 0 && order.penalty_status !== 'Lunas'
                        ? 'bg-red-50/90 border-red-300 text-red-900'
                        : order.deposit_status === 'Dikembalikan 100%' || order.deposit_status === 'Tidak Ada Deposito (Lunas)'
                          ? 'bg-green-50/70 border-green-200 text-green-900'
                          : order.deposit_status === 'Hangus Total (Barang Rusak)'
                            ? 'bg-red-50/70 border-red-200 text-red-900'
                            : order.deposit_status === 'Dikembalikan Sebagian'
                              ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                              : 'bg-blue-50/60 border-blue-200 text-blue-900'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <i className="fa-solid fa-shield-halved"></i>
                          Rincian Deposito Jaminan Sewa & Denda Pengembalian
                        </span>
                        <span className="font-black px-2.5 py-0.5 rounded-full bg-white/80 border border-current/20 text-[11px]">
                          Status: {order.deposit_status || (Number(order.deposit_amount || 0) > 0 ? 'Ditahan' : 'Tanpa Deposito (Sewa ≥ 50%)')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-current/10">
                        <div>
                          <span className="text-[10px] opacity-75 block">Total Deposito Anda</span>
                          <span className="font-bold text-sm">
                            Rp {Number(order.deposit_amount || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                        {order.stock_returned && (
                          <>
                            <div>
                              <span className="text-[10px] opacity-75 block">Potongan dari Deposito</span>
                              <span className="font-bold text-sm text-red-600">
                                - Rp {Number(order.deposit_forfeited || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] opacity-75 block">Deposito Dikembalikan (Refund)</span>
                              <span className="font-black text-sm text-green-700">
                                Rp {Number(order.deposit_refunded || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Rincian Denda Keterlambatan (2% / Hari) jika ada */}
                      {Number(order.late_days || 0) > 0 && (
                        <div className="bg-white/85 rounded-xl p-2.5 border border-amber-300 text-amber-900 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span>
                            <i className="fa-solid fa-clock mr-1.5 text-amber-600"></i>
                            <b>Denda Keterlambatan Pengembalian:</b> Terlambat <b>{order.late_days} hari</b> (2% / hari dari harga asli barang)
                          </span>
                          <span className="font-black text-red-600">
                            Rp {Number(order.late_fee || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}

                      {/* Keterangan Inspeksi Admin */}
                      {order.damage_note && (
                        <div className="bg-white/80 rounded-xl p-2.5 border border-red-200 text-red-700 text-[11px]">
                          <b><i className="fa-solid fa-triangle-exclamation mr-1"></i>Keterangan Inspeksi Admin:</b> {order.damage_note}
                        </div>
                      )}

                      {/* Tagihan Denda Kekurangan (Jika Deposito Rp 0 atau Tidak Cukup) */}
                      {Number(order.penalty_bill || 0) > 0 && (
                        <div className={`rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          order.penalty_status === 'Lunas'
                            ? 'bg-green-100/80 border-green-300 text-green-900'
                            : 'bg-red-100/90 border-red-400 text-red-900'
                        }`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black uppercase text-xs flex items-center gap-1">
                                <i className="fa-solid fa-file-invoice-dollar"></i>
                                Tagihan Denda Kekurangan: Rp {Number(order.penalty_bill).toLocaleString('id-ID')}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                order.penalty_status === 'Lunas'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-red-600 text-white animate-pulse'
                              }`}>
                                {order.penalty_status || 'Belum Lunas'}
                              </span>
                            </div>
                            <p className="text-[11px] mt-0.5 opacity-90">
                              {order.penalty_status === 'Lunas'
                                ? 'Terima kasih, tagihan denda keterlambatan/kerusakan pada pesanan ini telah dilunasi.'
                                : 'Total denda melebihi saldo deposito yang ditahan. Silakan lunasi tagihan ini melalui Midtrans.'}
                            </p>
                          </div>

                          {order.penalty_status !== 'Lunas' && (
                            <button
                              type="button"
                              onClick={() => handlePayPenalty(order)}
                              disabled={payingPenaltyOrderId === order.id}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 flex-shrink-0"
                            >
                              <i className="fa-solid fa-credit-card"></i>
                              {payingPenaltyOrderId === order.id ? 'Memuat Midtrans...' : 'Bayar Tagihan Denda'}
                            </button>
                          )}
                        </div>
                      )}
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

      {/* MODAL EDIT PROFIL (UNTUK USER & ADMIN) */}
      {isEditProfileOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
          onClick={() => setIsEditProfileOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <i className="fa-solid fa-user-pen text-brand-600"></i> Edit Profil Saya
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Perbarui foto profil, informasi kontak, dan detail akun Anda.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Foto Profil + Upload & Crop */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-brand-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0">
                  {profileForm.avatar_url ? (
                    <img src={profileForm.avatar_url} alt="Avatar Preview" className="h-full w-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-user text-3xl text-brand-600"></i>
                  )}
                </div>

                <div className="flex-grow space-y-2 w-full">
                  <label className="block text-xs font-bold text-gray-600 uppercase">Foto Profil (Link URL atau Upload File)</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    >
                      <i className="fa-solid fa-upload"></i> Upload & Crop Foto
                    </button>
                    {profileForm.avatar_url && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRawImageToCrop(profileForm.avatar_url);
                            setCropModalOpen(true);
                          }}
                          className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="fa-solid fa-crop-simple"></i> Crop Ulang
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfileForm({ ...profileForm, avatar_url: '' })}
                          className="bg-white hover:bg-red-50 text-red-600 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl transition"
                          title="Hapus Foto"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Atau tempel link gambar (https://...)"
                    value={profileForm.avatar_url?.startsWith('data:image') ? '' : profileForm.avatar_url}
                    onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Informasi Dasar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No. HP / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="081234567890"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">NIK KTP (Jaminan Sewa)</label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="16 Digit NIK KTP"
                    value={profileForm.nik}
                    onChange={(e) => setProfileForm({ ...profileForm, nik: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bank / E-Wallet (Refund & Tagih)</label>
                  <select
                    value={profileForm.bank_name}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="BCA">BCA</option>
                    <option value="Mandiri">Bank Mandiri</option>
                    <option value="BNI">BNI</option>
                    <option value="BRI">BRI</option>
                    <option value="BSI">BSI</option>
                    <option value="GoPay">GoPay</option>
                    <option value="OVO">OVO</option>
                    <option value="DANA">DANA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No. Rekening / E-Wallet</label>
                  <input
                    type="text"
                    placeholder="Nomor Rekening"
                    value={profileForm.bank_account}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_account: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kota Domisili</label>
                  <input
                    type="text"
                    placeholder="Contoh: Bandung"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Level Pendaki</label>
                  <select
                    value={profileForm.hiking_level}
                    onChange={(e) => setProfileForm({ ...profileForm, hiking_level: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="Pemula">Pemula</option>
                    <option value="Menengah">Menengah</option>
                    <option value="Pro / Expert">Pro / Expert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ukuran Sepatu</label>
                  <input
                    type="text"
                    placeholder="Contoh: 42"
                    value={profileForm.shoe_size}
                    onChange={(e) => setProfileForm({ ...profileForm, shoe_size: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</label>
                <textarea
                  rows="2"
                  placeholder="Jl. Contoh No. 123..."
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white resize-none"
                />
              </div>

              <div className="border-t border-dashed border-gray-200 pt-3">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Ganti Kata Sandi Baru <span className="text-gray-400 font-normal">(Kosongkan jika tidak ingin mengubah)</span>
                </label>
                <input
                  type="password"
                  placeholder="Masukkan kata sandi baru..."
                  value={profileForm.new_password}
                  onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CROP FOTO PROFIL */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageToCrop}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={(croppedDataUrl) => setProfileForm((prev) => ({ ...prev, avatar_url: croppedDataUrl }))}
      />

      {/* MODAL KONFIRMASI HAPUS AKUN (HANYA UNTUK USER BIASA / NON-ADMIN) */}
      {isDeleteModalOpen && user.role !== 'admin' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl mb-4 mx-auto">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Hapus Akun Secara Permanen?</h3>
            <p className="text-xs text-gray-500 text-center leading-relaxed mb-4">
              Tindakan ini tidak dapat dibatalkan. Seluruh data profil Anda (<b>{user.email}</b>) akan dihapus secara permanen dari sistem Outdoor Warrent.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 mb-4">
              <i className="fa-solid fa-circle-info mr-1"></i>
              <b>Catatan Keamanan:</b> Akun tidak dapat dihapus apabila Anda masih memiliki barang sewaan yang belum dikembalikan atau jadwal pendakian aktif yang sedang berjalan.
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                Ketik <span className="text-red-600 font-black">HAPUS</span> di bawah ini untuk mengonfirmasi:
              </label>
              <input
                type="text"
                placeholder="Ketik HAPUS"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 outline-none focus:border-red-500 uppercase"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== 'HAPUS'}
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-trash-can"></i>
                {deletingAccount ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
    </div>
  );
};
