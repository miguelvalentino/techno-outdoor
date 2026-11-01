// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ToastNotification } from './components/ToastNotification';
import { CartProvider } from './context/CartContext';
// 1. Import AuthProvider
import { AuthProvider } from './context/AuthContext'; 

function App() {
  return (
    <AuthProvider> 
      <CartProvider>
        <Router>
          <div className="bg-earth-100 text-earth-800 font-sans antialiased flex flex-col min-h-screen relative">
            <Navbar />
            
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
            
            <Footer />
            <ToastNotification /> 
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;