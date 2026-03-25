const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method });

  // Prisma xatoliklari
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, error: "Bu ma'lumot allaqachon mavjud (unique constraint)." });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ success: false, error: "Bog'liq ma'lumot topilmadi (foreign key)." });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, error: "Ma'lumot topilmadi." });
  }

  // JWT xatoliklari
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: "Noto'g'ri token." });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: "Token muddati tugagan." });
  }

  // Multer xatoliklari
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: "Fayl hajmi juda katta." });
  }

  // Default
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Serverda xatolik yuz berdi' : err.message,
  });
};

module.exports = errorHandler;
