const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../db/connection');
require('dotenv').config();

const router = express.Router();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validation ──────────────────────────
    const errors = [];

    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.push('Email is required.');
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.push('Please provide a valid email address.');
    }

    if (!password || typeof password !== 'string') {
      errors.push('Password is required.');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters long.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── Check duplicate ──────────────────────
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // ── Hash password ────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Insert user ──────────────────────────
    const [result] = await pool.query(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [normalizedEmail, hashedPassword]
    );

    const newUser = { id: result.insertId, email: normalizedEmail };
    const token   = generateToken(newUser);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: newUser.id, email: newUser.email },
    });
  } catch (err) {
    console.error('[POST /auth/register]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validation ──────────────────────────
    const errors = [];

    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.push('Email is required.');
    }
    if (!password || typeof password !== 'string') {
      errors.push('Password is required.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── Find user ────────────────────────────
    const [rows] = await pool.query(
      'SELECT id, email, password FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      // Generic message to avoid user enumeration
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    // ── Compare password ─────────────────────
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Logged in successfully.',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
