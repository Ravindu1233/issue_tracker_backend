require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const authRoutes     = require('./routes/auth');
const issueRoutes    = require('./routes/issues');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const authMiddleware = require('./middleware/authMiddleware');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/issues', authMiddleware, issueRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ message: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
