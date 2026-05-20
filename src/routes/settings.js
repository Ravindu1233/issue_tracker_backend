const express = require('express');
const pool    = require('../db/connection');

const router = express.Router();

const SETTING_FIELDS = ['dark_mode', 'show_notifications', 'email_notifications'];

const toBoolean = (value) => Boolean(Number(value));

const formatSettings = (row) => ({
  id:                  row.id,
  user_id:             row.user_id,
  dark_mode:           toBoolean(row.dark_mode),
  show_notifications:  toBoolean(row.show_notifications),
  email_notifications: toBoolean(row.email_notifications),
  created_at:          row.created_at,
  updated_at:          row.updated_at,
});

const ensureSettings = async (userId) => {
  await pool.query('INSERT IGNORE INTO user_settings (user_id) VALUES (?)', [userId]);

  const [rows] = await pool.query(
    `SELECT id, user_id, dark_mode, show_notifications, email_notifications, created_at, updated_at
     FROM user_settings
     WHERE user_id = ?`,
    [userId]
  );

  return rows[0];
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === 1 || value === '1' || value === 'true') return 1;
  if (value === 0 || value === '0' || value === 'false') return 0;
  return null;
};

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await ensureSettings(req.user.id);
    return res.status(200).json({ settings: formatSettings(settings) });
  } catch (err) {
    console.error('[GET /settings]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    await ensureSettings(req.user.id);
    const fields = [];
    const values = [];
    const errors = [];

    SETTING_FIELDS.forEach((field) => {
      if (req.body[field] === undefined) return;

      const parsed = parseBoolean(req.body[field]);
      if (parsed === null) {
        errors.push(`${field} must be true or false.`);
        return;
      }

      fields.push(`${field} = ?`);
      values.push(parsed);
    });

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No settings provided for update.' });
    }

    values.push(req.user.id);
    await pool.query(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`, values);

    const settings = await ensureSettings(req.user.id);

    return res.status(200).json({
      message:  'Settings updated successfully.',
      settings: formatSettings(settings),
    });
  } catch (err) {
    console.error('[PUT /settings]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
