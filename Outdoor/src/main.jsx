import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Muat Midtrans Snap SDK secara dinamis berdasarkan env Vite
const midtransClientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
const midtransIsProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
if (midtransClientKey) {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = midtransIsProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
  script.setAttribute('data-client-key', midtransClientKey);
  script.id = 'midtrans-snap-script';
  document.head.appendChild(script);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)