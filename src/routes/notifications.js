const express = require('express');
const pool    = require('../db/connection');

const router = express.Router();

const formatNotification = (row) => ({
  id:         row.id,
  user_id:    row.user_id,
  title:      row.title,
  message:    row.message,
  type:       row.type,
  is_read:    Boolean(Number(row.is_read)),
  created_at: row.created_at,
  read_at:    row.read_at,
});

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

    page  = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (page - 1) * limit;
    const onlyUnread = unreadOnly === true || unreadOnly === 'true' || unreadOnly === '1';

    const conditions = ['user_id = ?', 'type = ?'];
    const params = [req.user.id, 'issue_status'];

    if (onlyUnread) {
      conditions.push('is_read = 0');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications ${where}`,
      params
    );

    const [unreadRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND type = ? AND is_read = 0',
      [req.user.id, 'issue_status']
    );

    const [rows] = await pool.query(
      `SELECT id, user_id, title, message, type, is_read, created_at, read_at
       FROM notifications
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalItems = countRows[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      notifications: rows.map(formatNotification),
      unreadCount:   unreadRows[0].total,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage:     page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error('[GET /notifications]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({ message: 'Notification ID must be a positive integer.' });
    }

    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, UTC_TIMESTAMP())
       WHERE id = ? AND user_id = ? AND type = ?`,
      [id, req.user.id, 'issue_status']
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Notification with ID ${id} not found.` });
    }

    return res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[PATCH /notifications/:id/read]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, UTC_TIMESTAMP())
       WHERE user_id = ? AND type = ? AND is_read = 0`,
      [req.user.id, 'issue_status']
    );

    return res.status(200).json({
      message: 'Notifications marked as read.',
      updatedCount: result.affectedRows,
    });
  } catch (err) {
    console.error('[PATCH /notifications/read-all]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({ message: 'Notification ID must be a positive integer.' });
    }

    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ? AND type = ?',
      [id, req.user.id, 'issue_status']
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `Notification with ID ${id} not found.` });
    }

    return res.status(200).json({ message: `Notification ${id} deleted successfully.` });
  } catch (err) {
    console.error('[DELETE /notifications/:id]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
