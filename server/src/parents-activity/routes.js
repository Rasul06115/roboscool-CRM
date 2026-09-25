'use strict';

/**
 * CRM frontend uchun chegirma API.
 * app.js da: app.use('/api/rewards', parentsActivity.rewardsRouter)
 *
 *   GET   /api/rewards/discounts?validMonth=YYYY-MM   — chegirma olganlar ro'yxati
 *   PATCH /api/rewards/discounts/:id                  — { applied: true|false }
 *   POST  /api/rewards/run                            — { period?: "YYYY-MM" } (faqat ADMIN)
 */

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../config/logger');
const top = require('./services/topReward');
const { currentPeriod, isValidPeriod } = require('./utils/time');

router.use(authenticate);

router.get('/discounts', async (req, res, next) => {
  try {
    const q = String(req.query.validMonth || '');
    const validMonth = isValidPeriod(q) ? q : currentPeriod();
    const data = await top.listDiscounts(validMonth);
    res.json({ success: true, data, validMonth });
  } catch (err) {
    // Jadval hali yaratilmagan bo'lsa ham Dashboard buzilmasin
    if (String(err.message).includes('monthly_discounts')) {
      logger.warn('[top5] monthly_discounts jadvali topilmadi — SQL ni ishga tushiring');
      return res.json({ success: true, data: [], validMonth: currentPeriod(), tableMissing: true });
    }
    next(err);
  }
});

router.patch('/discounts/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const ok = await top.setApplied(req.params.id, req.body?.applied !== false);
    if (!ok) return res.status(404).json({ success: false, error: 'Yozuv topilmadi' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/run', authorize('ADMIN'), async (req, res, next) => {
  try {
    const period = req.body?.period;
    if (period && !isValidPeriod(period)) {
      return res.status(400).json({ success: false, error: "Oy formati noto'g'ri (YYYY-MM)" });
    }
    const result = await top.runMonthlyTop(period);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
