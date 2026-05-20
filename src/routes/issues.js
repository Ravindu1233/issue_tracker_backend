const express = require('express');
const pool    = require('../db/connection');
const { sendIssueStatusEmail } = require('../services/mailer');

const router = express.Router();

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const VALID_STATUSES   = ['Open', 'In Progress', 'Resolved', 'Closed'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];
const VALID_SORT_COLS  = ['created_at', 'updated_at', 'title', 'status', 'priority'];
const NOTIFIABLE_STATUSES = ['In Progress', 'Resolved', 'Closed'];

const notifyIssueCreatorOnStatusChange = async (issue, status, updaterId) => {
  if (!status || issue.status === status || Number(issue.user_id) === Number(updaterId)) {
    return;
  }

  if (!NOTIFIABLE_STATUSES.includes(status)) {
    return;
  }

  const [rows] = await pool.query(
    `SELECT
       u.id, u.full_name, u.email,
       COALESCE(us.show_notifications, 0) AS show_notifications,
       COALESCE(us.email_notifications, 0) AS email_notifications
     FROM users u
     LEFT JOIN user_settings us ON us.user_id = u.id
     WHERE u.id = ?`,
    [issue.user_id]
  );

  if (rows.length === 0) {
    return;
  }

  const creator = rows[0];
  const [updaterRows] = await pool.query(
    'SELECT full_name, email FROM users WHERE id = ?',
    [updaterId]
  );
  const updatedBy = updaterRows[0] || {};
  const updaterName = updatedBy.full_name || updatedBy.email || 'Another user';
  const title = `${updaterName} updated an issue`;
  const message = `${updaterName} changed "${issue.title}" from ${issue.status} to ${status}.`;

  if (Number(creator.show_notifications) === 1) {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [issue.user_id, title, message, 'issue_status']
    );
  }

  if (Number(creator.email_notifications) === 1) {
    try {
      await sendIssueStatusEmail(
        creator.email,
        {
          title: issue.title,
          previous_status: issue.status,
          status,
        },
        updatedBy
      );
    } catch (err) {
      console.error('[Issue status email failed]', err.message);
    }
  }
};

// ─────────────────────────────────────────────
// GET /api/issues/stats  ← must come BEFORE /:id
// Returns issue counts grouped by status.
// ─────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    // Always return all four statuses, even if count is 0
    const [rows] = await pool.query(`
      SELECT
        s.status,
        COALESCE(c.total, 0) AS total
      FROM (
        SELECT 'Open'        AS status UNION ALL
        SELECT 'In Progress'            UNION ALL
        SELECT 'Resolved'               UNION ALL
        SELECT 'Closed'
      ) s
      LEFT JOIN (
        SELECT status, COUNT(*) AS total
        FROM   issues
        GROUP  BY status
      ) c ON s.status = c.status
      ORDER BY FIELD(s.status, 'Open', 'In Progress', 'Resolved', 'Closed')
    `);

    const [totalRow] = await pool.query('SELECT COUNT(*) AS total FROM issues');

    return res.status(200).json({
      stats:       rows,
      totalIssues: totalRow[0].total,
    });
  } catch (err) {
    console.error('[GET /issues/stats]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/issues
// Supports: search (title), filter (status, priority), pagination (page, limit), sort
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let {
      search   = '',
      status,
      priority,
      page     = 1,
      limit    = 10,
      sortBy   = 'created_at',
      order    = 'DESC',
    } = req.query;

    // ── Sanitize pagination ──────────────────
    page  = Math.max(1, parseInt(page,  10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (page - 1) * limit;

    // ── Sanitize sort ────────────────────────
    if (!VALID_SORT_COLS.includes(sortBy)) sortBy = 'created_at';
    order = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // ── Build WHERE clause ───────────────────
    const conditions = [];
    const params     = [];

    if (search.trim()) {
      conditions.push('i.title LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` });
      }
      conditions.push('i.status = ?');
      params.push(status);
    }

    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.` });
      }
      conditions.push('i.priority = ?');
      params.push(priority);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Count total matching rows ────────────
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM issues i ${where}`,
      params
    );
    const totalItems = countRows[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // ── Fetch paginated results ──────────────
    const [issues] = await pool.query(
      `SELECT
         i.id, i.title, i.description, i.status, i.priority,
         i.user_id, i.created_at, i.updated_at,
         u.full_name AS created_by
       FROM issues i
       JOIN users u ON u.id = i.user_id
       ${where}
       ORDER BY i.${sortBy} ${order}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      issues,
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
    console.error('[GET /issues]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/issues/:id
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({ message: 'Issue ID must be a positive integer.' });
    }

    const [rows] = await pool.query(
      `SELECT
         i.id, i.title, i.description, i.status, i.priority,
         i.user_id, i.created_at, i.updated_at,
         u.full_name AS created_by
       FROM issues i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: `Issue with ID ${id} not found.` });
    }

    return res.status(200).json({ issue: rows[0] });
  } catch (err) {
    console.error('[GET /issues/:id]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/issues
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, description = '', status = 'Open', priority = 'Medium' } = req.body;
    const userId = req.user.id;

    // ── Validation ──────────────────────────
    const errors = [];

    if (!title || typeof title !== 'string' || !title.trim()) {
      errors.push('Title is required.');
    } else if (title.trim().length > 255) {
      errors.push('Title must be 255 characters or fewer.');
    }

    if (!VALID_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    const [result] = await pool.query(
      `INSERT INTO issues (title, description, status, priority, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title.trim(), description.trim(), status, priority, userId]
    );

    const [newIssue] = await pool.query(
      `SELECT i.id, i.title, i.description, i.status, i.priority,
              i.user_id, i.created_at, i.updated_at, u.full_name AS created_by
       FROM issues i JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      message: 'Issue created successfully.',
      issue:   newIssue[0],
    });
  } catch (err) {
    console.error('[POST /issues]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/issues/:id
// ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({ message: 'Issue ID must be a positive integer.' });
    }

    // ── Check issue exists ───────────────────
    const [existing] = await pool.query('SELECT id, title, status, user_id FROM issues WHERE id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ message: `Issue with ID ${id} not found.` });
    }

    const { title, description, status, priority } = req.body;

    // ── Validation ──────────────────────────
    const errors = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        errors.push('Title cannot be empty.');
      } else if (title.trim().length > 255) {
        errors.push('Title must be 255 characters or fewer.');
      }
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    // ── Build dynamic SET clause ─────────────
    const fields = [];
    const values = [];

    if (title       !== undefined) { fields.push('title = ?');       values.push(title.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description.trim()); }
    if (status      !== undefined) { fields.push('status = ?');      values.push(status); }
    if (priority    !== undefined) { fields.push('priority = ?');    values.push(priority); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields provided for update.' });
    }

    values.push(id);

    await pool.query(`UPDATE issues SET ${fields.join(', ')} WHERE id = ?`, values);
    await notifyIssueCreatorOnStatusChange(existing[0], status, req.user.id);

    const [updated] = await pool.query(
      `SELECT i.id, i.title, i.description, i.status, i.priority,
              i.user_id, i.created_at, i.updated_at, u.full_name AS created_by
       FROM issues i JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
      [id]
    );

    return res.status(200).json({
      message: 'Issue updated successfully.',
      issue:   updated[0],
    });
  } catch (err) {
    console.error('[PUT /issues/:id]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/issues/:id
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({ message: 'Issue ID must be a positive integer.' });
    }

    const [existing] = await pool.query('SELECT id FROM issues WHERE id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ message: `Issue with ID ${id} not found.` });
    }

    await pool.query('DELETE FROM issues WHERE id = ?', [id]);

    return res.status(200).json({ message: `Issue ${id} deleted successfully.` });
  } catch (err) {
    console.error('[DELETE /issues/:id]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
