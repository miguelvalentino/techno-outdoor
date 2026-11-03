// src/components/ToastNotification.jsx
import { useCart } from '../context/CartContext';

export const ToastNotification = () => {
  const { toast } = useCart();

  if (!toast?.show) return null;

  return (
    <div className="fixed top-20 inset-x-0 z-[60] flex justify-end px-5 pointer-events-none fade-in">
      <div className="bg-white text-gray-800 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-100 border-l-4 border-l-green-500 pointer-events-auto">
        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-check text-green-600 text-sm"></i>
        </div>
        <p className="text-xs font-bold text-gray-800 whitespace-nowrap">
           Berhasil ditambahkan
        </p>
      </div>
    </div>
  );
};