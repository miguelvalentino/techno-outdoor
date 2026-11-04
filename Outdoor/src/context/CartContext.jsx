// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const getCartStorageKey = (userId) => {
  return userId ? `outdoor_cart_user_${userId}` : 'outdoor_cart_guest';
};

// Bersihkan image_url jika berbentuk base64 panjang agar tidak melebihi kuota 5MB localStorage
const sanitizeCartForStorage = (items) => {
  return (items || []).map((item) => {
    const isHugeBase64 = typeof item.image_url === 'string' && item.image_url.length > 2000;
    return {
      ...item,
      image_url: isHugeBase64 ? '' : item.image_url
    };
  });
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const currentStorageKey = getCartStorageKey(user?.id);
  const prevUserIdRef = useRef(user?.id ?? null);

  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      const parsedUser = savedUser ? JSON.parse(savedUser) : null;
      const effectiveUserId = user?.id ?? parsedUser?.id ?? null;
      const key = getCartStorageKey(effectiveUserId);
      const savedCart = localStorage.getItem(key);
      // Bersihkan sisa outdoor_cart_guest jika user sudah dalam keadaan login saat refresh
      if (effectiveUserId) {
        localStorage.removeItem('outdoor_cart_guest');
      }
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      return [];
    }
  });

  const [toast, setToast] = useState({ show: false, message: 'Berhasil ditambahkan ke keranjang!' });

  // Hanya jalankan sinkronisasi ketika status user benar-benar berubah (misal: dari Guest -> Login atau Login -> Logout), BUKAN saat refresh halaman!
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const prevUserId = prevUserIdRef.current;

    // Jika userId tidak berubah (contoh: saat halaman baru di-refresh), jangan lakukan merge apapun!
    if (currentUserId === prevUserId) {
      return;
    }

    prevUserIdRef.current = currentUserId;

    try {
      if (currentUserId) {
        const userKey = getCartStorageKey(currentUserId);
        const guestKey = getCartStorageKey(null);
        const savedUserCartRaw = localStorage.getItem(userKey);
        const savedGuestCartRaw = localStorage.getItem(guestKey);

        const userCart = savedUserCartRaw ? JSON.parse(savedUserCartRaw) : [];
        const guestCart = savedGuestCartRaw ? JSON.parse(savedGuestCartRaw) : [];

        if (prevUserId === null && guestCart.length > 0) {
          // Gabungkan item dari keranjang guest HANYA saat user baru saja login dari mode guest
          const merged = [...userCart];
          for (const gItem of guestCart) {
            const idx = merged.findIndex((uItem) => uItem.id === gItem.id && uItem.type === gItem.type);
            if (idx >= 0) {
              const maxStock = gItem.stock !== undefined && gItem.stock !== null ? Number(gItem.stock) : 50;
              merged[idx] = {
                ...merged[idx],
                qty: Math.min(maxStock, Number(merged[idx].qty || 1) + Number(gItem.qty || 1))
              };
            } else {
              merged.push({ ...gItem });
            }
          }
          setCartItems(merged);
          localStorage.setItem(userKey, JSON.stringify(sanitizeCartForStorage(merged)));
          localStorage.removeItem(guestKey);
        } else {
          setCartItems(userCart);
        }
      } else {
        // Transisi dari Login -> Logout (Mode Guest): kosongkan tampilan guest tanpa menghapus keranjang milik akun user di localStorage
        const guestCartRaw = localStorage.getItem(getCartStorageKey(null));
        setCartItems(guestCartRaw ? JSON.parse(guestCartRaw) : []);
      }
    } catch (err) {
      console.error('Gagal menyinkronkan keranjang pengguna:', err);
    }
  }, [user?.id]);

  // Simpan setiap perubahan keranjang ke localStorage sesuai key aktif
  useEffect(() => {
    try {
      const sanitized = sanitizeCartForStorage(cartItems);
      localStorage.setItem(currentStorageKey, JSON.stringify(sanitized));
    } catch (error) {
      console.error('Gagal menyimpan keranjang ke localStorage:', error);
    }
  }, [cartItems]);

  const showToast = (customMessage = 'Berhasil ditambahkan ke keranjang!') => {
    setToast({ show: true, message: customMessage });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 2500);
  };

  const addToCart = (newItem) => {
    const requestedAdd = Number(newItem.qty || 1);
    const maxStock = newItem.stock !== undefined && newItem.stock !== null ? Number(newItem.stock) : 50;

    let toastMsg = 'Berhasil ditambahkan ke keranjang!';

    setCartItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex(
        (item) => item.id === newItem.id && item.type === newItem.type
      );

      if (existingItemIndex >= 0) {
        const existingItem = prevItems[existingItemIndex];
        const currentQty = Number(existingItem.qty || 1);
        const newTotalQty = currentQty + requestedAdd;

        if (newTotalQty > maxStock) {
          toastMsg = `Stok maksimum tercapai (${maxStock} unit)!`;
          return prevItems;
        }

        toastMsg = 'Berhasil memperbarui jumlah di keranjang!';
        // PENTING: Buat objek baru secara immutable (JANGAN mutasi existingItem secara langsung karena React StrictMode memanggil updater 2x!)
        return prevItems.map((item, idx) =>
          idx === existingItemIndex
            ? {
                ...item,
                ...newItem,
                qty: newTotalQty,
                stock: maxStock
              }
            : item
        );
      } else {
        if (requestedAdd > maxStock) {
          toastMsg = `Stok maksimum tercapai (${maxStock} unit)!`;
          return prevItems;
        }
        toastMsg = 'Berhasil ditambahkan ke keranjang!';
        return [...prevItems, { ...newItem, qty: requestedAdd, stock: maxStock }];
      }
    });

    showToast(toastMsg);
  };

  const updateQuantity = (id, type, newQty) => {
    if (newQty <= 0) {
      removeFromCart(id, type);
      return;
    }

    let exceededStock = null;

    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id && item.type === type) {
          const maxStock = item.stock !== undefined && item.stock !== null ? Number(item.stock) : 50;
          if (newQty > maxStock) {
            exceededStock = maxStock;
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      })
    );

    if (exceededStock !== null) {
      showToast(`Jumlah melebihi stok tersedia (${exceededStock} unit)!`);
    }
  };

  const removeFromCart = (id, type) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => !(item.id === id && item.type === type))
    );
    showToast('Produk dihapus dari keranjang.');
  };

  const clearCart = () => {
    setCartItems([]);
    try {
      localStorage.removeItem(currentStorageKey);
    } catch (e) {
      console.error(e);
    }
  };

  const totalItems = cartItems.reduce((sum, item) => sum + Number(item.qty || 1), 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeFromCart, clearCart, totalItems, toast }}>
      {children}
    </CartContext.Provider>
  );
};
