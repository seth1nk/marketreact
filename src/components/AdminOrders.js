import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import defaultAvatar from '../assets/img/profile.png';
import serviceImage6 from '../assets/img/6.png';
import '../assets/css/AdminOrders.css';
import '../assets/css/Marketplace.css';

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

const AdminOrders = ({ user }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    subtasks: [],
    deadline: '',
    files: [],
    voiceMessages: [],
  });
  const [products, setProducts] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    file: null,
    imagePreview: null
  });
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [voiceStates, setVoiceStates] = useState([]);
  const voiceAudioRefs = useRef([]);

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
    if (!user || user?.name !== 'seth1nk') {
      navigate('/login');
      return;
    }
    fetchUsers();
    fetchProducts();
  }, [user, navigate]);
// --- ЛОГИКА ТОВАРОВ ---
  const fetchProducts = async () => {
    try {
      // Запрашиваем товары с бэкенда
      const res = await axios.get('https://market.apt142.ru/products');
      setProducts(res.data.map(p => ({
        ...p,
        price: parseFloat(p.price),
        // Если картинки нет, ставим заглушку serviceImage6
        image: p.image ? `https://market.apt142.ru/${p.image}` : serviceImage6 
      })));
    } catch (e) {
      console.error('Ошибка загрузки товаров', e);
    }
  };

  const handleCreateProduct = () => {
    setEditingProduct({
      id: null,
      name: '',
      description: '',
      price: '',
      file: null,
      imagePreview: null
    });
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      file: null,
      imagePreview: product.image
    });
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    if(!window.confirm('Вы уверены, что хотите удалить этот товар?')) return;
    try {
       const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
       await axios.delete(`https://market.apt142.ru/products/${id}`, {
         headers: { Authorization: `Bearer ${token}` }
       });
       setNotification({ type: 'success', message: 'Товар успешно удален' });
       fetchProducts(); // Обновляем список
       setTimeout(() => setNotification(null), 3000);
    } catch (e) {
       setNotification({ type: 'error', message: 'Ошибка удаления товара' });
       setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
        const data = new FormData();
        data.append('name', editingProduct.name);
        data.append('description', editingProduct.description);
        data.append('price', editingProduct.price);
        
        // Если выбрали новый файл
        if (editingProduct.file) {
            data.append('image', editingProduct.file);
        }

        if (editingProduct.id) {
            // Редактирование (PUT)
            await axios.put(`https://market.apt142.ru/products/${editingProduct.id}`, data, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
        } else {
            // Создание (POST)
            await axios.post(`https://market.apt142.ru/products`, data, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
        }
        setIsProductModalOpen(false);
        fetchProducts(); // Обновляем список
        setNotification({ type: 'success', message: 'Товар сохранен' });
        setTimeout(() => setNotification(null), 3000);
    } catch (e) {
        console.error(e);
        setNotification({ type: 'error', message: 'Не удалось сохранить товар' });
    }
  };
  useEffect(() => {
    setVoiceStates(
      formData.voiceMessages.map((voice, index) => ({
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
        console.log(`Voice message ${index + 1} is Blob/File, src: ${src}`);
      } else if (voice.path) {
        src = `https://market.apt142.ru/${voice.path}`;
        console.log(`Voice message ${index + 1} is server file, src: ${src}`);
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
              if (voice instanceof Blob || voice instanceof File) {
                const reader = new FileReader();
                reader.onload = async () => {
                  try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuffer = reader.result;
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const duration = audioBuffer.duration;
                    console.log(`FileReader duration for voice message ${index + 1}: ${duration}`);
                    if (isFinite(duration) && duration > 0) {
                      setVoiceStates((prev) =>
                        prev.map((state, i) =>
                          i === index ? { ...state, duration } : state
                        )
                      );
                    } else {
                      setVoiceStates((prev) =>
                        prev.map((state, i) =>
                          i === index ? { ...state, duration: 0 } : state
                        )
                      );
                      setError(`Не удалось загрузить длительность для голосового сообщения ${index + 1}`);
                    }
                    audioContext.close();
                  } catch (err) {
                    console.error(`FileReader error for voice message ${index + 1}:`, err);
                    setError(`Не удалось загрузить длительность для голосового сообщения ${index + 1}: ${err.message}`);
                  }
                };
                reader.onerror = (err) => {
                  console.error(`FileReader failed for voice message ${index + 1}:`, err);
                  setError(`Ошибка чтения файла для голосового сообщения ${index + 1}`);
                };
                reader.readAsArrayBuffer(voice);
              } else {
                setVoiceStates((prev) =>
                  prev.map((state, i) =>
                    i === index ? { ...state, duration: 0 } : state
                  )
                );
                setError(`Не удалось загрузить длительность для голосового сообщения ${index + 1}`);
              }
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

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await axios.get('https://market.apt142.ru/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      setNotification({ type: 'error', message: 'Не удалось загрузить пользователей.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const fetchOrders = async (userId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await axios.get(`https://market.apt142.ru/orders?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(
        response.data.map((order) => ({
          ...order,
          title: order.subject || `Заказ №${order.order_number}`,
          date: new Date(order.date).toLocaleString('ru-RU', {
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
          deadline: order.deadline
            ? new Date(order.deadline).toISOString().slice(0, 16)
            : '',
          files: order.files.map((file, fileIndex) => ({
            ...file,
            size: file.size || 0,
            name: file.is_voice_message ? `Голосовое сообщение ${fileIndex + 1}` : file.originalname,
            is_original: file.is_original,
          })),
          updated_subject: order.subject,
          updated_task: order.task,
          updated_deadline: order.deadline,
          updated_files: order.files.filter((file) => !file.is_original),
          original_files: order.files.filter((file) => file.is_original),
        }))
      );
    } catch (error) {
      setNotification({ type: 'error', message: 'Не удалось загрузить заказы.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setSelectedOrder(null);
    setIsModalOpen(false);
    fetchOrders(user.id);
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(false);
  };

  const handleEditOrder = () => {
    if (!selectedOrder) {
      setNotification({ type: 'error', message: 'Заказ не выбран' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    setFormData({
      subject: selectedOrder.subject || '',
      subtasks: selectedOrder.task ? selectedOrder.task.split(';').filter((t) => t.trim()) : [],
      deadline: selectedOrder.deadline || '',
      files: selectedOrder.files
        .filter((f) => !f.is_voice_message)
        .map((f) => ({
          name: f.originalname,
          path: f.file_path,
          size: f.size,
          is_original: f.is_original,
        })),
      voiceMessages: selectedOrder.files
        .filter((f) => f.is_voice_message)
        .map((f, index) => ({
          name: `Голосовое сообщение ${index + 1}`,
          path: f.file_path,
          size: f.size,
          is_original: f.is_original,
        })),
    });
    setIsModalOpen(true);
  };

  const handlePayOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        setNotification({ type: 'error', message: 'Токен авторизации отсутствует' });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      await axios.post(`https://market.apt142.ru/orders/${orderId}/pay`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotification({ type: 'success', message: `Оплата заказа №${orderId} успешно выполнена` });
      await fetchOrders(selectedUser.id);
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.error || 'Не удалось оплатить заказ' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
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
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }
      const orderData = {
        items: selectedOrder.items,
        coupon_code: selectedOrder.coupon_code || '',
        discount: selectedOrder.discount || 0,
        total: selectedOrder.total || 0,
        subject: formData.subject,
        original_subject: selectedOrder.original_subject || selectedOrder.subject,
        task: formData.subtasks.join(';'),
        original_task: selectedOrder.original_task || selectedOrder.task,
        deadline: formData.deadline,
        original_deadline: selectedOrder.original_deadline || selectedOrder.deadline,
        existingFiles: formData.files
          .filter((file) => file.path && !(file instanceof File))
          .map((file) => ({
            path: file.path,
            originalname: file.name,
            size: file.size || 0,
            is_original: file.is_original,
          })),
        existingVoiceMessages: formData.voiceMessages
          .filter((voice) => voice.path && !(voice instanceof File || voice instanceof Blob))
          .map((voice, index) => ({
            path: voice.path,
            originalname: voice.name || `Голосовое сообщение ${index + 1}`,
            size: voice.size || 0,
            is_original: voice.is_original,
          })),
      };
      const formDataToSend = new FormData();
      formDataToSend.append('order', JSON.stringify(orderData));
      
      // Добавляем новые файлы
      formData.files.forEach((file, index) => {
        if (file instanceof File) {
          formDataToSend.append('files', file, file.name);
          console.log(`Добавлен новый файл в FormData: ${file.name}`);
        }
      });
      
      // Добавляем новые голосовые сообщения
      formData.voiceMessages.forEach((voice, index) => {
        if (voice instanceof Blob || voice instanceof File) {
          const fileName = voice.name || `Голосовое сообщение ${index + 1}.webm`;
          formDataToSend.append('voiceMessages', voice, fileName);
          console.log(`Добавлено новое голосовое сообщение в FormData: ${fileName}`);
        }
      });

      const response = await axios.put(`https://market.apt142.ru/orders/${selectedOrder.id}`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      await updateOrderStatus(selectedOrder.id, 'completed');

      setIsModalOpen(false);
      setError('');
      await fetchOrders(selectedUser.id);
      setSelectedOrder({
        ...selectedOrder,
        subject: formData.subject,
        task: formData.subtasks.join(';'),
        deadline: new Date(formData.deadline).toISOString().slice(0, 16),
        files: response.data.files.map((file, fileIndex) => ({
          ...file,
          size: file.size || 0,
          name: file.is_voice_message ? `Голосовое сообщение ${fileIndex + 1}` : file.originalname,
          is_original: file.is_original,
        })),
        updated_subject: formData.subject,
        updated_task: formData.subtasks.join(';'),
        updated_deadline: formData.deadline,
        updated_files: response.data.files.filter((file) => !file.is_original),
        original_files: response.data.files.filter((file) => file.is_original),
        status: 'completed',
        delivered_at: new Date().toLocaleString('ru-RU', {
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
      setNotification({ type: 'success', message: `Заказ №${selectedOrder.order_number} успешно обновлен и завершен!` });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Не удалось обновить заказ');
      console.error('Ошибка обновления заказа:', error.response?.data || error.message);
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files).map((file) => ({ ...file, is_original: false }));
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
    setFormData({
      ...formData,
      files: formData.files.filter((_, i) => i !== index),
    });
  };

  const removeVoiceMessage = (index) => {
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
    if (audio) {
      audio.currentTime = parseFloat(value);
      setVoiceStates((prev) =>
        prev.map((state, i) =>
          i === index ? { ...state, currentTime: parseFloat(value) } : state
        )
      );
    }
  };

  const startRecording = async () => {
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
          is_original: false,
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

  const getFileIcon = (fileName) => {
    if (!fileName || typeof fileName !== 'string') {
      return pngIcon;
    }
    const extension = fileName.split('.').pop().toLowerCase();
    return fileIcons[extension] || pngIcon;
  };

  const handleDeleteUser = async (userId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      await axios.delete(`https://market.apt142.ru/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(users.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setOrders([]);
        setSelectedOrder(null);
        setIsModalOpen(false);
      }
      setNotification({ type: 'success', message: 'Пользователь успешно удален!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Не удалось удалить пользователя.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      const response = await axios.put(
        `https://market.apt142.ru/users/${userId}/reset-password`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { newPassword } = response.data;
      await navigator.clipboard.writeText(newPassword);
      setNotification({
        type: 'success',
        message: 'Пароль успешно сброшен! Новый пароль скопирован в ваш буфер обмена.',
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Не удалось сбросить пароль.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('google_access_token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await axios.put(
        `https://market.apt142.ru/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedOrder = response.data;
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: updatedOrder.status,
                placed_at: updatedOrder.placed_at
                  ? new Date(updatedOrder.placed_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : order.date,
                processing_at: updatedOrder.processing_at
                  ? new Date(updatedOrder.processing_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null,
                delivered_at: updatedOrder.delivered_at
                  ? new Date(updatedOrder.delivered_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null,
                deadline: updatedOrder.deadline
                  ? new Date(updatedOrder.deadline).toISOString().slice(0, 16)
                  : '',
              }
            : order
        )
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: updatedOrder.status,
          placed_at: updatedOrder.placed_at
            ? new Date(updatedOrder.placed_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })
            : selectedOrder.date,
          processing_at: updatedOrder.processing_at
            ? new Date(updatedOrder.processing_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
          delivered_at: updatedOrder.delivered_at
            ? new Date(updatedOrder.delivered_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
          deadline: updatedOrder.deadline
            ? new Date(updatedOrder.deadline).toISOString().slice(0, 16)
            : '',
        });
      }
      setNotification({
        type: 'success',
        message: `Статус заказа №${updatedOrder.order_number} обновлен на "${newStatus === 'completed' ? 'Выполнен' : newStatus === 'in-progress' ? 'В процессе' : newStatus === 'canceled' ? 'Отменён' : 'Новый'}".`,
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({ type: 'error', message: 'Не удалось обновить статус заказа.' });
      setTimeout(() => setNotification(null), 3000);
    }
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

  const addSubtask = () => {
    setFormData({ ...formData, subtasks: [...formData.subtasks, ''] });
  };

  const removeSubtask = (index) => {
    setFormData({
      ...formData,
      subtasks: formData.subtasks.filter((_, i) => i !== index),
    });
  };

  const updateSubtask = (index, value) => {
    const newSubtasks = [...formData.subtasks];
    newSubtasks[index] = value;
    setFormData({ ...formData, subtasks: newSubtasks });
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
      const filename = encodeURIComponent(file.originalname || fileName || 'file');
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

  return (
    <div className="admin-orders-container">
      <h1 className="admin-title">Админ-панель: Заказы</h1>
      <div className="main-content-container">
        <div className="users-section">
          <h2>Пользователи</h2>
          <div className="users-list">
            {users.map((u) => (
              <div
                key={u.id}
                className={`user-item ${selectedUser && selectedUser.id === u.id ? 'selected' : ''}`}
              >
                <div className="user-item-content" onClick={() => handleUserClick(u)}>
                  <img src={u.picture || defaultAvatar} alt="Avatar" className="user-avatar" />
                  <span className="user-name">{u.name}</span>
                </div>
                <div className="user-actions">
                  <button className="action-btn delete-btn" onClick={() => handleDeleteUser(u.id)} title="Удалить">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                  </button>
                  <button className="action-btn reset-btn" onClick={() => handleResetPassword(u.id)} title="Сбросить пароль">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="users-section" style={{marginLeft: '20px'}}>
            <h2>Товары</h2>
            <button className="transaction-container" onClick={handleCreateProduct} style={{marginBottom: '10px'}}>
                <span className="transaction-new">Добавить товар</span>
            </button>
            <div className="users-list">
                {products.map(p => (
                    <div key={p.id} className="user-item">
                        <div className="user-item-content">
                            <img src={p.image} alt={p.name} className="user-avatar" style={{borderRadius: '5px'}}/>
                            <div style={{display:'flex', flexDirection:'column'}}>
                                <span className="user-name">{p.name}</span>
                                <span style={{fontSize: '12px', color: '#888'}}>{p.price}₽</span>
                            </div>
                        </div>
                        <div className="user-actions">
                            <button className="action-btn" onClick={() => handleEditProduct(p)}>✏️</button>
                            <button className="action-btn delete-btn" onClick={() => handleDeleteProduct(p.id)}>🗑</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="orders-section">
          {selectedUser && (
            <>
              <h2>Заказы пользователя {selectedUser.name}</h2>
              <div className="admin-orders-list-container">
                <div className="admin-orders-list">
                  {orders.length === 0 ? (
                    <p className="empty-orders">Нет заказов</p>
                  ) : (
                    orders.map((order) => (
                      <div
                        key={order.id}
                        className={`order-item order-${order.status || 'new'} ${selectedOrder && selectedOrder.id === order.id ? 'selected' : ''}`}
                        onClick={() => handleOrderClick(order)}
                      >
                        <span className="order-title">Заказ №{order.order_number}</span>
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
              </div>
            </>
          )}
        </div>
        <div className="status-section">
          {selectedOrder && (
            <>
              <h2>Статус заказа №{selectedOrder.order_number}</h2>
              <div className="admin-stepper-box">
                {(() => {
                  const statusStep = getOrderStatusStep(selectedOrder.status);
                  const isCanceled = selectedOrder.status === 'canceled';
                  return (
                    <div>
                      <div className={`admin-stepper-step ${isCanceled ? 'admin-stepper-canceled' : statusStep >= 1 ? 'admin-stepper-completed' : 'admin-stepper-pending'}`}>
                        <div className="admin-stepper-circle">
                          {isCanceled ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" height="16" width="16">
                              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                            </svg>
                          ) : statusStep >= 1 ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" height="16" width="16">
                              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>
                            </svg>
                          ) : (
                            '1'
                          )}
                        </div>
                        <div className="admin-stepper-line"></div>
                        <div className="admin-stepper-content">
                          <div className="admin-stepper-title">Заказ размещен</div>
                          <div className="admin-stepper-status">{isCanceled ? 'Отменён' : statusStep >= 1 ? 'Завершен' : 'Ожидается'}</div>
                          <div className="admin-stepper-time">{isCanceled ? selectedOrder.placed_at : statusStep >= 1 ? selectedOrder.placed_at : selectedOrder.date}</div>
                        </div>
                      </div>
                      <div className={`admin-stepper-step ${isCanceled ? 'admin-stepper-canceled' : statusStep >= 2 ? 'admin-stepper-completed' : 'admin-stepper-pending'}`}>
                        <div className="admin-stepper-circle">
                          {isCanceled ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" height="16" width="16">
                              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                            </svg>
                          ) : statusStep >= 2 ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" height="16" width="16">
                              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>
                            </svg>
                          ) : (
                            '2'
                          )}
                        </div>
                        <div className="admin-stepper-line"></div>
                        <div className="admin-stepper-content">
                          <div className="admin-stepper-title">В обработке</div>
                          <div className="admin-stepper-status">{isCanceled ? 'Отменён' : statusStep >= 2 ? 'Завершен' : 'Ожидается'}</div>
                          <div className="admin-stepper-time">{isCanceled ? selectedOrder.placed_at : statusStep >= 2 ? selectedOrder.processing_at : 'Ожидается'}</div>
                        </div>
                      </div>
                      <div className={`admin-stepper-step ${isCanceled ? 'admin-stepper-canceled' : statusStep >= 3 ? 'admin-stepper-completed' : 'admin-stepper-pending'}`}>
                        <div className="admin-stepper-circle">
                          {isCanceled ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" height="16" width="16">
                              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                            </svg>
                          ) : statusStep >= 3 ? (
                            <svg viewBox="0 0 16 16" fill="currentColor" height="16" width="16">
                              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>
                            </svg>
                          ) : (
                            '3'
                          )}
                        </div>
                        <div className="admin-stepper-content">
                          <div className="admin-stepper-title">Доставлен</div>
                          <div className="admin-stepper-status">{isCanceled ? 'Отменён' : statusStep >= 3 ? 'Завершен' : 'Ожидается'}</div>
                          <div className="admin-stepper-time">{isCanceled ? selectedOrder.placed_at : statusStep >= 3 ? selectedOrder.delivered_at : 'Ожидается'}</div>
                        </div>
                      </div>
                      <div className="status-buttons">
                        {selectedOrder.status === 'new' && selectedOrder.payment_status === 'pending' && (
                          <button onClick={() => handlePayOrder(selectedOrder.id)}>Оплатить</button>
                        )}
                        {selectedOrder.status !== 'completed' && (
                          <button onClick={() => updateOrderStatus(selectedOrder.id, 'in-progress')}>В процессе</button>
                        )}
                        {selectedOrder.status !== 'canceled' && (
                          <button onClick={() => updateOrderStatus(selectedOrder.id, 'canceled')}>Отменить</button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
        <div className="order-details-section">
          {selectedOrder && (
            <>
              <h2>Детали заказа №{selectedOrder.order_number}</h2>
              <button className="transaction-container" onClick={handleEditOrder}>
                <span className="transaction-new">Редактировать заказ</span>
              </button>
            </>
          )}
        </div>
      </div>
        {isProductModalOpen && (
  <div className="modal-overlay" onClick={() => setIsProductModalOpen(false)}>
    <form 
      className="order-form" 
      onClick={(e) => e.stopPropagation()} 
      onSubmit={handleSaveProduct}
      // Добавляем инлайн-стили, чтобы переопределить поведение двух колонок и сделать форму компактной, но красивой
      style={{ display: 'flex', flexDirection: 'column', maxWidth: '500px', width: '90%', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}
    >
      <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', textAlign: 'center' }}>
        {editingProduct.id ? 'Редактировать товар' : 'Новый товар'}
      </h2>

      {/* Используем order-form-left, но растягиваем на 100%, чтобы сохранить стили инпутов */}
      <div className="order-form-left" style={{ width: '100%', padding: 0 }}>
        
        {/* Поле Названия */}
        <div className="order-flex-column">
          <label>Название товара</label>
          <div className="order-inputForm">
            {/* Иконка бирки */}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
            </svg>
            <input 
              type="text" 
              className="order-input" 
              placeholder="Например: Курсовая работа"
              required 
              value={editingProduct.name} 
              onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} 
            />
          </div>
        </div>

        {/* Поле Цены */}
        <div className="order-flex-column">
          <label>Цена (₽)</label>
          <div className="order-inputForm">
            {/* Иконка монеты/рубля */}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.15-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.86 2.13-1.91 0-1.32-1.05-1.74-2.61-2.11-1.96-.46-3.48-1.13-3.48-3.14 0-1.85 1.45-2.99 3.18-3.3V4h2.67v1.9c1.6.3 2.95 1.4 3.08 3.12h-1.94c-.1-1.01-1.02-1.63-2.19-1.63-1.2 0-2 .81-2 1.76 0 1.15.9 1.54 2.5 1.91 1.99.46 3.58 1.18 3.58 3.2 0 1.95-1.53 3.12-3.48 3.43z"/>
            </svg>
            <input 
              type="number" 
              className="order-input" 
              placeholder="0"
              required 
              value={editingProduct.price} 
              onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} 
            />
          </div>
        </div>

        {/* Поле Описания */}
        <div className="order-flex-column">
          <label>Описание</label>
          <div className="order-inputForm" style={{ height: 'auto', alignItems: 'flex-start', padding: '10px' }}>
             {/* Иконка текста */}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ marginTop: '5px' }}>
              <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
            </svg>
            <textarea 
              className="order-input" 
              rows="4"
              placeholder="Краткое описание услуги..."
              required 
              style={{ resize: 'vertical', minHeight: '80px', paddingTop: '5px' }}
              value={editingProduct.description} 
              onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
            />
          </div>
        </div>

        {/* Поле Изображения */}
        <div className="order-flex-column">
          <label>Изображение</label>
          
          <input 
            type="file" 
            id="product-file-upload" 
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={e => {
                if(e.target.files[0]) {
                    setEditingProduct({
                        ...editingProduct, 
                        file: e.target.files[0],
                        imagePreview: URL.createObjectURL(e.target.files[0]) // Предпросмотр локального файла
                    });
                }
            }} 
          />
          
          <label htmlFor="product-file-upload" className="transaction-container" style={{ cursor: 'pointer', marginBottom: '10px' }}>
             <span className="transaction-new">
               {editingProduct.file ? 'Выбрать другое фото' : 'Загрузить фото'}
             </span>
          </label>

          {/* Предпросмотр картинки */}
          {editingProduct.imagePreview && (
            <div style={{ 
                width: '100%', 
                height: '150px', 
                borderRadius: '10px', 
                overflow: 'hidden', 
                border: '2px dashed #ccc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9f9f9'
            }}>
                <img 
                  src={editingProduct.imagePreview} 
                  alt="preview" 
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                />
            </div>
          )}
        </div>
      </div>

      {/* Кнопка Сохранить */}
      <button type="submit" className="transaction-container" style={{ marginTop: '10px' }}>
        <span className="transaction-new">Сохранить товар</span>
      </button>

    </form>
  </div>
)}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <form className="order-form" onSubmit={handleModalSubmit} onClick={(e) => e.stopPropagation()}>
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
                />
                <label htmlFor="file-upload" className="transaction-container">
                  <span className="transaction-new">Добавить файлы</span>
                </label>
                <div className="order-file-list">
                  {formData.files && formData.files.length > 0 && (
                    formData.files.map((file, index) => (
                      <div className="order-file-item" key={index}>
                        <img
                          src={getFileIcon(file.name || file.originalname)}
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
                        <button type="button" className="order-file-remove-btn" onClick={() => removeFile(index)}>
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="order-flex-column">
                <label>Голосовые сообщения (до 3)</label>
                <button
                  type="button"
                  className={`order-voice-record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
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
                  {formData.voiceMessages && formData.voiceMessages.length > 0 && (
                    formData.voiceMessages.map((voice, index) => (
                      <div className="order-file-item" key={index}>
                        <img
                          src={getFileIcon('webm')}
                          alt={`Голосовое сообщение ${index + 1}`}
                          className="order-file-icon"
                        />
                        <span>{voice.name || voice.originalname || `Голосовое сообщение ${index + 1}`}</span>
                        <span className="file-size">{formatFileSize(voice.size)}</span>
                        <span className="voice-duration">
                          {formatDuration(voiceStates[index]?.duration || 0)}
                        </span>
                        <div className="voice-progress">
                          <input
                            type="range"
                            min="0"
                            max={voiceStates[index]?.duration || 1}
                            value={voiceStates[index]?.currentTime || 0}
                            onChange={(e) => handleVoiceProgressChange(index, e.target.value)}
                            disabled={voiceStates[index]?.duration === 0}
                          />
                        </div>
                        <button
                          type="button"
                          className="order-voice-play-btn"
                          onClick={() => toggleVoiceMessage(voice, index)}
                          disabled={voiceStates[index]?.duration === 0}
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
                        <button type="button" className="order-voice-remove-btn" onClick={() => removeVoiceMessage(index)}>
                          ✕
                        </button>
                      </div>
                    ))
                  )}
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
                      />
                      <button type="button" className="order-subtask-btn remove" onClick={() => removeSubtask(index)}>
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 12H18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button type="button" className="order-subtask-btn add" onClick={addSubtask}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 6V18M6 12H18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
              <button type="submit" className="transaction-container">
                <span className="transaction-new">Обновить заказ</span>
              </button>
              {error && <div className="error-message">{error}</div>}
            </div>
          </form>
        </div>
      )}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default AdminOrders;