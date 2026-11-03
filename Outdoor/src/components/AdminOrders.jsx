// src/components/AdminOrders.jsx
import { useState, useEffect } from 'react';

export const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); 

  const fetchAllOrders = () => {
    fetch('http://localhost:5000/api/orders/all')
      .then(res => res.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Gagal memuat pesanan:', err);
        setOrders([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchAllOrders();
        alert(`Status Pesanan #${orderId} berhasil diubah menjadi ${newStatus}`);
      } else {
        alert('Gagal memperbarui status.');
      }
    } catch (error) {
      console.error('Update status error:', error);
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'Selesai':
      case 'Dikembalikan':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Dikirim':
      case 'Sedang Disewa':
      case 'Guide Terkonfirmasi':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Dalam Pengiriman Kembali':
      case 'Sedang Mendaki':
      case 'Menunggu Konfirmasi Admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Dibatalkan':
      case 'Reschedule/Ditolak':
        return 'bg-red-50 text-red-700 border-red-200';
      default: 
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'all') return true;
    return order.order_type === activeFilter;
  });

  if (loading) return <div className="text-center py-10 text-gray-500 font-bold">Memuat data pesanan...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden fade-in">
      <div className="p-6 border-b border-gray-100 bg-brand-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Pesanan Masuk</h2>
          <p className="text-xs text-gray-500 mt-0.5">Kelola dan pantau seluruh transaksi pelanggan berdasarkan tipe layanan.</p>
        </div>
        <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
          {filteredOrders.length} dari {orders.length} Pesanan Ditampilkan
        </span>
      </div>

      {/* TOMBOL FILTER KATEGORI PESANAN */}
      <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Filter Tipe:</span>
        <button 
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'all' ? 'bg-brand-600 text-white shadow-brand-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Semua ({orders.length})
        </button>
        <button 
          onClick={() => setActiveFilter('beli')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'beli' ? 'bg-brand-600 text-white shadow-brand-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Pembelian ({orders.filter(o => o.order_type === 'beli').length})
        </button>
        <button 
          onClick={() => setActiveFilter('sewa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'sewa' ? 'bg-orange-600 text-white shadow-orange-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Penyewaan ({orders.filter(o => o.order_type === 'sewa').length})
        </button>
        <button 
          onClick={() => setActiveFilter('booking')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'booking' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Booking Pemandu ({orders.filter(o => o.order_type === 'booking').length})
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold border-b">ID Order</th>
              <th className="p-4 font-bold border-b">Tanggal</th>
              <th className="p-4 font-bold border-b">Pelanggan</th>
              <th className="p-4 font-bold border-b">Detail Item Pesanan</th>
              <th className="p-4 font-bold border-b">Tipe & Resi</th>
              <th className="p-4 font-bold border-b">Total (Rp)</th>
              <th className="p-4 font-bold border-b">Status & Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-12 text-center text-gray-400">
                  <i className="fa-solid fa-filter-circle-xmark text-4xl mb-2 text-gray-300 block"></i>
                  Tidak ada pesanan untuk kategori ini.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition align-top">
                  <td className="p-4 font-bold text-gray-700 whitespace-nowrap">#ORD-{order.id}</td>
                  <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(order.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <p className="text-sm font-bold text-gray-800">{order.customer_name || 'Tanpa Nama'}</p>
                    <p className="text-xs text-gray-500">{order.customer_email || '-'}</p>
                  </td>
                  
                  <td className="p-4 max-w-sm">
                    <div className="flex flex-col gap-2">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                  <i className="fa-solid fa-image"></i>
                                </div>
                              )}
                            </div>
                            <div className="text-xs min-w-0">
                              <p className="font-bold text-gray-800 truncate">{item.name || 'Produk'}</p>
                              <p className="text-gray-500 mt-0.5">{item.quantity || item.qty || 1}x @ Rp {Number(item.price_at_time || 0).toLocaleString('id-ID')}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">Tidak ada rincian item</span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                       <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        order.order_type === 'sewa' ? 'bg-orange-100 text-orange-700' : 
                        order.order_type === 'booking' ? 'bg-blue-100 text-blue-700' : 
                        'bg-brand-100 text-brand-700'
                      }`}>
                        {order.order_type === 'booking' ? 'Jasa Pemandu' : order.order_type}
                      </span>
                      {order.return_resi && (
                        <span className="text-[11px] font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                          Resi: {order.return_resi}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-4 font-bold text-gray-800 whitespace-nowrap">
                    Rp {Number(order.total_price).toLocaleString('id-ID')}
                  </td>

                  <td className="p-4 whitespace-nowrap">
                    <select 
                      value={order.status || (order.order_type === 'booking' ? 'Menunggu Konfirmasi Admin' : 'Menunggu Pembayaran')}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`text-sm font-bold px-3 py-1.5 rounded-lg outline-none border cursor-pointer ${getStatusStyle(order.status || (order.order_type === 'booking' ? 'Menunggu Konfirmasi Admin' : 'Menunggu Pembayaran'))}`}
                    >
                      {order.order_type === 'booking' ? (
                        <>
                           <option value="Menunggu Konfirmasi Admin">Menunggu Konfirmasi Admin</option>
                           <option value="Guide Terkonfirmasi">Guide Terkonfirmasi</option>
                           <option value="Sedang Mendaki">Sedang Mendaki</option>
                           <option value="Selesai">Selesai</option>
                           <option value="Reschedule/Ditolak">Reschedule/Ditolak</option>
                        </>
                      ) : order.order_type === 'sewa' ? (
                        <>
                           <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
                           <option value="Diproses">Diproses</option>
                           <option value="Sedang Disewa">Sedang Disewa</option>
                           <option value="Dalam Pengiriman Kembali">Dalam Pengiriman Kembali</option>
                           <option value="Dikembalikan">Dikembalikan</option>
                           <option value="Dibatalkan">Dibatalkan</option>
                        </>
                      ) : (
                        <>
                           <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
                           <option value="Diproses">Diproses</option>
                           <option value="Dikirim">Dikirim</option>
                           <option value="Selesai">Selesai</option>
                           <option value="Dibatalkan">Dibatalkan</option>
                        </>
                      )}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};