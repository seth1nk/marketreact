import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import NavBar from './components/NavBar';
import { Banner } from './components/Banner';
import { Skills } from './components/Skills';
import { Projects } from './components/Projects';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import Login from './components/Login';
import Marketplace from './components/Marketplace';
import Payment from './components/Payment';
import AdminOrders from './components/AdminOrders';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';

const clientId = '631083577297-rehaq97hfnbn6vqkc3fje55ujfn3e8tm.apps.googleusercontent.com';

// Компонент для обработки реферального кода и перенаправления
function ReferralHandler({ setShowRegister, setShowLogin, handleRegisterSuccess, handleLoginSuccess, onLoginClose, onRegisterClose }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const ref = searchParams.get('ref');
    console.log('Referral code from URL:', ref);
    if (ref) {
      localStorage.setItem('referral_code', ref);
      setShowRegister(true); // Открываем модальное окно регистрации
      setShowLogin(false); // Закрываем окно логина, если открыто
    }
  }, [searchParams, setShowRegister, setShowLogin]);

  // Функция для регистрации с перенаправлением
  const handleRegisterSuccessWithRedirect = (userInfo) => {
    handleRegisterSuccess(userInfo);
    navigate('/'); // Перенаправляем на главную страницу
  };

  // Функция для входа с перенаправлением
  const handleLoginSuccessWithRedirect = (userInfo) => {
    handleLoginSuccess(userInfo);
    navigate('/'); // Перенаправляем на главную страницу
  };

  return (
    <>
      <Banner />
      <Skills />
      <Projects />
      <Contact />
      <Footer />
      <Login
        showLogin={false}
        showRegister={true}
        onLoginClose={onLoginClose}
        onRegisterClose={onRegisterClose}
        onLoginSuccess={handleLoginSuccessWithRedirect}
        onRegisterSuccess={handleRegisterSuccessWithRedirect}
        onLogout={() => {}} // Не используется в этом контексте
        onRegisterShow={() => setShowRegister(true)}
      />
    </>
  );
}

// Новый компонент для содержимого приложения
function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('token') || !!localStorage.getItem('google_access_token')
  );
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('userInfo')) || null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const navigate = useNavigate();

  const handleLoginShow = () => {
    setShowRegister(false);
    setShowLogin(true);
  };

  const handleRegisterShow = () => {
    setShowLogin(false);
    setShowRegister(true);
  };

  const handleLoginClose = () => setShowLogin(false);
  const handleRegisterClose = () => setShowRegister(false);

  const handleLoginSuccess = (userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo);
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    setShowLogin(false);
    setShowRegister(false); // Закрываем форму регистрации
    localStorage.removeItem('referral_code'); // Очищаем реферальный код после входа
    navigate('/'); // Перенаправляем на главную страницу
  };

  const handleRegisterSuccess = (userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo);
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    setShowRegister(false);
    localStorage.removeItem('referral_code'); // Очищаем реферальный код после регистрации
    navigate('/'); // Перенаправляем на главную страницу
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('referral_code');
    googleLogout();
    navigate('/'); // Перенаправляем на главную страницу после выхода
  };

  return (
    <div className="App">
      <NavBar
        onLoginShow={handleLoginShow}
        onRegisterShow={handleRegisterShow}
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={handleLogout}
      />
      <Login
        showLogin={showLogin}
        showRegister={showRegister}
        onLoginClose={handleLoginClose}
        onRegisterClose={handleRegisterClose}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterSuccess}
        onLogout={handleLogout}
        onRegisterShow={handleRegisterShow}
      />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Banner />
              <Skills />
              <Projects />
              <Contact />
              <Footer />
            </>
          }
        />
        <Route
          path="/marketplace"
          element={<Marketplace user={user} isAuthenticated={isAuthenticated} />}
        />
        <Route path="/payment" element={<Payment />} />
        <Route path="/admin-orders" element={<AdminOrders user={user} />} />
        <Route
          path="/register"
          element={
            <ReferralHandler
              setShowRegister={setShowRegister}
              setShowLogin={setShowLogin}
              handleRegisterSuccess={handleRegisterSuccess}
              handleLoginSuccess={handleLoginSuccess}
              onLoginClose={handleLoginClose}
              onRegisterClose={handleRegisterClose}
            />
          }
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Router>
        <AppContent />
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;