// src/components/AdminOrders.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); 

  // --- STATE MODAL INSPEKSI PENGEMBALIAN SEWA, KETERLAMBATAN (2%/HARI) & DEPOSITO PER-UNIT ---
  const [inspectModalOrder, setInspectModalOrder] = useState(null);
  const [damagedQtyMap, setDamagedQtyMap] = useState({});
  const [lateDaysInput, setLateDaysInput] = useState(0);
  const [damageNote, setDamageNote] = useState('');
  const [submittingInspect, setSubmittingInspect] = useState(false);

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

  const openInspectionModal = (order, presetAllDamaged = false) => {
    const initialMap = {};
    (order.items || []).forEach((it) => {
      const key = it.order_item_id || it.product_id;
      const qty = Number(it.quantity || it.qty || 1);
      initialMap[key] = presetAllDamaged ? qty : Number(it.damaged_qty || 0);
    });
    setDamagedQtyMap(initialMap);
    setLateDaysInput(Number(order.late_days || 0));
    setDamageNote(order.damage_note || '');
    setInspectModalOrder(order);
  };

  const handleStatusChange = async (order, newStatus) => {
    if (
      order.order_type === 'sewa' &&
      (newStatus === 'Dikembalikan' || newStatus === 'Selesai' || newStatus === 'Dikembalikan (Ada Kerusakan)' || newStatus === 'Dikembalikan (Terlambat)') &&
      !order.stock_returned
    ) {
      openInspectionModal(order, newStatus === 'Dikembalikan (Ada Kerusakan)');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchAllOrders();
        alert(`Status Pesanan #ORD-${order.id} berhasil diubah menjadi ${newStatus}`);
      } else {
        alert('Gagal memperbarui status.');
      }
    } catch (error) {
      console.error('Update status error:', error);
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleConfirmInspection = async (e) => {
    e.preventDefault();
    if (!inspectModalOrder) return;
    setSubmittingInspect(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${inspectModalOrder.id}/inspect-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          damaged_items: damagedQtyMap,
          late_days: Number(lateDaysInput || 0),
          damage_note: damageNote
        })
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || 'Inspeksi pengembalian barang sewa berhasil disimpan!');
        setInspectModalOrder(null);
        fetchAllOrders();
      } else {
        alert(data.error || 'Gagal menyimpan hasil inspeksi.');
      }
    } catch (err) {
      console.error('Error confirm inspection:', err);
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSubmittingInspect(false);
    }
  };

  const handleMarkPenaltyPaidByAdmin = async (orderId) => {
    if (!window.confirm(`Tandai tagihan denda pada pesanan #ORD-${orderId} sebagai LUNAS?`)) return;
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/penalty-paid`, {
        method: 'PUT'
      });
      if (response.ok) {
        alert('Tagihan denda berhasil ditandai LUNAS!');
        fetchAllOrders();
      } else {
        alert('Gagal memperbarui status tagihan denda.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'Selesai':
      case 'Dikembalikan':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Dikembalikan (Ada Kerusakan)':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Dikembalikan (Terlambat)':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Dikirim':
      case 'Sedang Disewa':
      case 'Guide Terkonfirmasi':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Dalam Pengiriman Kembali':
      case 'Sedang Mendaki':
      case 'Menunggu Konfirmasi Admin':
      case 'Diproses':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Dibatalkan':
      case 'Reschedule/Ditolak':
        return 'bg-red-50 text-red-700 border-red-200';
      default: 
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const getDepositBadgeStyle = (depStatus) => {
    switch (depStatus) {
      case 'Dikembalikan 100%':
      case 'Denda Lunas':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Dikembalikan Sebagian':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Hangus Total':
      case 'Hangus Total (Barang Rusak)':
      case 'Hangus + Kurang Bayar Denda':
      case 'Tagihan Denda Aktif':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Ditahan':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'all') return true;
    return order.order_type === activeFilter;
  });

  if (loading) return <div className="text-center py-10 text-gray-500 font-bold">Memuat data pesanan...</div>;

  // Hitung ringkasan live untuk modal inspeksi (termasuk Denda Keterlambatan 2%/hari dari harga asli & Tagihan Kekurangan)
  let previewTotalDeposit = 0;
  let previewDamageFine = 0;
  let previewTotalOrigValue = 0;
  let previewGoodUnits = 0;
  let previewDamagedUnits = 0;

  if (inspectModalOrder) {
    previewTotalDeposit = Number(inspectModalOrder.deposit_amount || 0);
    (inspectModalOrder.items || []).forEach((it) => {
      const key = it.order_item_id || it.product_id;
      const qty = Number(it.quantity || it.qty || 1);
      const origPrice = Number(it.original_price || 0);
      previewTotalOrigValue += origPrice * qty;

      const dmg = Math.min(qty, Math.max(0, Number(damagedQtyMap[key] || 0)));
      const good = Math.max(0, qty - dmg);
      previewDamagedUnits += dmg;
      previewGoodUnits += good;

      const unitDamagePenalty = Number(it.deposit_per_unit || 0) > 0
        ? Number(it.deposit_per_unit)
        : Math.round(0.5 * origPrice);
      previewDamageFine += dmg * unitDamagePenalty;
    });
  }

  const dailyLateRate = Math.round(0.02 * previewTotalOrigValue);
  const previewLateFee = Math.round(dailyLateRate * Math.max(0, Number(lateDaysInput || 0)));
  const previewTotalFines = Math.round(previewDamageFine + previewLateFee);
  const previewForfeited = Math.min(previewTotalDeposit, previewTotalFines);
  const previewRefunded = Math.max(0, previewTotalDeposit - previewForfeited);
  const previewPenaltyBill = Math.max(0, previewTotalFines - previewTotalDeposit);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden fade-in">
      <div className="p-5 sm:p-6 border-b border-gray-100 bg-brand-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Manajemen Pesanan Masuk & Inspeksi Deposito Sewa</h2>
          <p className="text-xs text-gray-500 mt-0.5">Kelola seluruh transaksi pelanggan, pengembalian barang sewa, denda keterlambatan (2%/hari), serta pencairan deposito.</p>
        </div>
        <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex-shrink-0">
          {filteredOrders.length} dari {orders.length} Pesanan Ditampilkan
        </span>
      </div>

      {/* TOMBOL FILTER KATEGORI PESANAN */}
      <div className="px-5 py-3.5 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Filter Tipe:</span>
        <button 
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'all' ? 'bg-brand-600 text-white shadow-brand-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Semua ({orders.length})
        </button>
        <button 
          onClick={() => setActiveFilter('beli')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'beli' ? 'bg-brand-600 text-white shadow-brand-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Pembelian ({orders.filter(o => o.order_type === 'beli').length})
        </button>
        <button 
          onClick={() => setActiveFilter('sewa')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'sewa' ? 'bg-orange-600 text-white shadow-orange-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Penyewaan ({orders.filter(o => o.order_type === 'sewa').length})
        </button>
        <button 
          onClick={() => setActiveFilter('booking')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${activeFilter === 'booking' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
        >
          Booking Pemandu ({orders.filter(o => o.order_type === 'booking').length})
        </button>
      </div>

      {/* TABEL RESPONSIF ANTI-KEPOTONG KANAN */}
      <div className="w-full overflow-x-auto pb-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider">
              <th className="p-3 font-bold border-b">ID & Tgl</th>
              <th className="p-3 font-bold border-b">Pelanggan & Jaminan</th>
              <th className="p-3 font-bold border-b">Detail Item Pesanan</th>
              <th className="p-3 font-bold border-b">Tipe & Resi</th>
              <th className="p-3 font-bold border-b">Total, Deposito & Denda</th>
              <th className="p-3 font-bold border-b w-[210px]">Status & Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-12 text-center text-gray-400">
                  <i className="fa-solid fa-filter-circle-xmark text-4xl mb-2 text-gray-300 block"></i>
                  Tidak ada pesanan untuk kategori ini.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const depAmount = Number(order.deposit_amount || 0);
                const baseRentOrBuy = Math.max(0, Number(order.total_price || 0) - depAmount);
                const penaltyBill = Number(order.penalty_bill || 0);
                const lateFee = Number(order.late_fee || 0);
                const lateDays = Number(order.late_days || 0);

                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition align-top">
                    <td className="p-3 whitespace-nowrap">
                      <p className="font-bold text-gray-800 text-sm">#ORD-{order.id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                      </p>
                    </td>

                    <td className="p-3 max-w-[190px]">
                      <p className="text-sm font-bold text-gray-800 truncate">{order.customer_name || 'Tanpa Nama'}</p>
                      <p className="text-xs text-gray-500 truncate">{order.customer_email || '-'}</p>
                      {order.customer_phone && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          <i className="fa-brands fa-whatsapp text-green-600 mr-1"></i>{order.customer_phone}
                        </p>
                      )}
                      {order.order_type === 'sewa' && (order.customer_nik || order.customer_bank_account) && (
                        <div className="mt-1.5 bg-gray-100 rounded-lg p-1.5 text-[10px] text-gray-600 space-y-0.5 border border-gray-200">
                          {order.customer_nik && (
                            <p className="truncate" title={`NIK: ${order.customer_nik}`}>
                              <b>NIK:</b> <span className="font-mono">{order.customer_nik}</span>
                            </p>
                          )}
                          {order.customer_bank_account && (
                            <p className="truncate" title={`${order.customer_bank_name || 'Bank'}: ${order.customer_bank_account}`}>
                              <b>{order.customer_bank_name || 'Rek'}:</b> <span className="font-mono">{order.customer_bank_account}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    
                    <td className="p-3 max-w-[270px]">
                      <div className="flex flex-col gap-2">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, idx) => {
                            const qty = Number(item.quantity || item.qty || 1);
                            const dmgQty = Number(item.damaged_qty || 0);
                            return (
                              <div key={idx} className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-gray-200 shadow-xs">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                      <i className="fa-solid fa-image"></i>
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs min-w-0 flex-grow">
                                  <p className="font-bold text-gray-800 truncate" title={item.name}>{item.name || 'Produk'}</p>
                                  <p className="text-gray-500 text-[11px]">{qty}x @ Rp {Number(item.price_at_time || 0).toLocaleString('id-ID')}</p>
                                  {order.order_type === 'sewa' && (
                                    <p className="text-[10px] text-amber-700 font-semibold">
                                      Deposito/unit: Rp {Number(item.deposit_per_unit || 0).toLocaleString('id-ID')}
                                    </p>
                                  )}
                                  {order.stock_returned && order.order_type === 'sewa' && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        Bagus: {Math.max(0, qty - dmgQty)} (+Stok)
                                      </span>
                                      {dmgQty > 0 && (
                                        <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          Rusak: {dmgQty}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-400 italic">Tidak ada rincian item</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                         <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          order.order_type === 'sewa' ? 'bg-orange-100 text-orange-700' : 
                          order.order_type === 'booking' ? 'bg-blue-100 text-blue-700' : 
                          'bg-brand-100 text-brand-700'
                        }`}>
                          {order.order_type === 'booking' ? 'Jasa Pemandu' : order.order_type}
                        </span>
                        {order.return_resi && (
                          <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                            Resi: {order.return_resi}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="font-bold text-gray-800 text-sm">
                        Rp {Number(order.total_price).toLocaleString('id-ID')}
                      </div>
                      {order.order_type === 'sewa' && (
                        <div className="mt-1 space-y-0.5 text-[11px]">
                          <p className="text-gray-500">Sewa: Rp {baseRentOrBuy.toLocaleString('id-ID')}</p>
                          <p className="text-amber-700 font-semibold">
                            Deposito: Rp {depAmount.toLocaleString('id-ID')}
                          </p>
                          {order.deposit_status && order.deposit_status !== 'Tidak Ada' && (
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${getDepositBadgeStyle(order.deposit_status)}`}>
                              {order.deposit_status}
                            </span>
                          )}
                          {lateDays > 0 && (
                            <p className="text-[10px] text-amber-800 font-bold">
                              Telat {lateDays} hr: Rp {lateFee.toLocaleString('id-ID')}
                            </p>
                          )}
                          {Number(order.deposit_forfeited || 0) > 0 && (
                            <p className="text-[10px] text-red-600 font-bold">
                              Potong Dep: -Rp {Number(order.deposit_forfeited).toLocaleString('id-ID')}
                            </p>
                          )}
                          {Number(order.deposit_refunded || 0) > 0 && (
                            <p className="text-[10px] text-green-700 font-bold">
                              Refund: Rp {Number(order.deposit_refunded).toLocaleString('id-ID')}
                            </p>
                          )}
                          {penaltyBill > 0 && (
                            <div className={`mt-1 p-1.5 rounded-lg border text-[10px] ${
                              order.penalty_status === 'Lunas'
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                              <p className="font-black">
                                Tagihan Denda: Rp {penaltyBill.toLocaleString('id-ID')}
                              </p>
                              <p className="font-bold uppercase">
                                Status: {order.penalty_status || 'Belum Lunas'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3 w-[210px]">
                      <div className="flex flex-col gap-2 w-full">
                        <select 
                          value={order.status || 'Menunggu Pembayaran'}
                          onChange={(e) => handleStatusChange(order, e.target.value)}
                          className={`w-full text-xs font-bold px-2.5 py-2 rounded-xl outline-none border cursor-pointer ${getStatusStyle(order.status || 'Menunggu Pembayaran')}`}
                        >
                          {order.order_type === 'booking' ? (
                            <>
                               <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
                               <option value="Diproses">Diproses (Sudah Dibayar)</option>
                               <option value="Menunggu Konfirmasi Admin">Menunggu Konfirmasi Admin</option>
                               <option value="Guide Terkonfirmasi">Guide Terkonfirmasi</option>
                               <option value="Sedang Mendaki">Sedang Mendaki</option>
                               <option value="Selesai">Selesai</option>
                               <option value="Reschedule/Ditolak">Reschedule/Ditolak</option>
                               <option value="Dibatalkan">Dibatalkan</option>
                            </>
                          ) : order.order_type === 'sewa' ? (
                            <>
                               <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
                               <option value="Diproses">Diproses</option>
                               <option value="Sedang Disewa">Sedang Disewa</option>
                               <option value="Dalam Pengiriman Kembali">Dalam Pengiriman Kembali</option>
                               <option value="Dikembalikan">Dikembalikan / Selesai</option>
                               <option value="Dikembalikan (Terlambat)">Dikembalikan (Terlambat)</option>
                               <option value="Dikembalikan (Ada Kerusakan)">Dikembalikan (Ada Rusak)</option>
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

                        {/* Tombol Cepat Inspeksi Pengembalian Barang Sewa, Keterlambatan & Deposito */}
                        {order.order_type === 'sewa' &&
                          !['Menunggu Pembayaran', 'Dibatalkan'].includes(order.status) &&
                          !order.stock_returned && (
                            <button
                              type="button"
                              onClick={() => openInspectionModal(order, false)}
                              className="w-full bg-orange-50 hover:bg-orange-600 text-orange-700 hover:text-white border border-orange-200 text-xs font-bold px-2.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                            >
                              <i className="fa-solid fa-clipboard-check"></i> Inspeksi & Selesaikan
                            </button>
                          )}

                        {/* Tombol Konfirmasi Pelunasan Denda Manual oleh Admin (jika user transfer manual / tunai) */}
                        {penaltyBill > 0 && order.penalty_status !== 'Lunas' && (
                          <button
                            type="button"
                            onClick={() => handleMarkPenaltyPaidByAdmin(order.id)}
                            className="w-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition flex items-center justify-center gap-1 shadow-xs"
                          >
                            <i className="fa-solid fa-check-circle"></i> Tandai Denda Lunas
                          </button>
                        )}

                        {order.damage_note && (
                          <p className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded break-words">
                            <b>Catatan:</b> {order.damage_note}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL INSPEKSI PENGEMBALIAN BARANG SEWA, KETERLAMBATAN (2%/HARI) & PERHITUNGAN DEPOSITO */}
      {inspectModalOrder && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
          onClick={() => setInspectModalOrder(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full">
                  Order #ORD-{inspectModalOrder.id} • {inspectModalOrder.customer_name}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                  <i className="fa-solid fa-shield-halved text-orange-600"></i>
                  Inspeksi Pengembalian, Keterlambatan & Deposito
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Periksa kondisi unit (Bagus vs Rusak) dan hari keterlambatan. Sistem otomatis memotong deposito atau menerbitkan Tagihan Denda jika deposito kurang/Rp 0.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalOrder(null)}
                className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition flex-shrink-0"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleConfirmInspection} className="space-y-5">
              {/* Info Jaminan Identitas & Rekening Penyewa */}
              {(inspectModalOrder.customer_nik || inspectModalOrder.customer_bank_account) && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold block text-[11px] uppercase text-blue-700">
                      <i className="fa-solid fa-id-card mr-1"></i>Data Jaminan Identitas & Rekening Penyewa
                    </span>
                    <span className="text-xs">
                      NIK KTP: <b className="font-mono">{inspectModalOrder.customer_nik || '-'}</b> • Rekening Refund/Tagih: <b>{inspectModalOrder.customer_bank_name || 'Bank'} - <span className="font-mono">{inspectModalOrder.customer_bank_account || '-'}</span></b>
                    </span>
                  </div>
                </div>
              )}

              {/* Tombol Preset Cepat: Semua Aman vs Semua Rusak */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = {};
                    (inspectModalOrder.items || []).forEach(it => {
                      next[it.order_item_id || it.product_id] = 0;
                    });
                    setDamagedQtyMap(next);
                    setLateDaysInput(0);
                  }}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-circle-check"></i> Semua Aman & Tepat Waktu (Refund 100%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = {};
                    (inspectModalOrder.items || []).forEach(it => {
                      next[it.order_item_id || it.product_id] = Number(it.quantity || it.qty || 1);
                    });
                    setDamagedQtyMap(next);
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-triangle-exclamation"></i> Tandai Semua Unit Rusak
                </button>
              </div>

              {/* BAGIAN 1: KETERLAMBATAN PENGEMBALIAN (DENDA 2% PER HARI DARI HARGA ASLI BARANG) */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                    <i className="fa-solid fa-clock text-amber-600"></i>
                    Keterlambatan Pengembalian (Denda 2% / Hari dari Harga Asli)
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Total Harga Asli Barang: <b>Rp {previewTotalOrigValue.toLocaleString('id-ID')}</b> • Tarif Denda: <b>Rp {dailyLateRate.toLocaleString('id-ID')} / hari</b>
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-xl p-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setLateDaysInput(Math.max(0, Number(lateDaysInput || 0) - 1))}
                    className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition"
                  >
                    -
                  </button>
                  <div className="px-3 text-center">
                    <span className={`font-black text-sm ${lateDaysInput > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {lateDaysInput} Hari
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLateDaysInput(Number(lateDaysInput || 0) + 1)}
                    className="h-8 w-8 rounded-lg bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-800 font-bold text-sm transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* BAGIAN 2: DAFTAR ITEM DISEWA & KONTROL UNIT RUSAK */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider">
                  Kondisi Fisik Barang per Unit (Bagus vs Rusak)
                </h4>
                {(inspectModalOrder.items || []).map((item, idx) => {
                  const key = item.order_item_id || item.product_id;
                  const totalQty = Number(item.quantity || item.qty || 1);
                  const origPrice = Number(item.original_price || 0);
                  const dmgQty = Math.min(totalQty, Math.max(0, Number(damagedQtyMap[key] || 0)));
                  const goodQty = Math.max(0, totalQty - dmgQty);
                  const depPerUnit = Number(item.deposit_per_unit || 0);
                  const unitDamagePenalty = depPerUnit > 0 ? depPerUnit : Math.round(0.5 * origPrice);

                  return (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-grow">
                        <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Disewa: <b>{totalQty} unit</b> • Harga Asli: <b>Rp {origPrice.toLocaleString('id-ID')}</b> • Denda Rusak/unit: <b>Rp {unitDamagePenalty.toLocaleString('id-ID')}</b>
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                          <span className="bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-lg">
                            <i className="fa-solid fa-check mr-1"></i>Kembali Bagus: {goodQty} unit (+{goodQty} ke Stok Sewa)
                          </span>
                          {dmgQty > 0 && (
                            <span className="bg-red-100 text-red-700 font-bold px-2.5 py-0.5 rounded-lg">
                              <i className="fa-solid fa-xmark mr-1"></i>Rusak: {dmgQty} unit (Denda Rp {(dmgQty * unitDamagePenalty).toLocaleString('id-ID')})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-start sm:items-end flex-shrink-0">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Jumlah Unit Rusak</label>
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => setDamagedQtyMap(prev => ({ ...prev, [key]: Math.max(0, dmgQty - 1) }))}
                            className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition"
                          >
                            -
                          </button>
                          <span className={`w-12 text-center font-black text-sm ${dmgQty > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            {dmgQty} / {totalQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDamagedQtyMap(prev => ({ ...prev, [key]: Math.min(totalQty, dmgQty + 1) }))}
                            className="h-7 w-7 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold text-sm transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input Catatan Kerusakan / Keterlambatan */}
              {(previewDamagedUnits > 0 || lateDaysInput > 0) && (
                <div className="fade-in">
                  <label className="block text-xs font-bold text-red-700 uppercase mb-1">
                    Keterangan / Berita Acara Kerusakan atau Keterlambatan (Ditampilkan ke Penyewa)
                  </label>
                  <textarea
                    rows="2"
                    required={previewDamagedUnits > 0}
                    placeholder="Contoh: Terlambat dikembalikan 2 hari & 1 unit tenda mengalami patah frame utama..."
                    value={damageNote}
                    onChange={(e) => setDamageNote(e.target.value)}
                    className="w-full bg-red-50/40 border border-red-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-red-500 resize-none"
                  />
                </div>
              )}

              {/* Kotak Ringkasan Perhitungan Otomatis Stok, Deposito & Sistem Tagih Kekurangan */}
              <div className="bg-brand-900 text-white rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-brand-200">
                  <span>Stok Kembali ke Gudang Sewa:</span>
                  <span className="font-bold text-white">+{previewGoodUnits} Unit Bagus {previewDamagedUnits > 0 ? `(${previewDamagedUnits} Unit Rusak Ditahan)` : ''}</span>
                </div>
                <div className="flex justify-between items-center text-brand-200">
                  <span>Total Deposito yang Dipegang Toko:</span>
                  <span className="font-bold text-white">Rp {previewTotalDeposit.toLocaleString('id-ID')}</span>
                </div>
                {previewDamageFine > 0 && (
                  <div className="flex justify-between items-center text-red-300">
                    <span>Total Kompensasi Barang Rusak ({previewDamagedUnits} unit):</span>
                    <span className="font-bold">Rp {previewDamageFine.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {previewLateFee > 0 && (
                  <div className="flex justify-between items-center text-amber-300">
                    <span>Denda Keterlambatan ({lateDaysInput} hari × 2% harga barang):</span>
                    <span className="font-bold">Rp {previewLateFee.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-red-300 pt-1 border-t border-white/10">
                  <span>Dipotong dari Deposito Pelanggan:</span>
                  <span className="font-bold">- Rp {previewForfeited.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-1 border-t border-white/15">
                  <span className="font-bold text-green-300">Sisa Deposito Dikembalikan (Refund) ke Pelanggan:</span>
                  <span className="font-black text-base text-green-400">Rp {previewRefunded.toLocaleString('id-ID')}</span>
                </div>

                {/* Jika Deposito Rp 0 atau Tidak Cukup Menutup Denda -> Terbitkan Tagihan Denda (Penalty Bill) */}
                {previewPenaltyBill > 0 && (
                  <div className="mt-2 bg-red-500/20 border border-red-400/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-black uppercase text-red-300 block">
                        <i className="fa-solid fa-file-invoice-dollar mr-1"></i>
                        Tagihan Denda Kekurangan (Otomatis Ditagihkan ke Akun Penyewa)
                      </span>
                      <span className="text-[10px] text-red-100">
                        Karena deposito tidak mencukupi/Rp 0, penyewa wajib membayar tagihan ini via Midtrans di halaman Profil (akun dikunci dari sewa baru sampai lunas).
                      </span>
                    </div>
                    <span className="font-black text-lg text-red-300 whitespace-nowrap">
                      Rp {previewPenaltyBill.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectModalOrder(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingInspect}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-check-double"></i>
                  {submittingInspect ? 'Menyimpan...' : 'Simpan Hasil Inspeksi & Selesaikan'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
