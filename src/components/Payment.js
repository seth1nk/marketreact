import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Мы убрали axios, так как запрос теперь делает бот, а не сайт

const Payment = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // !!! ВАЖНО: УКАЖИ ЗДЕСЬ ИМЯ СВОЕГО БОТА (без @) !!!
  const BOT_USERNAME = "oplata_aptbot"; 

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setIsAuthenticated(true);

    const storedOrderId = localStorage.getItem('orderId');
    if (!storedOrderId) {
      setError('Идентификатор заказа не найден. Пожалуйста, оформите заказ заново.');
    } else {
      setOrderId(storedOrderId);
    }
  }, [navigate]);

  // ЭТА ФУНКЦИЯ ТЕПЕРЬ ОТКРЫВАЕТ ТЕЛЕГРАМ
  const handleGoToBot = () => {
    if (!orderId) {
      setError('Идентификатор заказа не найден');
      return;
    }
    
    // 1. Открываем бота в новой вкладке
    window.open(`https://t.me/${BOT_USERNAME}?start=${orderId}`, '_blank');
    
    // 2. Очищаем корзину, так как заказ передан в работу (в бота)
    localStorage.removeItem('cart');
    localStorage.removeItem('coupon');
    localStorage.removeItem('discount');
    // Не удаляем orderId сразу, если хочешь, чтобы пользователь видел номер, но можно и удалить
    // localStorage.removeItem('orderId');

    // 3. Можно перенаправить пользователя на список заказов, чтобы он ждал смены статуса
    navigate('/marketplace'); 
  };

  return (
    <div className="payment-container" style={{ position: 'relative', minHeight: '100vh' }}>
      <div className="master-container">
        <div className="payment-card">
          <label className="title">Оплата заказа №{orderId}</label>
          
          <div style={{ margin: '20px 0', textAlign: 'center', color: '#555' }}>
            <p>Заказ успешно сформирован со статусом <b>"Новый"</b>.</p>
            <p>Чтобы выбрать способ оплаты (полностью, частями или по договоренности) и запустить заказ в работу, перейдите в нашего Telegram-бота.</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          
          <button
            className="button-submit"
            style={{ backgroundColor: '#0088cc' }} 
            onClick={handleGoToBot} // ВЫЗЫВАЕМ НОВУЮ ФУНКЦИЮ
            disabled={!orderId || !isAuthenticated}
          >
            Перейти к оплате в Telegram ✈️
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payment;