const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Поиск пользователей по нику или email
router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        const result = await pool.query(
            `SELECT id, username, email, avatar_url FROM users 
             WHERE (username ILIKE $1 OR email ILIKE $1) 
             AND id != $2
             LIMIT 10`,
            [`%${q}%`, req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;