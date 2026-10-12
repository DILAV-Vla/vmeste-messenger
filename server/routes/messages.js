const express = require('express');
const pool = require('../db');
const router = express.Router();

// Получить все сообщения для конкретного чата
router.get('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const result = await pool.query(
    `SELECT m.id, m.text, m.media_url, m.media_type, m.created_at, u.username AS sender 
     FROM messages m 
     JOIN users u ON m.sender_id = u.id 
     WHERE m.chat_id = $1 
     ORDER BY m.created_at ASC`,
    [chatId]
);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;