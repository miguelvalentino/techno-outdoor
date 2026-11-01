// src/pages/HomePage.jsx
import { useState } from 'react';
import { BuySection } from '../components/BuySection';
import { RentSection } from '../components/RentSection'; 
import { GuideSection } from '../components/GuideSection'; 

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('beli');

  return (
    <>
      <header className="relative bg-brand-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-600 via-brand-900 to-black"></div>
        </div>
        <div className="absolute inset-0 contour"></div>
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
            Jelajahi Alam Tanpa Batas
          </h1>
          <p className="text-lg sm:text-xl text-brand-100 mb-8 max-w-2xl mx-auto">
            Platform terpadu untuk beli & sewa alat camping original, serta temukan Pemandu Profesional untuk pendakianmu berikutnya.
          </p>
        </div>
      </header>

      <main className="flex-grow -mt-8 relative z-10 max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 w-full pb-16">
        
        {/* TAB NAVIGATION */}
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-2 mb-8 flex flex-col sm:flex-row gap-2 justify-center border border-gray-100 sm:sticky sm:top-[72px] z-30">
          <button 
            onClick={() => setActiveTab('beli')} 
            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'beli' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:bg-brand-50 hover:text-brand-700'}`}
          >
            <i className="fa-solid fa-bag-shopping"></i> Beli Alat
          </button>
          
          <button 
            onClick={() => setActiveTab('sewa')} 
            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'sewa' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:bg-brand-50 hover:text-brand-700'}`}
          >
            <i className="fa-solid fa-tent"></i> Sewa Alat
          </button>
          
          <button 
            onClick={() => setActiveTab('guide')} 
            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors flex items-center justify-center gap-2 relative ${activeTab === 'guide' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:bg-brand-50 hover:text-brand-700'}`}
          >
            <i className="fa-solid fa-map-location-dot"></i> Booking Guide
            <span className="absolute top-1 right-2 sm:right-4 bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full border border-orange-200">NEW</span>
          </button>
        </div>

        {/* TAB CONTENT AREA */}
        {activeTab === 'beli' && <BuySection />}
        {activeTab === 'sewa' && <RentSection />}
        {activeTab === 'guide' && <GuideSection />}

      </main>
    </>
  );
};