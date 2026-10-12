const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const pool = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Роуты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users', require('./routes/users'));
app.use('/api/upload', require('./routes/upload'));

// Хранилище: userId -> Set из socket.id
const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('Подключился:', socket.id);

    // Пользователь вошел — помечаем онлайн
    socket.on('user_online', (userId) => {
        if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
        onlineUsers.get(userId).add(socket.id);
        io.emit('online_users', Array.from(onlineUsers.keys()));
    });

    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
    });

    socket.on('send_message', async (data) => {
    try {
        const result = await pool.query(
            `INSERT INTO messages (chat_id, sender_id, text, media_url, media_type) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
            [data.chatId, data.sender_id, data.text || '', data.media_url || null, data.media_type || null]
        );
        const savedMessage = {
            id: result.rows[0].id,
            chatId: data.chatId,
            text: data.text || '',
            media_url: data.media_url || null,
            media_type: data.media_type || null,
            sender: data.sender,
            created_at: result.rows[0].created_at
        };
        io.to(data.chatId).emit('new_message', savedMessage);
    } catch (err) {
        console.error('Ошибка сохранения:', err);
    }
});

    socket.on('disconnect', () => {
        // Убираем socket.id из онлайна
        for (const [userId, sockets] of onlineUsers.entries()) {
            sockets.delete(socket.id);
            if (sockets.size === 0) onlineUsers.delete(userId);
        }
        io.emit('online_users', Array.from(onlineUsers.keys()));
        console.log('Отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));