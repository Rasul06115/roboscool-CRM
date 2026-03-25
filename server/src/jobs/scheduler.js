const cron = require('node-cron');
const smsService = require('../services/smsService');
const telegramService = require('../services/telegramService');
const prisma = require('../config/prisma');
const logger = require('../config/logger');

const initJobs = () => {
  // Har kuni soat 10:00 da qarzdorlarga eslatma
  cron.schedule('0 10 * * *', async () => {
    logger.info('⏰ Kunlik qarz eslatmalari yuborilmoqda...');
    try {
      const debtors = await prisma.student.findMany({
        where: { balance: { lt: 0 }, status: 'ACTIVE' },
      });

      for (const d of debtors) {
        // Telegram eslatma
        if (d.telegramId) {
          await telegramService.sendDebtReminder(d.parentPhone, d.fullName, Math.abs(d.balance), d.telegramId);
        }
      }

      logger.info(`${debtors.length} ta qarzdorga eslatma yuborildi`);
    } catch (err) {
      logger.error('Qarz eslatmasi xatosi:', err);
    }
  });

  // Har oyning 1-sanasida SMS eslatma
  cron.schedule('0 9 1 * *', async () => {
    logger.info('⏰ Oylik to\'lov eslatmalari yuborilmoqda...');
    try {
      await smsService.sendPaymentReminders();
    } catch (err) {
      logger.error('Oylik eslatma xatosi:', err);
    }
  });

  // Har kuni soat 20:00 da admin ga kunlik hisobot
  cron.schedule('0 20 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayPayments = await prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { paymentDate: { gte: today } },
      });

      const newLeads = await prisma.lead.count({
        where: { createdAt: { gte: today } },
      });

      await telegramService.notifyAdmin(
        `📊 *Kunlik hisobot*\n\n` +
        `💰 Bugun: ${((todayPayments._sum.amount || 0) / 1000).toLocaleString()}k so'm (${todayPayments._count} ta)\n` +
        `📞 Yangi leadlar: ${newLeads}\n` +
        `📅 ${today.toLocaleDateString('uz-UZ')}`
      );
    } catch (err) {
      logger.error('Kunlik hisobot xatosi:', err);
    }
  });

  logger.info('⏰ Cron jobs ishga tushdi');
};

module.exports = { initJobs };
