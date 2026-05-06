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
        `*Admin buyruqlari:*\n` +
        `/stats — Statistika\n` +
        `/debtors — Qarzdorlar\n\n` +
        `*Ota-onalar uchun:*\n` +
        `Farzandingiz to'liq ismini yozing — natijalar qaytariladi.\n` +
        `Masalan: *Aziz Karimov*`,
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

    // Ota-ona — farzand ismini yozganda natijalarni qaytarish
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();

      // Buyruqlarni o'tkazib yuborish
      if (!text || text.startsWith('/')) return;

      try {
        // Ism bo'yicha o'quvchini qidirish
        const students = await prisma.student.findMany({
          where: {
            fullName: { contains: text, mode: 'insensitive' },
            status: 'ACTIVE',
          },
          include: {
            group: { include: { course: true } },
            achievements: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        });

        if (students.length === 0) {
          bot.sendMessage(chatId,
            `❌ "${text}" ismli o'quvchi topilmadi.\n\nIltimos, to'liq ismni yozing (masalan: *Aziz Karimov*)`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        for (const student of students) {
          const totalPoints = student.totalPoints || 0;

          // Daraja hisoblash
          const levels = [
            { name: 'Beginner', emoji: '🟢', min: 0, max: 50 },
            { name: 'Junior', emoji: '🔵', min: 51, max: 150 },
            { name: 'Middle', emoji: '🟡', min: 151, max: 300 },
            { name: 'Senior', emoji: '🟠', min: 301, max: 500 },
            { name: 'Master', emoji: '🔴', min: 501, max: Infinity },
          ];
          const level = levels.find(l => totalPoints >= l.min && totalPoints <= l.max) || levels[0];

          // Davomat statistikasi
          const attendanceRecords = await prisma.attendance.findMany({
            where: { studentId: student.id },
            take: 30,
            orderBy: { date: 'desc' },
          });
          const totalAtt = attendanceRecords.length;
          const presentAtt = attendanceRecords.filter(a => a.status === 'PRESENT').length;
          const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

          // So'nggi yutuqlar
          let achievementText = '';
          if (student.achievements.length > 0) {
            achievementText = '\n📋 *So\'nggi yutuqlar:*\n';
            student.achievements.forEach(a => {
              const sign = a.points >= 0 ? '+' : '';
              achievementText += `  ${sign}${a.points} ⭐ ${a.title}\n`;
            });
          }

          const message =
            `👤 *${student.fullName}*\n\n` +
            `${level.emoji} Daraja: *${level.name}*\n` +
            `⭐ Umumiy ball: *${totalPoints}*\n` +
            `📚 Kurs: *${student.group?.course?.name || '—'}*\n` +
            `👥 Guruh: *${student.group?.name || '—'}*\n` +
            `📊 Davomat: *${attRate}%* (${presentAtt}/${totalAtt})\n` +
            `📈 O'zlashtirish: *${student.progress}%*\n` +
            achievementText;

          bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
      } catch (err) {
        logger.error('Parent lookup error:', err);
        bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
      }
    });

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
