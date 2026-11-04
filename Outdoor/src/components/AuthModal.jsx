// src/components/AuthModal.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';

export const AuthModal = ({ isOpen, onClose }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    address: '',
    shoe_size: '',
    hiking_level: 'Pemula',
    nik: '',
    bank_name: 'BCA',
    bank_account: ''
  });

  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();

      if (response.ok) {
        login(data.user);
        setFormData({
          name: '',
          email: '',
          password: '',
          phone: '',
          city: '',
          address: '',
          shoe_size: '',
          hiking_level: 'Pemula',
          nik: '',
          bank_name: 'BCA',
          bank_account: ''
        });
        onClose(); 
      } else {
        setErrorMsg(data.error || 'Terjadi kesalahan, silakan coba lagi.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg('Gagal terhubung ke server. Pastikan backend aktif.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setErrorMsg('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
      <div className={`bg-white w-full ${isLoginMode ? 'max-w-md' : 'max-w-2xl'} rounded-3xl shadow-2xl overflow-hidden relative transition-all duration-300 max-h-[92vh] flex flex-col`}>
        
        <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition z-10">
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="p-6 sm:p-8 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="h-12 w-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-mountain-sun text-xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isLoginMode ? 'Selamat Datang Kembali' : 'Mulai Petualanganmu'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isLoginMode ? 'Masuk ke akun Outdoor Warrent Anda.' : 'Lengkapi data diri & jaminan identitas Anda untuk menyewa dan berbelanja.'}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-4 border border-red-100 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className={isLoginMode ? "flex flex-col gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
              {!isLoginMode && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap (Sesuai KTP)</label>
                  <input type="text" required={!isLoginMode} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm" placeholder="John Doe" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm" placeholder="email@contoh.com" />
              </div>

              <div className={!isLoginMode ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kata Sandi</label>
                <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm" placeholder="••••••••" />
              </div>
            </div>

            {/* Bagian Profil & Jaminan Identitas (Hanya muncul saat Register) */}
            {!isLoginMode && (
              <>
                <div className="border-t border-gray-100 my-1 pt-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-id-card text-brand-600"></i>
                    Data Jaminan Penyewaan & Pengembalian Deposito (Failsafe)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-brand-50/50 p-3.5 rounded-2xl border border-brand-100 mb-4">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        NIK KTP (16 Digit - Jaminan Penyewaan Alat)
                      </label>
                      <input
                        type="text"
                        required={!isLoginMode}
                        maxLength={16}
                        value={formData.nik}
                        onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 text-sm font-mono"
                        placeholder="3201234567890001"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Bank / E-Wallet</label>
                      <select
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-brand-500 text-sm font-semibold"
                      >
                        <option value="BCA">BCA</option>
                        <option value="Mandiri">Mandiri</option>
                        <option value="BNI">BNI</option>
                        <option value="BRI">BRI</option>
                        <option value="BSI">BSI</option>
                        <option value="GoPay / DANA / OVO">GoPay / DANA / OVO</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        No. Rekening (Untuk Refund Deposito & Klaim)
                      </label>
                      <input
                        type="text"
                        required={!isLoginMode}
                        value={formData.bank_account}
                        onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 text-sm font-mono"
                        placeholder="Contoh: 1234567890 a/n John Doe"
                      />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-gray-800 mb-3">Detail Kontak & Profil Pendaki</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No. WhatsApp / Telp Aktif</label>
                      <input type="text" required={!isLoginMode} value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm" placeholder="081234567890" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kota Domisili</label>
                      <input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm" placeholder="Jakarta" />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap Sesuai Domisili</label>
                      <textarea rows="2" required={!isLoginMode} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 resize-none text-sm" placeholder="Jl. Contoh No. 123..."></textarea>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ukuran Sepatu</label>
                      <input type="text" value={formData.shoe_size} onChange={(e) => setFormData({...formData, shoe_size: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm" placeholder="Contoh: 42" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Level Pendakian</label>
                      <select value={formData.hiking_level} onChange={(e) => setFormData({...formData, hiking_level: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 text-sm">
                        <option value="Pemula">Pemula</option>
                        <option value="Menengah">Menengah</option>
                        <option value="Pro / Expert">Pro / Expert</option>
                      </select>
                    </div>

                  </div>
                </div>
              </>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`mt-2 w-full text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 active:scale-95'}`}
            >
              {loading ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Memproses...</>
              ) : (
                isLoginMode ? 'Masuk Sekarang' : 'Daftar Akun'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {isLoginMode ? "Belum punya akun? " : "Sudah punya akun? "}
            <button onClick={toggleMode} className="text-brand-600 font-bold hover:underline">
              {isLoginMode ? 'Daftar di sini' : 'Login di sini'}
            </button>
          </div>
        </div>
        
      </div>
    </div>,
    document.body
  );
};
