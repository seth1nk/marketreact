import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../assets/css/Marketplace.css';
import '../assets/css/Referral.css';
import Particles from './Particles';
import SupportChat from './SupportChat'; // Добавлен импорт

// Импорт изображений
import serviceImage1 from '../assets/img/1.png';
import serviceImage2 from '../assets/img/2.png';
import serviceImage3 from '../assets/img/3.png';
import serviceImage4 from '../assets/img/4.png';
import serviceImage5 from '../assets/img/5.png';
import serviceImage6 from '../assets/img/6.png';

// Импорт иконок для файлов
import cssIcon from '../assets/img/css.png';
import jsIcon from '../assets/img/js.png';
import pptxIcon from '../assets/img/pptx.png';
import docIcon from '../assets/img/doc.png';
import mp3Icon from '../assets/img/mp3.png';
import jpegIcon from '../assets/img/jpeg.png';
import pptIcon from '../assets/img/ppt.png';
import exeIcon from '../assets/img/exe.png';
import csvIcon from '../assets/img/csv.png';
import zipIcon from '../assets/img/zip.png';
import rarIcon from '../assets/img/rar.png';
import dllIcon from '../assets/img/dll.png';
import gifIcon from '../assets/img/gif.png';
import pngIcon from '../assets/img/png.png';
import sevenZIcon from '../assets/img/7z.png';
import docxIcon from '../assets/img/docx.png';

const Marketplace = ({ user, isAuthenticated }) => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);

  const [cart, setCart] = useState([]);
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [showOrders, setShowOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create'); // 'create', 'edit', 'view'
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralData, setReferralData] = useState({
    referralLink: '',
    referralCount: 0,
    discount: 0,
  });
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    subject: '',
    subtasks: [],
    deadline: '',
    files: [],
    voiceMessages: [],
    items: []
  });
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [voiceStates, setVoiceStates] = useState([]);
  const voiceAudioRefs = useRef([]);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false); // Новое состояние для чата

  // Маппинг иконок для расширений файлов
  const fileIcons = {
    css: cssIcon,
    js: jsIcon,
    pptx: pptxIcon,
    doc: docIcon,
    mp3: mp3Icon,
    jpeg: jpegIcon,
    jpg: jpegIcon,
    ppt: pptIcon,
    exe: exeIcon,
    csv: csvIcon,
    zip: zipIcon,
    rar: rarIcon,
    dll: dllIcon,
    gif: gifIcon,
    png: pngIcon,
    '7z': sevenZIcon,
    docx: docxIcon,
    webm: mp3Icon,
  };

  useEffect(() => {
    fetchProducts(); // Загружаем товары
    if (isAuthenticated) {
      fetchOrders();
      fetchReferralData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setVoiceStates(
      formData.voiceMessages.map((voice) => ({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        size: voice.size
          ? (voice.size / (1024 * 1024)).toFixed(2) + ' МБ'
          : 'Неизвестно',
      }))
    );

    const urls = [];
    formData.voiceMessages.forEach((voice, index) => {
      if (!voice) {
        console.error(`Voice message ${index + 1} is undefined`);
        setError(`Голосовое сообщение ${index + 1} отсутствует`);
        return;
      }

      const audio = new Audio();
      let src = '';
      if (voice instanceof Blob || voice instanceof File) {
        src = URL.createObjectURL(voice);
        urls.push(src);
        console.log(`Voice message ${index + 1} is Blob/File, src: ${src}, size: ${voice.size}`);
      } else if (voice.path) {
        src = `https://market.apt142.ru/${voice.path}`;
        console.log(`Voice message ${index + 1} is server file, src: ${src}, size: ${voice.size}`);
      } else {
        console.error(`Invalid voice message at index ${index}:`, voice);
        setError(`Некорректное голосовое сообщение ${index + 1}`);
        return;
      }
      audio.src = src;
      audio.muted = true;

      let attempts = 0;
      const maxAttempts = 5;
      const retryDelay = 1500;

      const loadDuration = () => {
        attempts++;
        console.log(`Attempt ${attempts} to load duration for voice message ${index + 1}, readyState: ${audio.readyState}`);
        audio.play()
          .then(() => {
            const duration = audio.duration;
            console.log(`Duration loaded for voice message ${index + 1}, attempt ${attempts}: ${duration}`);
            if (isFinite(duration) && duration > 0) {
              setVoiceStates((prev) =>
                prev.map((state, i) =>
                  i === index ? { ...state, duration } : state
                )
              );
              audio.pause();
              audio.currentTime = 0;
            } else if (attempts < maxAttempts) {
              setTimeout(loadDuration, retryDelay);
            } else {
              setVoiceStates((prev) =>
                prev.map((state, i) =>
                  i === index ? { ...state, duration: 0 } : state
                )
              );
              setError(`Не удалось загрузить длительность для голосового сообщения ${index + 1}`);
            }
          })
          .catch((err) => {
            console.error(`Playback error for voice message ${index + 1}, attempt ${attempts}, src: ${src}, error:`, err);
            if (attempts < maxAttempts) {
              setTimeout(loadDuration, retryDelay);
            } else {
              setVoiceStates((prev) =>
                prev.map((state, i) =>
                  i === index ? { ...state, duration: 0 } : state
                )
              );
              setError(`Не удалось загрузить длительность для голосового сообщения ${index + 1}: ${err.message}`);
            }
          });
      };

      if (voice instanceof Blob || voice instanceof File) {
        if (voice.size === 0) {
          console.error(`Voice message ${index + 1} has zero size`);
          setError(`Голосовое сообщение ${index + 1} пустое`);
          return;
        }
      }

      loadDuration();
    });

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [formData.voiceMessages]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get('https://market.apt142.ru/products');
      const mappedServices = response.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: parseFloat(p.price),
        // Если есть картинка в базе - используем, иначе заглушку serviceImage6
        image: p.image ? `https://market.apt142.ru/${p.image}` : serviceImage6, 
      }));
      setServices(mappedServices);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      // Если ошибка (сервер не готов), оставляем пустой список или можно вернуть старый хардкод здесь
    }
  };
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }
      const response = await axios.get('https://market.apt142.ru/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched orders:', response.data);
      const fetchedOrders = response.data.map((order) => {
        const files = Array.isArray(order.files) ? order.files : [];
        return {
          id: order.id,
          title: order.subject || `Заказ №${order.order_number || order.id}`,
          status: order.status || 'new',
          payment_status: order.payment_status || 'pending',
          date: new Date(order.date || order.createdAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          }),
          placed_at: order.placed_at
            ? new Date(order.placed_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })
            : order.date,
          processing_at: order.processing_at
            ? new Date(order.processing_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
          delivered_at: order.delivered_at
            ? new Date(order.delivered_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
          items: order.items || [],
          files: files.map((file, index) => ({
            file_path: file.file_path || file.path || '',
            originalname:
              file.is_voice_message
                ? `Голосовое сообщение ${index + 1}`
                : file.originalname || `Файл ${index + 1}`,
            size: file.size || 0,
            is_voice_message: file.is_voice_message || file.isVoiceMessage || false,
          })),
          subject: order.subject || '',
          task: order.task || '',
          deadline: order.deadline || '',
          coupon_code: order.coupon_code || '',
          discount: order.discount || 0,
          total: parseFloat(order.total) || 0,
        };
      });
      console.log('Mapped orders:', fetchedOrders);
      setOrders(fetchedOrders);
      setError('');
    } catch (error) {
      setError(error.response?.data?.error || 'Не удалось загрузить заказы');
      console.error('Fetch orders error:', error);
    }
  };

  const fetchReferralData = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }
      const response = await axios.get('https://market.apt142.ru/referrals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReferralData(response.data);
      setReferralDiscount((subtotal * response.data.discount) / 100);
      setError('');
    } catch (error) {
      console.error('Referral fetch error:', error.response?.data || error.message);
      setError(error.response?.data?.error || 'Не удалось загрузить реферальную информацию');
    }
  };

  useEffect(() => {
    if (referralData.discount > 0) {
      setReferralDiscount((subtotal * referralData.discount) / 100);
    }
  }, [cart, referralData.discount]);

  const addToCart = (service) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === service.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === service.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const updatedCart = [...prevCart, { ...service, quantity: 1 }];
      setFormData((prev) => ({
        ...prev,
        subject: updatedCart.length === 1 ? `${service.name} на тему « »` : prev.subject,
      }));
      return updatedCart;
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prevCart) => {
      const updatedCart = prevCart
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0);
      if (updatedCart.length === 0) {
        setFormData((prev) => ({ ...prev, subject: '' }));
      }
      return updatedCart;
    });
  };

  const applyCoupon = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://market.apt142.ru/coupons/apply', { code: coupon });
      const discountPercentage = response.data.discount_percentage;
      setDiscount((subtotal * discountPercentage) / 100);
      setError('');
    } catch (error) {
      setDiscount(0);
      setError(error.response?.data?.error || 'Не удалось применить купон');
    }
  };

  const handleOrderClick = (orderId) => {
    setSelectedOrderId(orderId);
  };
const handleOpenOrder = (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      setError('Заказ не найден');
      return;
    }
    
    // Сохраняем товары во внутреннюю память формы, а не в корзину
    const orderItems = order.items.map(item => ({
        id: item.product_id,
        price: item.price,
        quantity: item.quantity
    }));

    setFormData({
      subject: order.subject || '',
      subtasks: order.task ? order.task.split(';').filter((t) => t.trim()) : [],
      deadline: order.deadline ? new Date(order.deadline).toISOString().slice(0, 16) : '',
      items: orderItems, // <-- Товары здесь
      files: order.files.filter((f) => !f.is_voice_message),
      voiceMessages: order.files.filter((f) => f.is_voice_message),
    });

    setFormMode('view');
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };
const handleEditOrder = (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      setError('Заказ не найден');
      return;
    }

    const orderItems = order.items.map(item => ({
        id: item.product_id,
        price: item.price,
        quantity: item.quantity
    }));

    setFormData({
      subject: order.subject || '',
      subtasks: order.task ? order.task.split(';').filter((t) => t.trim()) : [],
      deadline: order.deadline ? new Date(order.deadline).toISOString().slice(0, 16) : '',
      items: orderItems, // <-- Товары здесь
      files: order.files.filter((f) => !f.is_voice_message && f.file_path),
      voiceMessages: order.files.filter((f) => f.is_voice_message && f.file_path),
    });

    setFormMode('edit');
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };
  const deleteOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        setError('Токен авторизации отсутствует');
        return;
      }
      await axios.delete(`https://market.apt142.ru/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders((prevOrders) => prevOrders.filter((order) => order.id !== orderId));
      setSelectedOrderId(null);
      setError(`Заказ №${orderId} успешно удален`);
      handleModalClose();
      setTimeout(() => setError(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Не удалось удалить заказ');
      console.error('Delete order error:', error);
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      setError('Пожалуйста, войдите в аккаунт, чтобы оформить заказ');
      return;
    }
    setFormMode('create');
    setSelectedOrderId(null);
    setFormData({
      subject: cart.length > 0 ? `${cart[0].name} на тему « »` : '',
      subtasks: [],
      deadline: '',
      files: [],
      voiceMessages: [],
      items: [] // <-- Очищаем список
    });
    setVoiceStates([]);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setFormMode('create');
    setSelectedOrderId(null);
    setError('');
    setVoiceStates([]);
    voiceAudioRefs.current.forEach((audio) => audio && audio.pause());
    voiceAudioRefs.current = [];
  };
const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.deadline) {
      setError('Заполните все обязательные поля');
      return;
    }
    const selectedDate = new Date(formData.deadline);
    const now = new Date();
    if (selectedDate < now) {
      setError('Дата и время не могут быть в прошлом');
      return;
    }
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) throw new Error('Токен авторизации отсутствует');

      // === ЛОГИКА ВЫБОРА ИСТОЧНИКА ТОВАРОВ ===
      const currentItems = formMode === 'create' ? cart : formData.items;
      
      // Считаем сумму локально для этого заказа
      const currentSubtotal = currentItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const currentTotal = currentSubtotal * (1 - (discount + referralDiscount) / 100);

      const orderData = {
        items: currentItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        coupon_code: coupon,
        discount: discount + referralDiscount,
        total: currentTotal.toFixed(2), // Используем пересчитанную сумму
        subject: formData.subject,
        task: formData.subtasks.join(';'),
        deadline: formData.deadline,
        existingFiles: formData.files
          .filter((file) => file.path && !(file instanceof File))
          .map((file) => ({
            path: file.path,
            originalname: file.name,
            size: file.size,
          })),
        existingVoiceMessages: formData.voiceMessages
          .filter((voice) => voice.path && !(voice instanceof File || voice instanceof Blob))
          .map((voice, index) => ({
            path: voice.path,
            originalname: voice.name || `Голосовое сообщение ${index + 1}`,
            size: voice.size,
          })),
      };

      const formDataToSend = new FormData();
      formDataToSend.append('order', JSON.stringify(orderData));
      
      formData.files.forEach((file, index) => {
        if (file instanceof File) {
          formDataToSend.append('files', file, file.name);
        }
      });
      
      formData.voiceMessages.forEach((voice, index) => {
        if (voice instanceof Blob || voice instanceof File) {
          const fileName = voice.name || `Голосовое сообщение ${index + 1}.webm`;
          formDataToSend.append('voiceMessages', voice, fileName);
        }
      });

      if (formMode === 'edit' && selectedOrderId) {
        await axios.put(`https://market.apt142.ru/orders/${selectedOrderId}`, formDataToSend, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        setError(`Заказ №${selectedOrderId} успешно обновлен`);
        handleModalClose();
      } else if (formMode === 'create') {
        const response = await axios.post('https://market.apt142.ru/orders', formDataToSend, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        localStorage.setItem('coupon', coupon);
        localStorage.setItem('discount', (discount + referralDiscount).toString());
        localStorage.setItem('orderDetails', JSON.stringify(formData));
        localStorage.setItem('orderId', response.data.orderId);
        setError(`Заказ №${response.data.orderId} успешно создан`);
        setSelectedOrderId(response.data.orderId);
        setShowOrders(true);
        handleModalClose();
        navigate('/payment');
      }

      await fetchOrders();
      setTimeout(() => setError(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Не удалось оформить/обновить заказ');
      console.error('Submit order error:', error);
    }
  };

  const handleReportIssue = async () => {
  if (!isAuthenticated) {
    setError('Пожалуйста, войдите в аккаунт, чтобы отправить жалобу');
    return;
  }

  setIsSupportChatOpen(true); // Открываем чат

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
    if (!token) {
      setError('Токен авторизации отсутствует');
      return;
    }

    const recipientId = 1; // ID администратора
    const content = 'Покупателя не устраивает заказ';
    const response = await axios.post(
      'https://market.apt142.ru/messages',
      { recipientId, content, isComplaint: true },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Response from server:', response.data); // Для отладки
    setError('Жалоба успешно отправлена');
    setTimeout(() => setError(''), 3000);
  } catch (error) {
    setError('Не удалось отправить жалобу: ' + (error.response?.data?.error || error.message));
    console.error('Ошибка отправки жалобы:', error);
  }
};

  const handleReferralModalOpen = () => {
    setIsReferralModalOpen(true);
  };

  const handleReferralModalClose = () => {
    setIsReferralModalOpen(false);
    setError('');
  };

  const copyReferralLink = () => {
    if (!referralData.referralLink) {
      setError('Реферальная ссылка не доступна');
      return;
    }
    navigator.clipboard.writeText(referralData.referralLink);
    setError('Реферальная ссылка скопирована в буфер обмена!');
    setTimeout(() => setError(''), 3000);
  };

  const handleDownload = async (e, file, fileName) => {
    e.preventDefault();
    const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
    if (!token) {
      setError('Токен авторизации отсутствует');
      console.error('Токен отсутствует');
      return;
    }

    if (file instanceof Blob || file instanceof File) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } else if (file.path) {
      const filename = encodeURIComponent(fileName || file.originalname || 'file');
      try {
        const response = await fetch(`https://market.apt142.ru/download/${filename}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName || file.originalname || 'file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        setError('Не удалось скачать файл');
        console.error('Ошибка скачивания:', error.message);
      }
    } else {
      setError('Не удалось скачать файл: неверный формат');
      console.error('Invalid file for download:', file);
    }
  };

  const addSubtask = () => {
    if (formMode === 'create' || formMode === 'edit') {
      setFormData({ ...formData, subtasks: [...formData.subtasks, ''] });
    }
  };

  const removeSubtask = (index) => {
    if (formMode === 'create' || formMode === 'edit') {
      setFormData({
        ...formData,
        subtasks: formData.subtasks.filter((_, i) => i !== index),
      });
    }
  };

  const updateSubtask = (index, value) => {
    if (formMode === 'create' || formMode === 'edit') {
      const newSubtasks = [...formData.subtasks];
      newSubtasks[index] = value;
      setFormData({ ...formData, subtasks: newSubtasks });
    }
  };

  const startRecording = async () => {
    if (formMode !== 'create' && formMode !== 'edit') return;
    if (formData.voiceMessages.length >= 3) {
      setError('Максимум 3 голосовых сообщения разрешено');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      setMediaRecorder(recorder);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size === 0) {
          setError('Запись не удалась: пустой файл');
          console.error('Recording resulted in empty blob');
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const file = new File([blob], `Голосовое сообщение ${formData.voiceMessages.length + 1}.webm`, {
          type: 'audio/webm',
        });
        setFormData({
          ...formData,
          voiceMessages: [...formData.voiceMessages, file],
        });
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecording(false);
        }
      }, 30000);
    } catch (error) {
      setError('Не удалось начать запись: ' + error.message);
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = (e) => {
    if (formMode !== 'create' && formMode !== 'edit') return;
    const newFiles = Array.from(e.target.files);
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg',
      'audio/webm',
      'text/css',
      'application/javascript',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-msdownload',
      'text/csv',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-msdos-program',
    ];
    const invalidFiles = newFiles.filter((file) => !allowedTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      setError(
        `Недопустимые типы файлов: ${invalidFiles
          .map((f) => f.name)
          .join(', ')}. Разрешены: jpg, jpeg, png, gif, pdf, doc, docx, mp3, webm, css, js, pptx, ppt, exe, csv, zip, rar, dll, 7z`
      );
      return;
    }
    if (formData.files.length + newFiles.length > 8) {
      setError('Максимум 8 файлов разрешено');
      return;
    }
    setFormData({ ...formData, files: [...formData.files, ...newFiles] });
  };

  const removeFile = (index) => {
    if (formMode !== 'create' && formMode !== 'edit') return;
    setFormData({
      ...formData,
      files: formData.files.filter((_, i) => i !== index),
    });
  };

  const removeVoiceMessage = (index) => {
    if (formMode !== 'create' && formMode !== 'edit') return;
    setFormData({
      ...formData,
      voiceMessages: formData.voiceMessages.filter((_, i) => i !== index),
    });
    if (voiceAudioRefs.current[index]) {
      voiceAudioRefs.current[index].pause();
      voiceAudioRefs.current[index] = null;
    }
    setVoiceStates((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleVoiceMessage = (voice, index) => {
    const audio = voiceAudioRefs.current[index] || new Audio();
    voiceAudioRefs.current[index] = audio;

    let src = '';
    if (voice instanceof Blob || voice instanceof File) {
      src = URL.createObjectURL(voice);
      console.log(`Playing voice message ${index + 1} from Blob/File, src: ${src}`);
    } else if (voice.path) {
      src = `https://market.apt142.ru/${voice.path}`;
      console.log(`Playing voice message ${index + 1} from server, src: ${src}`);
    } else {
      setError('Не удалось воспроизвести голосовое сообщение');
      console.error(`Invalid voice message at index ${index}:`, voice);
      return;
    }
    audio.src = src;
    audio.muted = false;

    if (voiceStates[index].isPlaying) {
      audio.pause();
      setVoiceStates((prev) =>
        prev.map((state, i) =>
          i === index ? { ...state, isPlaying: false } : state
        )
      );
    } else {
      audio.play().catch((err) => {
        setError('Ошибка воспроизведения: ' + err.message);
        console.error(`Playback error for voice message ${index + 1}, src: ${src}, error:`, err);
      });
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        console.log(`Duration loaded during playback for voice message ${index + 1}: ${duration}`);
        if (isFinite(duration) && duration > 0) {
          setVoiceStates((prev) =>
            prev.map((state, i) =>
              i === index ? { ...state, duration } : state
            )
          );
        }
      };
      audio.ontimeupdate = () => {
        setVoiceStates((prev) =>
          prev.map((state, i) =>
            i === index ? { ...state, currentTime: audio.currentTime } : state
          )
        );
      };
      audio.onended = () => {
        setVoiceStates((prev) =>
          prev.map((state, i) =>
            i === index ? { ...state, isPlaying: false, currentTime: 0 } : state
          )
        );
      };
      setVoiceStates((prev) =>
        prev.map((state, i) =>
          i === index ? { ...state, isPlaying: true } : state
        )
      );
    }
  };

  const handleVoiceProgressChange = (index, value) => {
    const audio = voiceAudioRefs.current[index];
    if (audio && isFinite(voiceStates[index]?.duration)) {
      audio.currentTime = parseFloat(value);
      setVoiceStates((prev) =>
        prev.map((state, i) =>
          i === index ? { ...state, currentTime: parseFloat(value) } : state
        )
      );
    } else {
      console.warn(`Cannot update progress for voice message ${index + 1}: audio=${!!audio}, duration=${voiceStates[index]?.duration}`);
    }
  };

  const formatDuration = (seconds) => {
    if (!isFinite(seconds) || seconds <= 0) {
      return 'Ожидание...';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || !isFinite(bytes)) return 'Неизвестно';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} МБ`;
  };

  const getCurrentTime = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now.toISOString().slice(0, 16);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - discount - referralDiscount;

  const getBatteryProgress = () => {
    const { referralCount } = referralData;
    const progress = Math.min((referralCount / 30) * 100, 100);
    return progress;
  };

  const getFileIcon = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
      return pngIcon;
    }
    const extension = fileName.split('.').pop().toLowerCase();
    return fileIcons[extension] || pngIcon;
  };
const getOrderStatusStep = (status) => {
    switch (status) {
      case 'completed':
        return 3; // Все 3 шага зеленые
      case 'in-progress':
        return 2; // 1 и 2 шага зеленые
      case 'canceled':
        return -1;
      case 'new':
        return 1; // Только 1 шаг зеленый (Заказ размещен)
      default:
        return 0; // Ничего не готово
    }
  };

  return (
    <div className="marketplace-container" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
        <Particles
          particleColors={['#ffffff', '#ffffff']}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={true}
          alphaParticles={false}
          disableRotation={false}
        />
      </div>
      <div className="master-container">
        <div className="cart-card">
          <label className="title">Ваша корзина</label>
          <div className="products">
            {cart.length === 0 ? (
              <p className="empty-cart">Корзина пуста</p>
            ) : (
              cart.map((item) => (
                <div className="product" key={item.id}>
<svg fill="none" viewBox="0 0 60 60" height="60" width="60" xmlns="http://www.w3.org/2000/svg">
  {/* Фон (как был) */}
  <rect fill="#FFF6EE" rx="8.25" height="60" width="60"></rect>
  
  {/* Нижняя часть шапочки */}
  <path 
    d="M17 32V38C17 42.5 43 42.5 43 38V32" 
    fill="#FFB672" 
    stroke="#FF8413" 
    strokeWidth="2.25" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  ></path>
  
  {/* Верхняя часть (ромб) */}
  <path 
    d="M30 16L54 27L30 38L6 27L30 16Z" 
    fill="#FFB672" 
    stroke="#FF8413" 
    strokeWidth="2.25" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  ></path>
  
  {/* Кисточка */}
  <path 
    d="M54 27V36" 
    stroke="#FF8413" 
    strokeWidth="2.25" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  ></path>
  <circle 
    cx="54" 
    cy="40" 
    r="3" 
    fill="#FFB672" 
    stroke="#FF8413" 
    strokeWidth="2.25"
  ></circle>
</svg>
                  <div>
                    <span>{item.name}</span>
                  </div>
                  <div className="quantity">
                    <button onClick={() => updateQuantity(item.id, -1)}>
                      <svg fill="none" viewBox="0 0 24 24" height="14" width="14" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#47484b" d="M20 12L4 12"></path>
                      </svg>
                    </button>
                    <label>{item.quantity}</label>
                    <button onClick={() => updateQuantity(item.id, 1)}>
                      <svg fill="none" viewBox="0 0 24 24" height="14" width="14" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2.5" stroke="#47484b" d="M12 4V20M20 12H4"></path>
                      </svg>
                    </button>
                  </div>
                  <label className="price small">{Math.floor(item.price * item.quantity)}₽</label>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="coupon-card">
          <label className="title">Применить купоны</label>
          <form className="form" onSubmit={applyCoupon}>
            <input
              type="text"
              placeholder="Введите ваш купон"
              className="input_field"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
            />
            <button type="submit">Применить</button>
          </form>
        </div>
        <div className="checkout-card">
          <label className="title">Оформление заказа</label>
          <div className="details">
            <span>Сумма корзины:</span>
            <span>{Math.floor(subtotal).toFixed(2)}₽</span>
            <span>Скидка по купонам:</span>
            <span>{Math.floor(discount).toFixed(2)}₽</span>
            <span>Реферальная скидка:</span>
            <span>{Math.floor(referralDiscount).toFixed(2)}₽</span>
          </div>
          <div className="checkout--footer">
            <label className="price">{Math.floor(total).toFixed(2)}<sup>₽</sup></label>
            <button className="checkout-btn" onClick={handleCheckout} disabled={cart.length === 0}>
              Оформить заказ
            </button>
          </div>
        </div>
      </div>
      <div className="products-container">
        {services.map((service) => (
          <div className="card" key={service.id} data-price={`${Math.floor(service.price)}₽`}>
            <img src={service.image} alt={service.name} className="card__image" />
            <div className="card__content">
              <span className="title">{service.name}</span>
              <p>{service.description}</p>
              <button className="card__button" onClick={() => addToCart(service)}>
                Добавить в корзину
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="orders-btn"
        onClick={() => {
          setShowOrders(!showOrders);
          if (!showOrders) setSelectedOrderId(null);
        }}
      >
        <span>Заказы</span>
        {orders.length > 0 && <span className="count">{orders.length}</span>}
      </button>
      <button className="referrals-btn" onClick={handleReferralModalOpen}>
        <span>Рефералы</span>
      </button>
      {error && <p className="error-message">{error}</p>}
      {showOrders && (
        <div className="orders-list-container">
          <div className="orders-list">
            {orders.length === 0 ? (
              <p className="empty-orders">Нет заказов</p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className={`order-item order-${order.status || 'new'} ${selectedOrderId === order.id ? 'selected' : ''}`}
                  onClick={() => handleOrderClick(order.id)}
                >
                  <span className="order-title">{order.title}</span>
                  <span className="order-status">
                    {order.status === 'completed'
                      ? 'Выполнен'
                      : order.status === 'in-progress'
                      ? 'В процессе'
                      : order.status === 'canceled'
                      ? 'Отменён'
                      : 'Новый'}
                  </span>
                  <span className="order-date">{order.date}</span>
                </div>
              ))
            )}
          </div>
          {selectedOrderId && (
            <div className="stepper-box">
              {orders
                .filter((order) => order.id === selectedOrderId)
                .map((order) => {
                  const statusStep = getOrderStatusStep(order.status);
                  const isCanceled = order.status === 'canceled';
                  return (
                    <div key={order.id}>
                      <div className={`stepper-step ${isCanceled ? 'stepper-canceled' : statusStep >= 1 ? 'stepper-completed' : 'stepper-pending'}`}>
                        <div className="stepper-circle">
                          {isCanceled ? (
                            <svg viewBox="0 0 16 16" className="bi bi-x-lg" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1 -.708.708L8 8.707l5.146 5.147a.5.5 0 0 1 -.708-.708L7.293 8 2.146 2.854z" />
                            </svg>
                          ) : statusStep >= 1 ? (
                            <svg viewBox="0 0 16 16" className="bi bi-check-lg" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1 -1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path>
                            </svg>
                          ) : (
                            '1'
                          )}
                        </div>
                        <div className="stepper-line"></div>
                        <div className="stepper-content">
                          <div className="stepper-title">Заказ размещен</div>
                          <div className="stepper-status">{isCanceled ? 'Отменён' : statusStep >= 1 ? 'Завершен' : 'Ожидается'}</div>
                          <div className="stepper-time">{isCanceled ? order.placed_at : statusStep >= 1 ? order.placed_at : order.date}</div>
                        </div>
                      </div>
                      <div className={`stepper-step ${isCanceled ? 'stepper-canceled' : statusStep >= 2 ? 'stepper-completed' : 'stepper-pending'}`}>
                        <div className="stepper-circle">
                          {isCanceled ? (
                            <svg viewBox="0 0 16 16" className="bi bi-x-lg" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1 -.708.708L8 8.707l5.146 5.147a.5.5 0 0 1 -.708-.708L7.293 8 2.146 2.854z" />
                            </svg>
                          ) : statusStep >= 2 ? (
                            <svg viewBox="0 0 16 16" className="bi bi-check-lg" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1 -1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path>
                            </svg>
                          ) : (
                            '2'
                          )}
                        </div>
                        <div className="stepper-line"></div>
                        <div className="stepper-content">
                          <div className="stepper-title">В обработке</div>
                          <div className="stepper-status">{isCanceled ? 'Отменён' : statusStep >= 2 ? 'Завершен' : 'Ожидается'}</div>
                          <div className="stepper-time">{isCanceled ? order.placed_at : statusStep >= 2 ? order.processing_at : 'Ожидается'}</div>
                        </div>
                      </div>
                      <div className={`stepper-step ${isCanceled ? 'stepper-canceled' : statusStep >= 3 ? 'stepper-completed' : 'stepper-pending'}`}>
                        <div className="stepper-circle">
                          {isCanceled ? (
                            <svg viewBox="0 0 16 16" className="bi bi-x-lg" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1 -.708.708L8 8.707l5.146 5.147a.5.5 0 0 1 -.708-.708L7.293 8 2.146 2.854z" />
                            </svg>
                          ) : statusStep >= 3 ? (
                            <svg viewBox="0 0 16 16" className="bi bi-check-lg" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1 -1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"></path>
                            </svg>
                          ) : (
                            '3'
                          )}
                        </div>
                        <div className="stepper-content">
                          <div className="stepper-title">Доставлен</div>
                          <div className="stepper-status">{isCanceled ? 'Отменён' : statusStep >= 3 ? 'Завершен' : 'Ожидается'}</div>
                          <div className="stepper-time">{isCanceled ? order.placed_at : statusStep >= 3 ? order.delivered_at : 'Ожидается'}</div>
                        </div>
                      </div>
                      <div className="stepper-buttons">
                        {order.status === 'new' && (
                          <button className="stepper-btn" onClick={() => handleEditOrder(order.id)}>
                            Редактировать
                          </button>
                        )}
                        {order.status === 'completed' && (
                          <button className="stepper-btn" onClick={() => handleOpenOrder(order.id)}>
                            Открыть
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <form className="order-form" onSubmit={formMode !== 'view' ? handleModalSubmit : undefined} onClick={(e) => e.stopPropagation()}>
            <div className="order-form-left">
              <div className="order-flex-column">
                <label>Тема заказа</label>
                <div className="order-inputForm">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                  </svg>
                  <input
                    type="text"
                    className="order-input"
                    placeholder="Введите тему заказа"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    disabled={formMode === 'view'}
                  />
                </div>
              </div>
              <div className="order-flex-column">
                <label>Срок выполнения</label>
                <div className="order-inputForm">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
                  </svg>
                  <input
                    type="datetime-local"
                    className="order-input"
                    value={formData.deadline}
                    min={getCurrentTime()}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    disabled={formMode === 'view'}
                  />
                </div>
              </div>
              <div className="order-flex-column">
                <label>Файлы (до 8)</label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/mpeg,audio/webm,text/css,application/javascript,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/x-msdownload,text/csv,application/zip,application/x-rar-compressed,application/x-7z-compressed,application/x-msdos-program"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="file-upload"
                  disabled={formMode === 'view'}
                />
                {(formMode === 'create' || formMode === 'edit') && (
                  <label htmlFor="file-upload" className="transaction-container">
                    <span className="transaction-new">Добавить файлы</span>
                  </label>
                )}
                <div className="order-file-list">
                  {formData.files && formData.files.length > 0 && formData.files.map((file, index) => (
                    <div className="order-file-item" key={index}>
                      <img
                        src={getFileIcon(file.name || file.originalname || 'unknown')}
                        alt={file.name || file.originalname || 'file'}
                        className="order-file-icon"
                      />
                      <span>{file.name || file.originalname || 'Неизвестный файл'}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        className="order-file-download-btn"
                        onClick={(e) => handleDownload(e, file, file.name || file.originalname || 'file')}
                        title="Скачать"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                      </button>
                      {(formMode === 'create' || formMode === 'edit') && (
                        <button className="order-file-remove-btn" onClick={() => removeFile(index)}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-flex-column">
                <label>Голосовые сообщения (до 3)</label>
                <button
                  type="button"
                  className={`order-voice-record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={formData.voiceMessages.length >= 3 || formMode === 'view'}
                  style={{ display: formMode === 'create' || formMode === 'edit' ? 'block' : 'none' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                    <path
                      d="M12 3C10.3431 3 9 4.34315 9 6V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V6C15 4.34315 13.6569 3 12 3Z"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 12V13C5 16.3137 7.68629 19 11 19H13C16.3137 19 19 16.3137 19 13V12"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {isRecording ? 'Остановить запись' : 'Записать голосовое'}
                </button>
                <div className="order-file-list">
                  {formData.voiceMessages && formData.voiceMessages.length > 0 && formData.voiceMessages.map((voice, index) => (
                    <div className="order-file-item" key={index}>
                      <img
                        src={mp3Icon}
                        alt={`Голосовое сообщение ${index + 1}`}
                        className="order-file-icon"
                      />
                      <span>{voice.name || `Голосовое сообщение ${index + 1}`}</span>
                      <span className="file-size">{formatFileSize(voice.size)}</span>
                      <span className="voice-duration">
                        {formatDuration(voiceStates[index]?.duration || 0)}
                      </span>
                      <div className="voice-progress">
                        <input
                          type="range"
                          min="0"
                          max={isFinite(voiceStates[index]?.duration) ? voiceStates[index]?.duration : 1}
                          value={voiceStates[index]?.currentTime || 0}
                          onChange={(e) => handleVoiceProgressChange(index, e.target.value)}
                          disabled={!isFinite(voiceStates[index]?.duration) || voiceStates[index]?.duration === 0}
                        />
                      </div>
                      <button
                        type="button"
                        className="order-voice-play-btn"
                        onClick={() => toggleVoiceMessage(voice, index)}
                        disabled={!isFinite(voiceStates[index]?.duration) || voiceStates[index]?.duration === 0}
                      >
                        {voiceStates[index]?.isPlaying ? (
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                            <path
                              d="M2 4H6V20H2V4ZM10 4H14V20H10V4Z"
                              fill="#ffffff"
                              stroke="#ffffff"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                            <path
                              d="M4 4V20L20 12L4 4Z"
                              fill="#ffffff"
                              stroke="#ffffff"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                      {(formMode === 'create' || formMode === 'edit') && (
                        <button className="order-voice-remove-btn" onClick={() => removeVoiceMessage(index)}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-form-right">
              <div className="order-flex-column">
                <label>Задачи</label>
                <div className="order-subtask-container">
                  {formData.subtasks.map((subtask, index) => (
                    <div className="order-subtask" key={index}>
                      <input
                        type="text"
                        className="order-subtask-input"
                        placeholder={`Задача ${index + 1}`}
                        value={subtask}
                        onChange={(e) => updateSubtask(index, e.target.value)}
                        disabled={formMode === 'view'}
                      />
                      {(formMode === 'create' || formMode === 'edit') && (
                        <button type="button" className="order-subtask-btn remove" onClick={() => removeSubtask(index)}>
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 12H18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {(formMode === 'create' || formMode === 'edit') && (
                    <button type="button" className="order-subtask-btn add" onClick={addSubtask}>
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 6V18M6 12H18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {formMode === 'view' ? (
                <button type="button" className="transaction-container" onClick={handleReportIssue}>
                  <span className="transaction-new">Пожаловаться</span>
                </button>
              ) : (
                <>
                  <button type="submit" className="transaction-container">
                    <span className="transaction-new">{formMode === 'create' ? 'Оформить заказ' : 'Обновить заказ'}</span>
                  </button>
                  {formMode === 'edit' && (
                    <button
                      type="button"
                      className="transaction-container"
                      onClick={() => deleteOrder(selectedOrderId)}
                    >
                      <span className="transaction-new">Отменить заказ</span>
                    </button>
                  )}
                </>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
          </form>
        </div>
      )}
      {isReferralModalOpen && (
        <div className="modal-overlay" onClick={handleReferralModalClose}>
          <div className="referral-form" onClick={(e) => e.stopPropagation()}>
            <h2>Реферальная программа</h2>
            <p>Приглашайте друзей и получайте скидки на заказы!</p>
            <div className="referral-form-link-container">
              <input type="text" className="referral-form-link-input" value={referralData.referralLink} readOnly />
              <button className="copy-btn" onClick={copyReferralLink}>
                Копировать
              </button>
            </div>
            <div className="battery-container">
              <div className="battery">
                <div className="battery-fill" style={{ width: `${getBatteryProgress()}%` }}></div>
              </div>
              <div className="battery-labels">
                <span>0</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
              </div>
            </div>
            <p className="referral-info referral-count">
              Количество рефералов: <span>{referralData.referralCount}</span>
            </p>
            <p className="referral-info referral-discount">
              Ваша скидка: <span>{referralData.discount}%</span>
            </p>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      )}
      <SupportChat
        isOpen={isSupportChatOpen}
        onClose={() => setIsSupportChatOpen(false)}
        user={user}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
};

export default Marketplace;