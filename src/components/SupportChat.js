import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import defaultAvatar from '../assets/img/profile.png';
import '../assets/css/SupportChat.css';

const SupportChat = ({ isOpen, onClose, user, isAuthenticated }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('light');
  const isAdmin = user?.name === 'seth1nk';
  const messagesEndRef = useRef(null);

useEffect(() => {
    if (isOpen && isAuthenticated) {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Токен авторизации отсутствует. Пожалуйста, войдите заново.');
        return;
      }

      // Первая загрузка
      fetchUsers();
      fetchMessages();

      // Автообновление каждые 3 секунды
      const interval = setInterval(() => {
        fetchMessages(); // Обновляем сообщения
        if (isAdmin) {
             fetchUsers(); // ВАЖНО: Обновляем список пользователей!
        }
      }, 3000); 

      return () => clearInterval(interval);
    }
  }, [isOpen, isAuthenticated, selectedUser]); // theme или другие зависимости, если нужно

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchUsers = async () => {
    if (isAdmin) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('https://market.apt142.ru/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const filteredUsers = response.data.filter((u) => u.id !== user.id);
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      }
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      const recipientId = isAdmin && selectedUser ? selectedUser.id : 1;
      const response = await axios.get('https://market.apt142.ru/messages', {
        headers: { Authorization: `Bearer ${token}` },
        params: { recipientId },
      });
      setMessages(response.data);
      setError('');
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const recipientId = isAdmin && selectedUser ? selectedUser.id : 1;
      const response = await axios.post(
        'https://market.apt142.ru/messages',
        { recipientId, content: newMessage, isComplaint: false },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, response.data]);
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Ошибка отправки:', error);
      setError('Не удалось отправить сообщение');
    }
  };

  const handleUserSelect = (selectedUser) => {
    setSelectedUser(selectedUser);
    setMessages([]);
    setError('');
    fetchMessages();
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose();
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  if (!isOpen) return null;

  return (
    <div className={`support-chat-modal ${theme}`}>
      <div className="support-chat-content">
        <div className="support-chat-header">
          <h3>Техподдержка</h3>
          <div className="header-controls">
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="support-chat-close-btn" onClick={handleClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="support-chat-body">
          {isAdmin && (
            <div className="support-chat-users">
              {error && <p className="error-message">{error}</p>}
              {users.length === 0 ? (
                <p className="no-users"></p>
              ) : (
                <div className="users-list">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`user-item ${selectedUser?.id === u.id ? 'selected' : ''}`}
                      onClick={() => handleUserSelect(u)}
                    >
                      <img src={u.picture || defaultAvatar} alt="Avatar" className="user-avatar" />
                      <span>{u.name || 'Без имени'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="support-chat-messages">
            {error && <p className="error-message">{error}</p>}
            {isAdmin && !selectedUser ? (
              <p className="no-user-selected">Выберите пользователя для чата</p>
            ) : (
              <>
                <div className="messages-container">
                  {messages.map((msg, index) => {
                    // Проверка на жалобу: учитываем регистр БД и текст
                    const isComplaint = 
                      msg.iscomplaint === true || 
                      msg.isComplaint === true || 
                      msg.content === 'Покупателя не устраивает заказ';

                    return (
                      <div
                        key={index}
                        className={`message ${msg.sender_id === user.id ? 'sent' : 'received'} ${
                          isComplaint ? 'complaint' : ''
                        }`}
                      >
                        <div className="message-content">
                          {isComplaint && (
                            <span className="complaint-icon">❌</span>
                          )}
                          <p>{msg.content}</p>
                          <div className="message-meta">
                            <span className="message-time">
                              {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.sender_id === user.id && (
                              <span className={`message-status ${msg.status}`}>
                                {msg.status === 'read' && (
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="black">
                                    <path d="M9 16.2l-3.5-3.5L4 14.1 9 19.1l11-11-1.4-1.4L9 16.2z"/>
                                    <path d="M14 16.2l-3.5-3.5L9 14.1l5 5 5-5-1.4-1.4L14 16.2z"/>
                                  </svg>
                                )}
                                {msg.status === 'delivered' && (
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="black">
                                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                                  </svg>
                                )}
                                {msg.status === 'error' && (
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <circle cx="12" cy="12" r="10" fill="red" />
                                    <path d="M12 8v4m0 2h.01" stroke="white" strokeWidth="2" />
                                  </svg>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <form className="message-form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Напишите сообщение..."
                    disabled={isAdmin && !selectedUser}
                  />
                  <button type="submit" disabled={isAdmin && !selectedUser}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3v7l15 2-15 2z"/>
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportChat;
