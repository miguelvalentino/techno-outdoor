// src/pages/HomePage.jsx
import { useState } from 'react';
import { BuySection } from '../components/BuySection';
import { RentSection } from '../components/RentSection'; 
import { GuideSection } from '../components/GuideSection'; 

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('beli');

  return (
    <>
      <section className="overflow-hidden bg-[#10251d] text-white" aria-labelledby="outdoor-tagline">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:min-h-[590px] lg:grid-cols-2 lg:gap-12 lg:px-12 lg:py-20">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              <i className="fa-solid fa-mountain-sun" aria-hidden="true"></i>
              Outdoor Warrent · Teman Petualang
            </p>
            <h2 id="outdoor-tagline" className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Petualangan lebih siap, <span className="text-emerald-300">alam lebih dekat.</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-emerald-50/90 sm:text-lg">
              Semua kebutuhan pendakian dalam satu tempat. Beli atau sewa perlengkapan camping, lalu temukan pemandu profesional untuk menemani perjalananmu.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" aria-controls="layanan" onClick={() => document.getElementById('layanan')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3.5 font-bold text-[#10251d] shadow-lg shadow-black/20 transition hover:bg-emerald-300">
                Jelajahi Website <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </div>
            <div className="mt-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-100/80">Akses website Outdoor Warrent</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" aria-controls="layanan" onClick={() => document.getElementById('layanan')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Tampilan Google Play, aplikasi belum tersedia" className="flex min-w-[170px] items-center gap-3 rounded-xl border border-white/20 bg-black/35 px-4 py-2.5 text-left text-white transition hover:bg-black/60">
                  <i className="fa-brands fa-google-play text-2xl" aria-hidden="true"></i>
                  <span className="text-left leading-tight"><span className="block text-[10px] text-emerald-100/80">GET IT ON</span><span className="font-semibold">Google Play</span></span>
                </button>
                <button type="button" aria-controls="layanan" onClick={() => document.getElementById('layanan')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Tampilan App Store, aplikasi belum tersedia" className="flex min-w-[170px] items-center gap-3 rounded-xl border border-white/20 bg-black/35 px-4 py-2.5 text-left text-white transition hover:bg-black/60">
                  <i className="fa-brands fa-apple text-3xl" aria-hidden="true"></i>
                  <span className="text-left leading-tight"><span className="block text-[10px] text-emerald-100/80">Download on the</span><span className="font-semibold">App Store</span></span>
                </button>
              </div>
              <p className="mt-2 text-xs text-emerald-100/80">(Hanya tampilan, aplikasi tidak tersedia. Layanan hanya melalui website.)</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-5 rounded-[2rem] bg-emerald-400/20 blur-3xl" aria-hidden="true"></div>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85"
                alt="Pemandangan alam dan pegunungan untuk inspirasi pendakian"
                className="h-[300px] w-full rounded-[1.5rem] object-cover sm:h-[390px] lg:h-[440px]"
              />
              <div className="absolute right-5 top-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-black/35 text-3xl text-white shadow-lg backdrop-blur-md sm:right-7 sm:top-7 sm:h-20 sm:w-20 sm:text-4xl">
                <i className="fa-solid fa-compass" aria-hidden="true"></i>
              </div>
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/20 bg-black/45 p-4 backdrop-blur-md sm:inset-x-7 sm:bottom-7 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Rencanakan pendakianmu</p>
                <p className="mt-1 text-lg font-bold sm:text-xl">Perlengkapan, sewa & pemandu dalam satu website</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#f5f5f4] px-4 py-7 text-gray-900 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-[1440px] gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg text-brand-700"><i className="fa-solid fa-bag-shopping" aria-hidden="true"></i></span>
              <h3 className="mb-1 font-bold">Beli alat camping</h3>
              <p className="text-sm leading-relaxed text-gray-600">Temukan perlengkapan outdoor original sesuai kebutuhan dan anggaran.</p>
            </article>
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-lg text-orange-600"><i className="fa-solid fa-tent" aria-hidden="true"></i></span>
              <h3 className="mb-1 font-bold">Sewa sesuai tanggal</h3>
              <p className="text-sm leading-relaxed text-gray-600">Atur durasi dan cek biaya sewa perlengkapan sebelum memesan.</p>
            </article>
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-lg text-sky-700"><i className="fa-solid fa-map-location-dot" aria-hidden="true"></i></span>
              <h3 className="mb-1 font-bold">Booking pemandu profesional</h3>
              <p className="text-sm leading-relaxed text-gray-600">Pilih pemandu berdasarkan tujuan, pengalaman, keahlian, dan jadwal tersedia.</p>
            </article>
          </div>
        </div>
      </section>

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

      <main id="layanan" className="flex-grow -mt-8 relative z-10 max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 w-full pb-16 scroll-mt-24">
        
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