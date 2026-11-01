// src/components/AuthModal.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const AuthModal = ({ isOpen, onClose }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 1. Tambahkan state form untuk field baru
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    address: '',
    shoe_size: '',
    hiking_level: 'Pemula' // Default value
  });

  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();

      if (response.ok) {
        login(data.user);
        // Reset form komplit
        setFormData({ name: '', email: '', password: '', phone: '', city: '', address: '', shoe_size: '', hiking_level: 'Pemula' });
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
      {/* Lebarkan sedikit modal jika mode register agar muat form grid */}
      <div className={`bg-white w-full ${isLoginMode ? 'max-w-md' : 'max-w-2xl'} rounded-3xl shadow-2xl overflow-hidden relative transition-all duration-300 max-h-[95vh] flex flex-col`}>
        
        <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition z-10">
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="p-8 overflow-y-auto hide-scrollbar">
          <div className="text-center mb-6">
            <div className="h-12 w-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-mountain-sun text-xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isLoginMode ? 'Selamat Datang Kembali' : 'Mulai Petualanganmu'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isLoginMode ? 'Masuk ke akun Outdoor Warrent Anda.' : 'Lengkapi data diri Anda untuk mulai menyewa dan berbelanja.'}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm mb-4 border border-red-100 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Bagian Akun Inti (Grid 1 Kolom jika Login, 2 Kolom jika Register) */}
            <div className={isLoginMode ? "flex flex-col gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
              {!isLoginMode && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                  <input type="text" required={!isLoginMode} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" placeholder="John Doe" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" placeholder="email@contoh.com" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kata Sandi</label>
                <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" placeholder="••••••••" />
              </div>
            </div>

            {/* Bagian Profil Tambahan (Hanya muncul saat Register) */}
            {!isLoginMode && (
              <>
                <div className="border-t border-gray-100 my-2 pt-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Detail Profil Pendaki</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No. WhatsApp / Telp</label>
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" placeholder="081234567890" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kota Domisili</label>
                      <input type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" placeholder="Jakarta" />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</label>
                      <textarea rows="2" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 resize-none" placeholder="Jl. Contoh No. 123..."></textarea>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ukuran Sepatu</label>
                      <input type="text" value={formData.shoe_size} onChange={(e) => setFormData({...formData, shoe_size: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500" placeholder="Contoh: 42" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Level Pendakian</label>
                      <select value={formData.hiking_level} onChange={(e) => setFormData({...formData, hiking_level: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-500">
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
              className={`mt-4 w-full text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 active:scale-95'}`}
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
    </div>
  );
};