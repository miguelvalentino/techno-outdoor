// src/components/Navbar.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthModal } from './AuthModal';
import { CartModal } from './CartModal';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext'; 

export const Navbar = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const menuRef = useRef(null);  
  const { totalItems, clearCart } = useCart(); 
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    navigate('/'); 
  };

  return (
    <>
      <nav className="bg-brand-800/95 backdrop-blur text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
              <i className="fa-solid fa-mountain-sun text-2xl text-brand-500"></i>
              <span className="font-bold text-xl tracking-tight">Outdoor Warrent</span>
            </Link>
            
            <div className="flex items-center gap-6">
              
              {/* Ikon Keranjang */}
              <button 
                onClick={() => setIsCartOpen(true)} 
                className="hover:text-brand-100 transition relative"
              >
                <i className="fa-solid fa-cart-shopping text-lg"></i>
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-xs font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                    {totalItems}
                  </span>
                )}
              </button>
              
              {/* Menu Profil / Auth */}
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 hover:text-brand-100 transition"
                >
                  <span className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold bg-white/10 overflow-hidden border border-white/20">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      <i className="fa-regular fa-user"></i>
                    )}
                  </span>
                  <span className="hidden sm:inline text-sm font-semibold max-w-[100px] truncate">
                    {user ? user.name.split(' ')[0] : 'Akun'}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-white text-gray-700 rounded-2xl shadow-xl border border-gray-100 overflow-hidden fade-in">
                    
                    {/* Jika Sudah Login */}
                    {user ? (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-brand-100 overflow-hidden flex items-center justify-center flex-shrink-0 border border-brand-200">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                            ) : (
                              <i className="fa-solid fa-user text-brand-600 text-sm"></i>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                        
                        <Link to="/profile" onClick={() => setIsUserMenuOpen(false)} className="w-full text-left px-4 py-3 hover:bg-brand-50 text-sm flex items-center gap-3 border-b border-gray-100">
                          <i className="fa-regular fa-user w-4 text-brand-600"></i> Profil Saya
                        </Link>
                        
                        {/* Link ke Admin Panel HANYA muncul jika role-nya admin */}
                        {user.role === 'admin' && (
                          <Link to="/admin" onClick={() => setIsUserMenuOpen(false)} className="w-full text-left px-4 py-3 hover:bg-brand-50 text-sm flex items-center gap-3 border-b border-gray-100">
                            <i className="fa-solid fa-lock w-4 text-brand-600"></i> Admin Panel
                          </Link>
                        )}

                        <button onClick={handleLogout} className="w-full text-left px-4 py-3 hover:bg-red-50 text-sm flex items-center gap-3 font-semibold text-red-600">
                          <i className="fa-solid fa-arrow-right-from-bracket w-4"></i> Keluar
                        </button>
                      </>
                    ) : (
                      
                      <button onClick={() => { setIsAuthModalOpen(true); setIsUserMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-brand-50 text-sm flex items-center gap-3 font-semibold">
                        <i className="fa-solid fa-right-to-bracket w-4 text-brand-600"></i> Login / Daftar
                      </button>
                      
                    )}
                    
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
};
