const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// УБРАНО: require('dotenv').config();

const app = express();
// Если хостинг сам назначает порт, он будет в process.env.PORT, иначе 5000
const PORT = process.env.PORT || 5000; 

// ==========================================
// 1. НАСТРОЙКА КОНФИГУРАЦИИ (ХАРДКОД)
// ==========================================

const DB_CONFIG = {
  user: 'postgres',
  host: 'localhost',
  database: 'apt',
  password: 'Q1qqqqqq', // Твой пароль
  port: 5432,
};

const SECRET_KEY = 'your-secret-key'; // Твой секретный ключ для JWT
const BOT_TOKEN = "8327873454:AAEbB6_rS3hiVc2wCWsiL_LUXZMRC-sPJnY"; // Твой токен бота

// ==========================================
// 2. НАСТРОЙКА MIDDLEWARE И СТАТИКИ
// ==========================================

app.use(cors({
  origin: ['http://localhost:3000', 'https://market.apt142.ru', 'http://market.apt142.ru'],
  credentials: true
}));

app.use(express.json());

// Раздача загруженных файлов
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

// Раздача React (папка build)
app.use(express.static(path.join(__dirname, 'build')));

// ==========================================
// 3. НАСТРОЙКА MULTER (ЗАГРУЗКА ФАЙЛОВ)
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Uploads/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Исправление кодировки имени файла
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '-' + originalName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg', 'audio/webm', 'text/css', 'application/javascript',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-msdownload', 'text/csv', 'application/zip',
      'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/x-msdos-program', 'application/octet-stream'
    ];
    // Разрешаем файл, если тип совпал или если мы хотим быть мягче (cb(null, true))
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(null, true);
  },
});

// ==========================================
// 4. ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ
// ==========================================
const pool = new Pool(DB_CONFIG);

const generateOrderNumber = () => Math.floor(100000 + Math.random() * 900000);
const generateCouponCode = () => 'REF' + Math.random().toString(36).slice(-8).toUpperCase();

// Инициализация таблиц
async function initializeTables() {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255),
          name VARCHAR(255) UNIQUE NOT NULL,
          picture VARCHAR(255),
          referral_code VARCHAR(36) UNIQUE,
          referred_by INTEGER REFERENCES users(id),
          telegram_id BIGINT
      );`);

      await client.query(`CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          order_number INTEGER UNIQUE NOT NULL,
          status VARCHAR(50) NOT NULL,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processing_at TIMESTAMP,
          delivered_at TIMESTAMP,
          total DECIMAL(10, 2) NOT NULL,
          coupon_code VARCHAR(50),
          discount DECIMAL(10, 2) DEFAULT 0.00,
          subject VARCHAR(255),
          task TEXT,
          deadline TIMESTAMP,
          payment_status VARCHAR(50) DEFAULT 'pending',
          is_submitted BOOLEAN DEFAULT FALSE,
          original_subject VARCHAR(255),
          original_task TEXT,
          original_deadline TIMESTAMP
      );`);

      await client.query(`CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          price DECIMAL(10, 2) NOT NULL,
          extra VARCHAR(255),
          no_mayo VARCHAR(255)
      );`);

      await client.query(`CREATE TABLE IF NOT EXISTS order_files (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          file_path VARCHAR(255) NOT NULL,
          originalname VARCHAR(255),
          size INTEGER,
          is_voice_message BOOLEAN DEFAULT FALSE,
          is_original BOOLEAN DEFAULT FALSE
      );`);

      await client.query(`CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_percentage DECIMAL(5, 2) NOT NULL,
          active BOOLEAN DEFAULT TRUE,
          user_id INTEGER REFERENCES users(id)
      );`);

      await client.query(`CREATE TABLE IF NOT EXISTS referrals (
          id SERIAL PRIMARY KEY,
          referrer_id INTEGER REFERENCES users(id),
          referred_user_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`);

      await client.query(`CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER REFERENCES users(id),
          recipient_id INTEGER REFERENCES users(id),
          content TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sender_name VARCHAR(255),
          status VARCHAR(20) DEFAULT 'pending',
          isComplaint BOOLEAN DEFAULT FALSE
      );`);
      
      await client.query(`CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL,
          image VARCHAR(255)
      );`);

      const productsCheck = await client.query('SELECT count(*) FROM products');
      if (parseInt(productsCheck.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO products (name, description, price) VALUES
          ('Реферат', 'Качественный реферат на любую тему с уникальным содержанием', 1500),
          ('Курсовая', 'Подробная курсовая работа с глубоким анализом и структурой', 3500),
          ('Диплом', 'Полноценная дипломная работа с исследованиями и выводами', 15000),
          ('Проект', 'Программный проект, например, на Laravel, с документацией', 20000),
          ('Экзамен', 'Помощь в подготовке и сдаче экзаменов онлайн или оффлайн', 5000),
          ('Задание', 'Решение задач любой сложности с пояснениями', 1000),
          ('Помощь', 'Консультации и поддержка по учебным вопросам', 2000);
        `);
      }

      await client.query(`
        INSERT INTO coupons (code, discount_percentage, active)
        VALUES ('ТЕСТ', 30.00, TRUE), ('DISCOUNT10', 10.00, TRUE)
        ON CONFLICT (code) DO NOTHING;
      `);
      await client.query('COMMIT');
      console.log('Таблицы успешно инициализированы');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка инициализации таблиц:', error.message);
  }
}

initializeTables();

// Middleware для JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Доступ запрещён' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Недействительный токен' });
  }
};

// ==========================================
// 5. API ЭНДПОИНТЫ
// ==========================================

app.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.name !== 'seth1nk') return res.status(403).json({ error: 'Требуется доступ администратора' });
    const result = await pool.query('SELECT id, email, name, picture FROM users');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/messages', authenticateToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const recipientId = req.query.recipientId;
    let query = `
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE (m.sender_id = $1 OR m.recipient_id = $1)
    `;
    const params = [senderId];
    if (recipientId) {
      query += ' AND (m.sender_id = $2 OR m.recipient_id = $2)';
      params.push(recipientId);
    }
    query += ' ORDER BY m.timestamp ASC';
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      await client.query(
        'UPDATE messages SET status = $1 WHERE recipient_id = $2 AND sender_id = $3 AND status != $1',
        ['read', senderId, recipientId]
      );
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { recipientId, content, isComplaint } = req.body;
    if (!content || !recipientId) return res.status(400).json({ error: 'Нет данных' });

    const client = await pool.connect();
    try {
      const sender = await client.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
      if (sender.rows.length === 0) return res.status(404).json({ error: 'Отправитель не найден' });
      
      const recipient = await client.query('SELECT id FROM users WHERE id = $1', [recipientId]);
      if (recipient.rows.length === 0) return res.status(404).json({ error: 'Получатель не найден' });

      const result = await client.query(
        'INSERT INTO messages (sender_id, recipient_id, content, timestamp, sender_name, status, isComplaint) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6) RETURNING *',
        [req.user.id, recipientId, content, sender.rows[0].name, 'delivered', isComplaint || false]
      );
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('UPDATE messages SET status = $1 WHERE sender_id = $2 AND content = $3 AND isComplaint = $4', ['error', req.user.id, content, isComplaint || false]);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/download/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'Uploads', filename);

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден' });

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(filePath);
});

app.get('/referrals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await pool.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    
    let referralCode = user.rows[0].referral_code || uuidv4();
    if (!user.rows[0].referral_code) {
      await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [referralCode, userId]);
    }
    const referrals = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1', [userId]);
    const referralCount = parseInt(referrals.rows[0].count, 10);
    let discount = 0;
    if (referralCount >= 30) discount = 15;
    else if (referralCount >= 15) discount = 10;
    else if (referralCount >= 5) discount = 5;

    const coupons = await pool.query('SELECT code, discount_percentage FROM coupons WHERE user_id = $1 AND active = TRUE', [userId]);

    res.json({
      referralLink: `https://market.apt142.ru/register?ref=${referralCode}`,
      referralCount,
      discount,
      coupons: coupons.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/orders', authenticateToken, upload.fields([
  { name: 'files', maxCount: 8 },
  { name: 'voiceMessages', maxCount: 3 },
]), async (req, res) => {
  try {
    if (!req.body.order) return res.status(400).json({ error: 'Нет данных заказа' });

    let orderData;
    try {
      orderData = JSON.parse(req.body.order);
    } catch (error) {
      return res.status(400).json({ error: 'Неверный JSON' });
    }

    const { items, coupon_code, discount, total: totalRaw, subject, task, deadline } = orderData;
    const total = parseFloat(totalRaw);
    const userId = req.user.id;
    
    let orderNumber;
    let attempts = 0;
    while (attempts < 10) {
      orderNumber = generateOrderNumber();
      const existingOrder = await pool.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
      if (existingOrder.rows.length === 0) break;
      attempts++;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (
          user_id, order_number, status, total, coupon_code, discount, placed_at, 
          subject, task, deadline, payment_status, is_submitted,
          original_subject, original_task, original_deadline
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9, $10, $11, $12, $13, $14) 
        RETURNING id`,
        [
          userId, orderNumber, 'new', total, coupon_code || null, discount || 0, 
          subject, task || null, deadline || null, 'pending', false,
          subject, task || null, deadline || null
        ]
      );
      const orderId = orderResult.rows[0].id;

      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price, extra, no_mayo) VALUES ($1, $2, $3, $4, $5, $6)',
          [orderId, item.id, item.quantity, item.price, item.extra || null, item.no_mayo || null]
        );
      }

      if (req.files?.files?.length > 0) {
        for (const file of req.files.files) {
          await client.query(
            'INSERT INTO order_files (order_id, file_path, originalname, size, is_voice_message, is_original) VALUES ($1, $2, $3, $4, $5, $6)',
            [orderId, path.join('Uploads', file.filename), file.originalname, file.size, false, true]
          );
        }
      }

      if (req.files?.voiceMessages?.length > 0) {
        for (const file of req.files.voiceMessages) {
          await client.query(
            'INSERT INTO order_files (order_id, file_path, originalname, size, is_voice_message, is_original) VALUES ($1, $2, $3, $4, $5, $6)',
            [orderId, path.join('Uploads', file.filename), file.originalname, file.size, true, true]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ orderId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: 'Не удалось создать заказ' });
  }
});

app.put('/orders/:id', authenticateToken, upload.fields([
  { name: 'files', maxCount: 8 },
  { name: 'voiceMessages', maxCount: 3 },
]), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    if (!req.body.order) return res.status(400).json({ error: 'Нет данных' });

    let orderData;
    try {
      orderData = JSON.parse(req.body.order);
    } catch (error) {
      return res.status(400).json({ error: 'Неверный JSON' });
    }

    const { items, coupon_code, discount, total: totalRaw, subject, task, deadline, existingFiles, existingVoiceMessages } = orderData;
    const total = parseFloat(totalRaw);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const isAdmin = req.user.name === 'seth1nk';
      let orderCheck;
      if (isAdmin) {
        orderCheck = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
      } else {
        orderCheck = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);
      }

      if (orderCheck.rows.length === 0) return res.status(404).json({ error: `Заказ не найден` });

      await client.query(
        'UPDATE orders SET total = $1, coupon_code = $2, discount = $3, subject = $4, task = $5, deadline = $6, is_submitted = $7 WHERE id = $8',
        [total, coupon_code || null, discount || 0, subject, task || null, deadline || null, true, id]
      );

      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      await client.query('DELETE FROM order_files WHERE order_id = $1', [id]);

      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price, extra, no_mayo) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, item.id, item.quantity, item.price, item.extra || null, item.no_mayo || null]
        );
      }

      if (existingFiles && Array.isArray(existingFiles)) {
        for (const file of existingFiles) {
          if (!file.path) continue;
          await client.query(
            'INSERT INTO order_files (order_id, file_path, originalname, size, is_voice_message, is_original) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, file.path, file.originalname, file.size || 0, false, false]
          );
        }
      }
      if (req.files?.files?.length > 0) {
        for (const file of req.files.files) {
          await client.query(
            'INSERT INTO order_files (order_id, file_path, originalname, size, is_voice_message, is_original) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, path.join('Uploads', file.filename), file.originalname, file.size, false, true]
          );
        }
      }
      if (existingVoiceMessages && Array.isArray(existingVoiceMessages)) {
        for (const voice of existingVoiceMessages) {
          if (!voice.path) continue;
          await client.query(
            'INSERT INTO order_files (order_id, file_path, originalname, size, is_voice_message, is_original) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, voice.path, voice.originalname, voice.size || 0, true, false]
          );
        }
      }
      if (req.files?.voiceMessages?.length > 0) {
        for (const file of req.files.voiceMessages) {
          await client.query(
            'INSERT INTO order_files (order_id, file_path, originalname, size, is_voice_message, is_original) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, path.join('Uploads', file.filename), file.originalname, file.size, true, true]
          );
        }
      }

      const updatedOrder = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
      await client.query('COMMIT');
      res.json(updatedOrder.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderCheck = await client.query(`
        SELECT o.*, u.telegram_id 
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `, [id]);

      if (orderCheck.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
      const order = orderCheck.rows[0];
      
      let updateTimeSql = "";
      if (status === 'in-progress' && !order.processing_at) updateTimeSql = ", processing_at = CURRENT_TIMESTAMP";
      if ((status === 'completed' || status === 'canceled') && !order.delivered_at) updateTimeSql = ", delivered_at = CURRENT_TIMESTAMP";

      await client.query(`UPDATE orders SET status = $1 ${updateTimeSql} WHERE id = $2`, [status, id]);

      // Уведомление в ТГ
      if (order.telegram_id) {
        let msgText = "";
        const num = order.order_number;
        if (status === 'in-progress') msgText = `⚙️ <b>Заказ #${num} взят в работу!</b>`;
        else if (status === 'completed') msgText = `✅ <b>Заказ #${num} выполнен!</b>`;
        else if (status === 'canceled') msgText = `❌ <b>Заказ #${num} отменен.</b>`;

        if (msgText) {
            try {
                await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    chat_id: order.telegram_id,
                    text: msgText,
                    parse_mode: 'HTML'
                });
            } catch (e) {
                console.error('Ошибка ТГ:', e.message);
            }
        }
      }

      const result = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
      await client.query('COMMIT');
      res.json(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.name === 'seth1nk';
    let userId = req.user.id;
    let queryParams = [userId];
    let whereClause = 'WHERE o.user_id = $1';

    if (isAdmin) {
      if (req.query.userId) {
        userId = req.query.userId;
        queryParams = [userId];
      } else {
        whereClause = '';
        queryParams = [];
      }
    }

    const orders = await pool.query(
      `SELECT 
        o.id, o.order_number, o.status, o.date, o.placed_at, o.processing_at, o.delivered_at, 
        o.total, o.coupon_code, o.discount, o.subject, o.task, o.deadline, o.payment_status,
        o.is_submitted, o.original_subject, o.original_task, o.original_deadline,
        COALESCE((SELECT json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) as items,
        COALESCE((SELECT json_agg(json_build_object('id', of.id, 'file_path', of.file_path, 'originalname', of.originalname, 'size', of.size, 'is_voice_message', of.is_voice_message, 'is_original', of.is_original)) FROM order_files of WHERE of.order_id = o.id), '[]'::json) as files
       FROM orders o
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.date DESC`,
       queryParams
    );
    res.json(orders.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const isAdmin = req.user.name === 'seth1nk';
      let orderCheck;
      if (isAdmin) orderCheck = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
      else orderCheck = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);

      if (orderCheck.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });

      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      await client.query('DELETE FROM order_files WHERE order_id = $1', [id]);
      await client.query('DELETE FROM orders WHERE id = $1', [id]);

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/orders/:id/pay', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
      await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', ['completed', id]);
      await client.query('COMMIT');
      res.json({ success: true, orderId: id });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const admin = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    if (admin.rows[0].name !== 'seth1nk') return res.status(403).json({ error: 'Нет прав' });
    const { id } = req.params;
    await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [id]);
    await pool.query('DELETE FROM order_files WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [id]);
    await pool.query('DELETE FROM orders WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM referrals WHERE referrer_id = $1 OR referred_user_id = $1', [id]);
    await pool.query('DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/users/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    const admin = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    if (admin.rows[0].name !== 'seth1nk') return res.status(403).json({ error: 'Нет прав' });
    const { id } = req.params;
    const newPassword = Math.random().toString(36).slice(-8) + '!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    res.json({ newPassword });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    const { access_token, referral_code } = req.body;
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { email, name, picture } = response.data;

    let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      const newReferralCode = uuidv4();
      let referredBy = null;
      if (referral_code) {
        const referrer = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referral_code]);
        if (referrer.rows.length > 0) referredBy = referrer.rows[0].id;
      }
      const result = await pool.query(
        'INSERT INTO users (email, name, picture, referral_code, referred_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [email, name || email, picture, newReferralCode, referredBy]
      );
      if (referredBy) {
         await pool.query('INSERT INTO referrals (referrer_id, referred_user_id) VALUES ($1, $2)', [referredBy, result.rows[0].id]);
      }
      user = result;
    } else {
      await pool.query('UPDATE users SET picture = $1 WHERE email = $2', [picture, email]);
      user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    }

    const token = jwt.sign(
      { id: user.rows[0].id, email, name: user.rows[0].name, picture: user.rows[0].picture, referral_code: user.rows[0].referral_code },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
    res.json({ token, user: user.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { email, password, name, referral_code } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Заполните поля' });
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) return res.status(400).json({ error: 'Email занят' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = uuidv4();
    let referredBy = null;
    
    if (referral_code) {
      const referrer = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referral_code]);
      if (referrer.rows.length > 0) referredBy = referrer.rows[0].id;
    }

    const result = await pool.query(
      'INSERT INTO users (email, password, name, picture, referral_code, referred_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [email, hashedPassword, name, null, newReferralCode, referredBy]
    );

    if (referredBy) {
      await pool.query('INSERT INTO referrals (referrer_id, referred_user_id) VALUES ($1, $2)', [referredBy, result.rows[0].id]);
      const couponCode = generateCouponCode();
      await pool.query('INSERT INTO coupons (code, discount_percentage, active, user_id) VALUES ($1, $2, $3, $4)', [couponCode, 5.00, true, referredBy]);
    }

    const token = jwt.sign(
      { id: result.rows[0].id, email, name: result.rows[0].name, picture: result.rows[0].picture, referral_code: result.rows[0].referral_code },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
    res.json({ token, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Неверные данные' });
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ error: 'Неверные данные' });

    const token = jwt.sign(
      { id: user.id, email, name: user.name, picture: user.picture, referral_code: user.referral_code },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/coupons/apply', async (req, res) => {
  try {
    const { code } = req.body;
    const result = await pool.query('SELECT discount_percentage FROM coupons WHERE code = $1 AND active = TRUE', [code.toUpperCase()]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Купон не найден' });
    res.json({ discount_percentage: result.rows[0].discount_percentage });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// --- ВНУТРЕННИЕ API ДЛЯ БОТА ---
app.get('/api/internal/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT o.*, u.name as user_name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/internal/orders/link-telegram', async (req, res) => {
  try {
    const { orderId, telegramId } = req.body;
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
    const order = orderResult.rows[0];
    await pool.query('UPDATE users SET telegram_id = $1 WHERE id = $2', [telegramId, order.user_id]);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/internal/orders/by-telegram/:tgId', async (req, res) => {
  try {
    const { tgId } = req.params;
    const result = await pool.query(`
      SELECT o.id, o.order_number, o.subject, o.status, o.total, o.payment_status 
      FROM orders o JOIN users u ON o.user_id = u.id WHERE u.telegram_id = $1 ORDER BY o.id DESC LIMIT 10
    `, [tgId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/internal/orders/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_type } = req.body; 
    let payStatus = 'pending';
    if (payment_type === 'full') payStatus = 'completed'; 
    else if (payment_type === 'partial') payStatus = 'partial_paid';   
    else if (payment_type === 'agreement') payStatus = 'agreement_approved'; 
    await pool.query('UPDATE orders SET status = $1, payment_status = $2 WHERE id = $3', ['new', payStatus, id]);
    const resOrder = await pool.query('SELECT order_number FROM orders WHERE id = $1', [id]);
    res.json({ success: true, order_number: resOrder.rows[0]?.order_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/products', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].name !== 'seth1nk') return res.status(403).json({ error: 'Нет прав' });
    const { name, description, price } = req.body;
    const imagePath = req.file ? `Uploads/${req.file.filename}` : null;
    const result = await pool.query(
      'INSERT INTO products (name, description, price, image) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, price, imagePath]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].name !== 'seth1nk') return res.status(403).json({ error: 'Нет прав' });
    const { id } = req.params;
    const { name, description, price } = req.body;
    let query = 'UPDATE products SET name=$1, description=$2, price=$3';
    let params = [name, description, price];
    let paramIndex = 4;
    if (req.file) {
      query += `, image=$${paramIndex} WHERE id=$${paramIndex + 1}`;
      params.push(`Uploads/${req.file.filename}`, id);
    } else {
      query += ` WHERE id=$${paramIndex}`;
      params.push(id);
    }
    const result = await pool.query(query + ' RETURNING *', params);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const userCheck = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].name !== 'seth1nk') return res.status(403).json({ error: 'Нет прав' });
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});