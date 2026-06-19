const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');

// Obtener biblioteca de prompts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM prompts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener prompts:', err);
    res.status(500).json({ error: 'Error al obtener la galería de prompts.' });
  }
});

module.exports = router;
