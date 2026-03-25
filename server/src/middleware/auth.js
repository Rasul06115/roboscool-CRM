const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// Token tekshirish middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token topilmadi. Iltimos tizimga kiring.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Foydalanuvchi topilmadi yoki bloklangan.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token muddati tugagan. Qaytadan kiring.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, error: 'Noto\'g\'ri token.' });
  }
};

// Role tekshirish middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autentifikatsiya talab qilinadi.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Sizda bu amal uchun ruxsat yo\'q.' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
