const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const pool     = require('../db/connection');
const { sendResetOtpEmail } = require('../services/mailer');
require('dotenv').config();

const router = express.Router();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;
const RESET_OTP_EXPIRES_MINUTES = 10;

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const validateResetOtp = async (email, otp) => {
  const [rows] = await pool.query(
    `SELECT id, reset_otp_hash, reset_otp_expires_at
     FROM users
     WHERE email = ?`,
    [email]
  );

  if (rows.length === 0 || !rows[0].reset_otp_hash || !rows[0].reset_otp_expires_at) {
    return null;
  }

  const user = rows[0];
  const expiresAt = new Date(user.reset_otp_expires_at);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return null;
  }

  const isOtpValid = await bcrypt.compare(otp, user.reset_otp_hash);
  return isOtpValid ? user : null;
};

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    // ── Validation ──────────────────────────
    const errors = [];

    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      errors.push('Full name is required.');
    } else if (full_name.trim().length > 255) {
      errors.push('Full name must be 255 characters or less.');
    }

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

    const trimmedFullName = full_name.trim();
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
      'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
      [trimmedFullName, normalizedEmail, hashedPassword]
    );

    const newUser = { id: result.insertId, full_name: trimmedFullName, email: normalizedEmail };
    const token   = generateToken(newUser);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: newUser.id, full_name: newUser.full_name, email: newUser.email },
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
      'SELECT id, full_name, email, password FROM users WHERE email = ?',
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
      user: { id: user.id, full_name: user.full_name, email: user.email },
    });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT id, email FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        message: 'If that email exists, a password reset OTP has been sent.',
      });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 12);

    await pool.query(
      `UPDATE users
       SET reset_otp_hash = ?,
           reset_otp_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
           reset_otp_created_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [otpHash, RESET_OTP_EXPIRES_MINUTES, rows[0].id]
    );

    await sendResetOtpEmail(rows[0].email, otp);

    return res.status(200).json({
      message: 'If that email exists, a password reset OTP has been sent.',
    });
  } catch (err) {
    console.error('[POST /auth/forgot-password]', err);
    return res.status(500).json({ message: 'Unable to send reset OTP.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (!otp || typeof otp !== 'string' || !OTP_REGEX.test(otp.trim())) {
      return res.status(400).json({ message: 'OTP must be a 6 digit code.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await validateResetOtp(normalizedEmail, otp.trim());

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    return res.status(200).json({ message: 'OTP verified successfully.' });
  } catch (err) {
    console.error('[POST /auth/verify-otp]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const errors = [];

    if (!email || typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
      errors.push('Please provide a valid email address.');
    }

    if (!otp || typeof otp !== 'string' || !OTP_REGEX.test(otp.trim())) {
      errors.push('OTP must be a 6 digit code.');
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
    const user = await validateResetOtp(normalizedEmail, otp.trim());

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query(
      `UPDATE users
       SET password = ?,
           reset_otp_hash = NULL,
           reset_otp_expires_at = NULL,
           reset_otp_created_at = NULL
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    return res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('[POST /auth/reset-password]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
