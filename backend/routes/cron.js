const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendServiceErinnerungen } = require('../services/mailer');

router.post('/service-reminder', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await sendServiceErinnerungen(db);
    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
