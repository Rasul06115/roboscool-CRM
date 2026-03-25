const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });
  return { accessToken, refreshToken };
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ success: false, error: "Email yoki parol noto'g'ri" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, error: "Email yoki parol noto'g'ri" });

    if (!user.isActive) return res.status(403).json({ success: false, error: 'Akkaunt bloklangan' });

    const { accessToken, refreshToken } = generateTokens(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() },
    });

    logger.info(`Login: ${user.email} (${user.role})`);

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, avatar: user.avatar },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/register (faqat admin)
exports.register = async (req, res, next) => {
  try {
    const { email, password, fullName, phone, role } = req.body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ success: false, error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, fullName, phone, role: role || 'MANAGER' },
      select: { id: true, email: true, fullName: true, role: true },
    });

    logger.info(`Yangi foydalanuvchi: ${user.email} (${user.role})`);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token talab qilinadi' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, error: "Noto'g'ri refresh token" });
    }

    const tokens = generateTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.json({ success: true, data: tokens });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Refresh token yaroqsiz' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, fullName: true, role: true, phone: true, avatar: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// PUT /api/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, error: "Joriy parol noto'g'ri" });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    res.json({ success: true, message: 'Parol yangilandi' });
  } catch (err) { next(err); }
};
