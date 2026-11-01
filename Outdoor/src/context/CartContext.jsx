// src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('outdoor_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      localStorage.removeItem('outdoor_cart'); 
      return [];
    }
  });

  const [toast, setToast] = useState({ show: false, message: 'Berhasil ditambahkan ke keranjang!' });

  useEffect(() => {
    try {
      localStorage.setItem('outdoor_cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Gagal menyimpan keranjang:', error);
    }
  }, [cartItems]);

  const showToast = (customMessage = 'Berhasil ditambahkan ke keranjang!') => {
    setToast({ show: true, message: customMessage });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 2500);
  };

  const addToCart = (newItem) => {
    setCartItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex(
        (item) => item.id === newItem.id && item.type === newItem.type
      );

      const maxStock = newItem.stock !== undefined && newItem.stock !== null ? Number(newItem.stock) : 50;

      if (existingItemIndex >= 0) {
        const updatedItems = [...prevItems];
        const currentQty = updatedItems[existingItemIndex].qty;
        const requestedAdd = newItem.qty || 1;
        const newTotalQty = currentQty + requestedAdd;

        if (newTotalQty > maxStock) {
          showToast(`Stok maksimum tercapai (${maxStock} pcs)!`);
          return updatedItems;
        }

        updatedItems[existingItemIndex].qty = newTotalQty;
        updatedItems[existingItemIndex].stock = maxStock;
        showToast('Berhasil memperbarui jumlah di keranjang!');
        return updatedItems;
      } else {
        if ((newItem.qty || 1) > maxStock) {
          showToast(`Stok maksimum tercapai (${maxStock} pcs)!`);
          return prevItems;
        }
        showToast('Berhasil ditambahkan ke keranjang!');
        return [...prevItems, { ...newItem, qty: newItem.qty || 1, stock: maxStock }];
      }
    });
  };

  const updateQuantity = (id, type, newQty) => {
    if (newQty <= 0) {
      removeFromCart(id, type);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id && item.type === type) {
          const maxStock = item.stock !== undefined && item.stock !== null ? Number(item.stock) : 50;
          
          if (newQty > maxStock) {
            showToast(`Jumlah melebihi stok gudang (${maxStock} pcs)!`);
            return item; 
          }
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id, type) => {
    setCartItems((prevItems) => 
      prevItems.filter((item) => !(item.id === id && item.type === type))
    );
    showToast('Produk dihapus dari keranjang.');
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, updateQuantity, removeFromCart, clearCart, totalItems, toast }}>
      {children}
    </CartContext.Provider>
  );
};