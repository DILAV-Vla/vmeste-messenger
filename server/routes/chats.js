const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Получить чаты, где я участник
router.get('/', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.name, c.is_group, c.created_at 
             FROM chats c
             JOIN chat_members cm ON c.id = cm.chat_id
             WHERE cm.user_id = $1
             ORDER BY c.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать групповой чат
router.post('/', auth, async (req, res) => {
    try {
        const { name } = req.body;
        const chat = await pool.query(
            'INSERT INTO chats (name, is_group) VALUES ($1, $2) RETURNING *',
            [name || 'Новый чат', true]
        );
        await pool.query(
            'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)',
            [chat.rows[0].id, req.userId]
        );
        res.json(chat.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создать или получить личный чат с пользователем
router.post('/personal/:userId', auth, async (req, res) => {
    try {
        const otherId = parseInt(req.params.userId);
        const myId = req.userId;

        // Ищем существующий личный чат между двумя людьми
        const existing = await pool.query(
            `SELECT c.* FROM chats c
             JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1
             JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2
             WHERE c.is_group = FALSE
             LIMIT 1`,
            [myId, otherId]
        );

        if (existing.rows.length > 0) {
            return res.json(existing.rows[0]);
        }

        // Получаем ник собеседника
        const other = await pool.query('SELECT username FROM users WHERE id = $1', [otherId]);
        const chatName = other.rows[0]?.username || 'Личный чат';

        // Создаем новый чат
        const chat = await pool.query(
            'INSERT INTO chats (name, is_group) VALUES ($1, $2) RETURNING *',
            [chatName, false]
        );
        await pool.query(
            'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
            [chat.rows[0].id, myId, otherId]
        );
        res.json(chat.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;