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

  const [returnInputActive, setReturnInputActive] = useState({}); 
  const [resiValues, setResiValues] = useState({}); 

  const fetchOrders = () => {
    if (!user) return;
    fetch(`http://localhost:5000/api/orders/user/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
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

  const filteredOrders = orders.filter(order => order.order_type === (activeTab === 'pembelian' ? 'beli' : 'sewa'));

  const getCustomerStatusStyle = (status) => {
    switch(status) {
      case 'Selesai':
      case 'Dikembalikan':
        return 'bg-green-100 text-green-700';
      case 'Dikirim':
        return 'bg-blue-100 text-blue-700';
      case 'Sedang Disewa':
        return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
      case 'Dalam Pengiriman Kembali':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'Dibatalkan':
        return 'bg-red-100 text-red-700';
      default: 
        return 'bg-orange-100 text-orange-700';
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
          className={`py-3 px-4 font-semibold text-sm whitespace-nowrap border-b-2 transition ${activeTab === 'penyewaan' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Riwayat Penyewaan
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
                    {order.status}
                  </span>
                </div>
                
                <div className="p-5 flex flex-col gap-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-center">
                      <div className="h-16 w-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
                        {item.image_url ? (
                          <img src={item.image_url} alt="Produk" className="h-full w-full object-cover" />
                        ) : (
                          <i className="fa-solid fa-image h-full w-full flex items-center justify-center text-gray-400"></i>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm truncate">{item.name || 'Paket / Item Khusus'}</h4>
                        <p className="text-xs text-gray-500">{item.quantity} barang x Rp {Number(item.price_at_time).toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  ))}

                  {/* Menampilkan Resi Pengembalian Jika Sudah Diisi */}
                  {order.return_resi && (
                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl flex items-center justify-between text-xs">
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
                  
                  {/* TOMBOL & KOTAK INPUT RESI KETIKA STATUS "Sedang Disewa" */}
                  {order.status === 'Sedang Disewa' && (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
};