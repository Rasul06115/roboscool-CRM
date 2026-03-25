require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');
const telegramService = require('./services/telegramService');
const { initJobs } = require('./jobs/scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== SECURITY MIDDLEWARE ====================
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 200, // 200 ta so'rov
  message: { success: false, error: 'Juda ko\'p so\'rov. Biroz kuting.' },
});
app.use('/api', limiter);

// ==================== GENERAL MIDDLEWARE ====================
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== API ROUTES ====================
app.use('/api', routes);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: '🤖 RoboSchool CRM API',
    version: '2.0.0',
    stack: 'Node.js + Express + PostgreSQL + Prisma',
    features: ['JWT Auth', 'Telegram Bot', 'SMS (Eskiz)', 'File Upload', 'Cron Jobs'],
    docs: '/api/docs',
  });
});

// ==================== PRODUCTION STATIC ====================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// ==================== ERROR HANDLING ====================
app.use(errorHandler);

// ==================== START SERVER ====================
const startServer = async () => {
  try {
    // Telegram bot
    telegramService.initBot();

    // Cron jobs
    initJobs();

    app.listen(PORT, () => {
      logger.info(`
  🤖 ═══════════════════════════════════════════════
     RoboSchool CRM Server v2.0
     ───────────────────────────────────────────────
     🌐 Port:      ${PORT}
     📦 Mode:      ${process.env.NODE_ENV || 'development'}
     🗄️  Database:  PostgreSQL (Prisma ORM)
     🔐 Auth:      JWT
     🤖 Telegram:  ${process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE' ? 'Active ✅' : 'Not configured ⚠️'}
     📱 SMS:       ${process.env.SMS_EMAIL && process.env.SMS_EMAIL !== 'your_email@example.com' ? 'Active ✅' : 'Demo mode ⚠️'}
     📁 Uploads:   ${process.env.UPLOAD_DIR || './uploads'}
     ⏰ Cron:      Active ✅
     ───────────────────────────────────────────────
     🚀 API:       http://localhost:${PORT}/api
  ═══════════════════════════════════════════════ 🤖
      `);
    });
  } catch (err) {
    logger.error('Server ishga tushishda xatolik:', err);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal. Server to\'xtatilmoqda...');
  process.exit(0);
});

module.exports = app;
