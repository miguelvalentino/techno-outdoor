// src/components/AdminOrders.jsx
import { useState, useEffect } from 'react';

export const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllOrders = () => {
    fetch('http://localhost:5000/api/orders/all')
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Gagal memuat pesanan:', err);
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
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Dalam Pengiriman Kembali':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Dibatalkan':
        return 'bg-red-50 text-red-700 border-red-200';
      default: 
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  if (loading) return <div className="text-center py-10">Memuat data pesanan...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden fade-in">
      <div className="p-6 border-b border-gray-100 bg-brand-50 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Manajemen Pesanan Masuk</h2>
        <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
          {orders.length} Pesanan
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-bold border-b">ID Order</th>
              <th className="p-4 font-bold border-b">Tanggal</th>
              <th className="p-4 font-bold border-b">Pelanggan</th>
              <th className="p-4 font-bold border-b">Tipe & Resi</th>
              <th className="p-4 font-bold border-b">Total (Rp)</th>
              <th className="p-4 font-bold border-b">Status & Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-10 text-center text-gray-400">Belum ada pesanan masuk.</td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-bold text-gray-700">#ORD-{order.id}</td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold text-gray-800">{order.customer_name || 'Tanpa Nama'}</p>
                    <p className="text-xs text-gray-500">{order.customer_email || '-'}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${order.order_type === 'sewa' ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-700'}`}>
                        {order.order_type}
                      </span>
                      {order.return_resi && (
                        <span className="text-[11px] font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                          Resi: {order.return_resi}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-gray-800">
                    {Number(order.total_price).toLocaleString('id-ID')}
                  </td>
                  <td className="p-4">
                    <select 
                      value={order.status || 'Diproses'}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`text-sm font-bold px-3 py-1.5 rounded-lg outline-none border cursor-pointer ${getStatusStyle(order.status)}`}
                    >
                      <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
                      <option value="Diproses">Diproses</option>
                      
                      {order.order_type === 'sewa' ? (
                        <>
                          <option value="Sedang Disewa">Sedang Disewa</option>
                          <option value="Dalam Pengiriman Kembali">Dalam Pengiriman Kembali</option>
                          <option value="Dikembalikan">Dikembalikan</option>
                        </>
                      ) : (
                        <>
                          <option value="Dikirim">Dikirim</option>
                          <option value="Selesai">Selesai</option>
                        </>
                      )}
                      
                      <option value="Dibatalkan">Dibatalkan</option>
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