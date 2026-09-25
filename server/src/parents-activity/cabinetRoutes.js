'use strict';

/**
 * Telegram Mini App (shaxsiy kabinet) API.
 * app.js da: app.use('/api/cabinet', parentsActivity.cabinetRouter)  — '/api' dan OLDIN.
 *
 * Kirish: CRM login EMAS. Har so'rovda Telegram yuborgan `initData`
 * header orqali keladi va bot tokeni bilan imzosi tekshiriladi.
 *
 *   GET /api/cabinet/me              — foydalanuvchi va farzandlari ro'yxati
 *   GET /api/cabinet/student/:id     — o'quvchi kabineti (faqat o'z farzandi / admin)
 *   GET /api/cabinet/search?q=       — o'quvchi qidirish (faqat admin)
 */

const crypto = require('crypto');
const router = require('express').Router();
const logger = require('../config/logger');
const config = require('./config');
const cabinet = require('./services/cabinet');

const MAX_AGE_SEC = 24 * 60 * 60; // initData 24 soat amal qiladi

/**
 * Telegram WebApp initData imzosini tekshirish.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @returns {{ id: string, firstName: string } | null}
 */
function verifyInitData(initData, botToken, now = Date.now()) {
  if (!initData || !botToken) return null;
  let params;
  try {
    params = new URLSearchParams(initData);
  } catch (_) {
    return null;
  }
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > MAX_AGE_SEC) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null');
    if (!user || !user.id) return null;
    return { id: String(user.id), firstName: user.first_name || '' };
  } catch (_) {
    return null;
  }
}

function telegramAuth(req, res, next) {
  const initData = req.get('X-Telegram-Init-Data') || '';
  const user = verifyInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Kabinet faqat Telegram bot orqali ochiladi. Botni qaytadan oching.",
      code: 'TG_AUTH',
    });
  }
  req.tgUser = user;
  req.tgIsAdmin = String(user.id) === String(config.adminChatId);
  next();
}

router.use(telegramAuth);

router.get('/me', async (req, res, next) => {
  try {
    const children = await cabinet.getChildren(req.tgUser.id);
    res.json({
      success: true,
      data: { user: req.tgUser, isAdmin: req.tgIsAdmin, children },
    });
  } catch (err) { next(err); }
});

router.get('/search', async (req, res, next) => {
  try {
    if (!req.tgIsAdmin) return res.status(403).json({ success: false, error: 'Faqat admin uchun' });
    const data = await cabinet.searchStudents(req.query.q);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/student/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!req.tgIsAdmin && !(await cabinet.canView(req.tgUser.id, id))) {
      return res.status(403).json({ success: false, error: "Bu o'quvchi ma'lumotlari sizga ochiq emas" });
    }
    const data = await cabinet.getProfile(id);
    if (!data) return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[cabinet] profil xatosi', { error: err.message });
    next(err);
  }
});

module.exports = router;
module.exports.verifyInitData = verifyInitData;
