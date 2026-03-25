const TelegramBot = require('node-telegram-bot-api');
const logger = require('../config/logger');
const prisma = require('../config/prisma');

let bot = null;

// Bot ishga tushirish
const initBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    logger.warn('⚠️  Telegram bot token sozlanmagan. .env faylda TELEGRAM_BOT_TOKEN ni kiriting.');
    return null;
  }

  try {
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId,
        `🤖 *RoboSchool CRM Bot*\n\n` +
        `Xush kelibsiz! Sizning chat ID: \`${chatId}\`\n\n` +
        `Buyruqlar:\n` +
        `/start — Boshlash\n` +
        `/stats — Statistika\n` +
        `/debtors — Qarzdorlar\n` +
        `/help — Yordam`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.onText(/\/stats/, async (msg) => {
      try {
        const [students, payments, leads] = await Promise.all([
          prisma.student.count({ where: { status: 'ACTIVE' } }),
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              paymentDate: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
          }),
          prisma.lead.count({ where: { status: 'NEW' } }),
        ]);

        const revenue = payments._sum.amount || 0;
        bot.sendMessage(msg.chat.id,
          `📊 *RoboSchool Statistika*\n\n` +
          `👨‍🎓 Faol o'quvchilar: *${students}*\n` +
          `💰 Oylik daromad: *${(revenue / 1000).toLocaleString()}k* so'm\n` +
          `📞 Yangi leadlar: *${leads}*`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        logger.error('Telegram stats error:', err);
        bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
      }
    });

    bot.onText(/\/debtors/, async (msg) => {
      try {
        const debtors = await prisma.student.findMany({
          where: { balance: { lt: 0 }, status: 'ACTIVE' },
          include: { group: { include: { course: true } } },
          orderBy: { balance: 'asc' },
          take: 10,
        });

        if (debtors.length === 0) {
          return bot.sendMessage(msg.chat.id, '🎉 Qarzdor yo\'q!');
        }

        let text = `⚠️ *Qarzdorlar ro'yxati*\n\n`;
        debtors.forEach((d, i) => {
          text += `${i + 1}. *${d.fullName}* — ${d.group?.name || '—'}\n`;
          text += `   📞 ${d.parentPhone} | 💰 ${(Math.abs(d.balance) / 1000).toLocaleString()}k so'm\n\n`;
        });

        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error('Telegram debtors error:', err);
      }
    });

    logger.info('✅ Telegram bot ishga tushdi');
    return bot;
  } catch (err) {
    logger.error('❌ Telegram bot xatosi:', err);
    return null;
  }
};

// Xabar yuborish
const sendMessage = async (chatId, message, options = {}) => {
  if (!bot) return false;
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
    await prisma.notificationLog.create({
      data: { type: 'telegram', recipient: String(chatId), message, status: 'sent' },
    });
    return true;
  } catch (err) {
    logger.error('Telegram send error:', err);
    await prisma.notificationLog.create({
      data: { type: 'telegram', recipient: String(chatId), message, status: 'failed' },
    });
    return false;
  }
};

// Admin ga xabar
const notifyAdmin = async (message) => {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId || adminChatId === 'YOUR_CHAT_ID_HERE') return;
  return sendMessage(adminChatId, message);
};

// To'lov haqida bildirishnoma
const notifyPayment = async (studentName, amount, method) => {
  await notifyAdmin(
    `💰 *Yangi to'lov*\n\n` +
    `👤 ${studentName}\n` +
    `💵 ${(amount / 1000).toLocaleString()}k so'm\n` +
    `💳 ${method}`
  );
};

// Yangi lead haqida bildirishnoma
const notifyNewLead = async (leadName, phone, source, interest) => {
  await notifyAdmin(
    `📞 *Yangi lead!*\n\n` +
    `👤 ${leadName}\n` +
    `📱 ${phone}\n` +
    `📍 ${source}\n` +
    `🎯 ${interest || 'Belgilanmagan'}`
  );
};

// Qarzdorlik eslatmasi
const sendDebtReminder = async (parentPhone, studentName, debtAmount, telegramId) => {
  if (telegramId) {
    await sendMessage(telegramId,
      `⚠️ *To'lov eslatmasi*\n\n` +
      `Hurmatli ota-ona, *${studentName}* ning to'lov muddati o'tgan.\n` +
      `💰 Qarz: *${(debtAmount / 1000).toLocaleString()}k* so'm\n\n` +
      `Iltimos, to'lovni amalga oshiring.`
    );
  }
};

module.exports = {
  initBot,
  sendMessage,
  notifyAdmin,
  notifyPayment,
  notifyNewLead,
  sendDebtReminder,
};
