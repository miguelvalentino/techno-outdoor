export const Footer = () => {
  return (
    <footer className="bg-earth-800 text-earth-100 py-10 border-t border-earth-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <i className="fa-solid fa-mountain-sun text-2xl text-brand-500"></i>
            <span className="font-bold text-xl">Outdoor Warrent</span>
          </div>
          <p className="text-sm text-gray-400">Solusi lengkap untuk kebutuhan petualangan alam Anda. Belanja, sewa, dan booking guide dalam satu platform.</p>
        </div>
        <div>
          <h4 className="font-bold mb-4 text-white">Layanan</h4>
          <ul className="text-sm text-gray-400 space-y-2">
            <li><a href="#" className="hover:text-brand-500 transition">Beli Alat Camping</a></li>
            <li><a href="#" className="hover:text-brand-500 transition">Sewa Peralatan</a></li>
            <li><a href="#" className="hover:text-brand-500 transition">Booking Guide/Porter</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-4 text-white">Kontak & Bantuan</h4>
          <ul className="text-sm text-gray-400 space-y-2">
            <li><i className="fa-solid fa-location-dot w-5"></i> Jl. Petualang No. 99, Jakarta</li>
            <li><i className="fa-brands fa-whatsapp w-5"></i> +62 812 3456 7890</li>
            <li><i className="fa-regular fa-envelope w-5"></i> warrent@gmail.com</li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-gray-700 text-sm text-gray-500 text-center">
        &copy; 2026 Outdoor Warrent - Technopreneurship Project MVP. All rights reserved.
      </div>
    </footer>
  );
};