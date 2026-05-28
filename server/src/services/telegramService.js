const TelegramBot = require('node-telegram-bot-api');
const logger = require('../config/logger');
const prisma = require('../config/prisma');

let bot = null;

const initBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    logger.warn('⚠️  Telegram bot token sozlanmagan.');
    return null;
  }

  try {
    bot = new TelegramBot(token, { polling: true });

    const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const isAdmin = (chatId) => String(chatId) === String(ADMIN_CHAT_ID);

    // Foydalanuvchini saqlash
    const saveUser = async (msg) => {
      try {
        await prisma.botUser.upsert({
          where: { chatId: String(msg.chat.id) },
          update: { username: msg.from?.username, firstName: msg.from?.first_name },
          create: {
            chatId: String(msg.chat.id),
            username: msg.from?.username,
            firstName: msg.from?.first_name,
            isAdmin: isAdmin(msg.chat.id),
          },
        });
      } catch (e) { /* ignore */ }
    };

    // Uzun xabarni bo'laklarga ajratib yuborish (Telegram limiti 4096 belgi)
    const sendLongMessage = async (chatId, text) => {
      if (text.length <= 4096) {
        await bot.sendMessage(chatId, text);
      } else {
        for (let i = 0; i < text.length; i += 4096) {
          await bot.sendMessage(chatId, text.substring(i, i + 4096));
          await new Promise(r => setTimeout(r, 100));
        }
      }
    };

    // /start
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await saveUser(msg);

      if (isAdmin(chatId)) {
        const userCount = await prisma.botUser.count().catch(() => 0);
        bot.sendMessage(chatId,
          `🤖 RoboSchool CRM Bot (Admin)\n\n` +
          `👥 Jami bot foydalanuvchilari: ${userCount}\n\n` +
          `Admin buyruqlari:\n` +
          `/stats — Statistika\n` +
          `/debtors — Qarzdorlar\n` +
          `/users — Foydalanuvchilar ro'yxati\n` +
          `/reklama — Ommaviy xabar yuborish\n` +
          `/bekor — Reklamani bekor qilish\n\n` +
          `Ota-onalar uchun:\n` +
          `O'quvchi ismini yozing — natijalar qaytariladi.`
        );
      } else {
        bot.sendMessage(chatId,
          `🤖 RoboSchool CRM Bot\n\n` +
          `Xush kelibsiz! 👋\n\n` +
          `Farzandingiz to'liq ismini yozing — natijalar qaytariladi.\n` +
          `Masalan: Aziz Karimov`
        );
      }
    });

    // Admin: Foydalanuvchilar ro'yxati
    bot.onText(/\/(users?|foydalanuvchilar)/i, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
      try {
        let users = [];
        try {
          users = await prisma.botUser.findMany({ orderBy: { createdAt: 'desc' } });
        } catch (dbErr) {
          logger.error('BotUser table error:', dbErr.message);
          return bot.sendMessage(msg.chat.id, '⚠️ bot_users jadvali topilmadi. Neon SQL da yarating.');
        }

        const total = users.length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = users.filter(u => new Date(u.createdAt) >= today).length;

        if (total === 0) {
          return bot.sendMessage(msg.chat.id, '👥 Hali hech kim /start bosmagan.');
        }

        let list = '';
        users.forEach((u, i) => {
          const date = new Date(u.createdAt).toLocaleDateString('uz-UZ');
          const username = u.username ? `@${u.username}` : '—';
          const name = u.firstName || '—';
          const admin = u.isAdmin ? ' 👑' : '';
          list += `${i + 1}. ${name} (${username})${admin} — ${date}\n`;
        });

        const header = `👥 Bot foydalanuvchilari\n\n📊 Jami: ${total} ta\n🆕 Bugun: ${todayCount} ta\n\n`;
        await sendLongMessage(msg.chat.id, header + list);
      } catch (err) {
        logger.error('Users command error:', err);
        bot.sendMessage(msg.chat.id, '❌ Xatolik: ' + (err.message || '').substring(0, 100));
      }
    });

    // Reklama rejimi
    let waitingForBroadcast = false;

    bot.onText(/\/reklama/, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
      const total = await prisma.botUser.count().catch(() => 0);
      waitingForBroadcast = true;
      bot.sendMessage(msg.chat.id,
        `📢 Ommaviy xabar yuborish\n\n👥 ${total} ta foydalanuvchiga yuboriladi.\n\nXabar matnini yozing (yoki /bekor qiling):`
      );
    });

    bot.onText(/\/bekor/, (msg) => {
      if (isAdmin(msg.chat.id) && waitingForBroadcast) {
        waitingForBroadcast = false;
        bot.sendMessage(msg.chat.id, '❌ Reklama bekor qilindi.');
      }
    });

    // Admin: Statistika
    bot.onText(/\/stats/, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
      try {
        const [students, payments, leads] = await Promise.all([
          prisma.student.count({ where: { status: 'ACTIVE' } }),
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: { paymentDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
          }),
          prisma.lead.count({ where: { status: 'NEW' } }),
        ]);
        const revenue = payments._sum.amount || 0;
        bot.sendMessage(msg.chat.id,
          `📊 RoboSchool Statistika\n\n` +
          `👨‍🎓 Faol o'quvchilar: ${students}\n` +
          `💰 Oylik daromad: ${(revenue / 1000).toLocaleString()}k so'm\n` +
          `📞 Yangi leadlar: ${leads}`
        );
      } catch (err) {
        logger.error('Telegram stats error:', err);
        bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
      }
    });

    // Admin: Qarzdorlar
    bot.onText(/\/debtors/, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
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
        let text = '⚠️ Qarzdorlar ro\'yxati\n\n';
        debtors.forEach((d, i) => {
          text += `${i + 1}. ${d.fullName} — ${d.group?.name || '—'}\n`;
          text += `   📞 ${d.parentPhone} | 💰 ${(Math.abs(d.balance) / 1000).toLocaleString()}k so'm\n\n`;
        });
        bot.sendMessage(msg.chat.id, text);
      } catch (err) {
        logger.error('Telegram debtors error:', err);
      }
    });

    logger.info('✅ Telegram bot ishga tushdi');

    // ==================== XABARLAR HANDLER ====================
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();
      if (!text || text.startsWith('/')) return;

      await saveUser(msg);

      // ===== REKLAMA YUBORISH =====
      if (isAdmin(chatId) && waitingForBroadcast) {
        waitingForBroadcast = false;
        const users = await prisma.botUser.findMany();
        let sent = 0, failed = 0;

        bot.sendMessage(chatId, `📤 Yuborilmoqda... ${users.length} ta foydalanuvchiga`);

        for (const user of users) {
          try {
            await sendLongMessage(user.chatId, text);
            sent++;
          } catch (e) {
            failed++;
            logger.error(`Broadcast fail to ${user.chatId}: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 50));
        }

        bot.sendMessage(chatId,
          `✅ Reklama yuborildi!\n\n📨 Yuborildi: ${sent}\n❌ Xatolik: ${failed}\n👥 Jami: ${users.length}`
        );
        return;
      }

      // ===== OTA-ONA QIDIRISH =====
      try {
        const words = text.split(/\s+/).filter(w => w.length >= 2);
        let students = [];

        if (words.length > 0) {
          try {
            students = await prisma.student.findMany({
              where: { status: 'ACTIVE', AND: words.map(w => ({ fullName: { contains: w, mode: 'insensitive' } })) },
              include: { group: { include: { course: true } } },
            });
          } catch (e) { logger.error('Search AND error:', e.message); }

          if (students.length === 0) {
            try {
              students = await prisma.student.findMany({
                where: { status: 'ACTIVE', OR: words.map(w => ({ fullName: { contains: w, mode: 'insensitive' } })) },
                include: { group: { include: { course: true } } },
              });
            } catch (e) { logger.error('Search OR error:', e.message); }
          }
        }

        if (students.length === 0) {
          return bot.sendMessage(chatId, `❌ "${text}" ismli o'quvchi topilmadi.\n\nIltimos, to'liq ismni yozing (masalan: Aziz Karimov)`);
        }

        const ratingEmoji = { POOR: '🔴', AVERAGE: '🟡', GOOD: '🟢', EXCELLENT: '⭐' };
        const ratingLabel = { POOR: 'Qoniqarsiz', AVERAGE: "O'rta", GOOD: 'Yaxshi', EXCELLENT: "A'lo" };

        for (const student of students) {
          try {
            const totalPoints = student.totalPoints || 0;
            const levels = [
              { name: 'Beginner', emoji: '🟢', min: 0, max: 50 },
              { name: 'Junior', emoji: '🔵', min: 51, max: 150 },
              { name: 'Middle', emoji: '🟡', min: 151, max: 300 },
              { name: 'Senior', emoji: '🟠', min: 301, max: 500 },
              { name: 'Master', emoji: '🔴', min: 501, max: Infinity },
            ];
            const level = levels.find(l => totalPoints >= l.min && totalPoints <= l.max) || levels[0];

            let attRate = 0, presentAtt = 0, totalAtt = 0;
            try {
              const records = await prisma.attendance.findMany({ where: { studentId: student.id }, take: 30, orderBy: { date: 'desc' } });
              totalAtt = records.length;
              presentAtt = records.filter(a => a.status === 'PRESENT').length;
              attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
            } catch (e) { /* ignore */ }

            let achievementText = '';
            try {
              const achievements = await prisma.achievement.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' }, take: 5 });
              if (achievements.length > 0) {
                achievementText = '\n📋 So\'nggi yutuqlar:\n';
                achievements.forEach(a => { achievementText += `  ${a.points >= 0 ? '+' : ''}${a.points} ball - ${a.title || 'Yutuq'}\n`; });
              }
            } catch (e) { /* ignore */ }

            let evalText = '';
            try {
              const evals = await prisma.studentEvaluation.findMany({ where: { studentId: student.id }, orderBy: { period: 'desc' }, take: 1 });
              const ev = evals[0];
              if (ev) {
                evalText = `\n📊 Baholash (${ev.period}):\n` +
                  `  ${ratingEmoji[ev.teamwork] || '🟡'} Jamoaviy ish: ${ratingLabel[ev.teamwork] || "O'rta"}\n` +
                  `  ${ratingEmoji[ev.thinking] || '🟡'} Fikrlash: ${ratingLabel[ev.thinking] || "O'rta"}\n` +
                  `  ${ratingEmoji[ev.behavior] || '🟡'} Xulq: ${ratingLabel[ev.behavior] || "O'rta"}\n` +
                  `  ${ratingEmoji[ev.mastery] || '🟡'} O'zlashtirish: ${ratingLabel[ev.mastery] || "O'rta"}\n` +
                  `  ${ratingEmoji[ev.creativity] || '🟡'} Kreativ fikrlash: ${ratingLabel[ev.creativity] || "O'rta"}\n` +
                  `  ${ratingEmoji[ev.decisionMaking] || '🟡'} Tezkor qaror: ${ratingLabel[ev.decisionMaking] || "O'rta"}\n` +
                  `  ${ratingEmoji[ev.independence] || '🟡'} Mustaqillik: ${ratingLabel[ev.independence] || "O'rta"}\n`;
              }
            } catch (e) { /* ignore */ }

            const message =
              `👤 ${student.fullName}\n\n` +
              `${level.emoji} Daraja: ${level.name}\n` +
              `⭐ Umumiy ball: ${totalPoints}\n` +
              `📚 Kurs: ${student.group?.course?.name || '—'}\n` +
              `👥 Guruh: ${student.group?.name || '—'}\n` +
              `📊 Davomat: ${attRate}% (${presentAtt}/${totalAtt})\n` +
              evalText + achievementText;

            await bot.sendMessage(chatId, message);
          } catch (studentErr) {
            logger.error(`Bot student error for ${student.fullName}:`, studentErr.message);
            try {
              await bot.sendMessage(chatId, `👤 ${student.fullName}\nBall: ${student.totalPoints || 0}\nGuruh: ${student.group?.name || '—'}`);
            } catch (e) { /* ignore */ }
          }
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

const sendMessage = async (chatId, message, options = {}) => {
  if (!bot) return false;
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
    await prisma.notificationLog.create({ data: { type: 'telegram', recipient: String(chatId), message, status: 'sent' } });
    return true;
  } catch (err) {
    logger.error('Telegram send error:', err);
    await prisma.notificationLog.create({ data: { type: 'telegram', recipient: String(chatId), message, status: 'failed' } });
    return false;
  }
};

const notifyAdmin = async (message) => {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId || adminChatId === 'YOUR_CHAT_ID_HERE') return;
  return sendMessage(adminChatId, message);
};

const notifyPayment = async (studentName, amount, method) => {
  await notifyAdmin(`💰 *Yangi to'lov*\n\n👤 ${studentName}\n💵 ${(amount / 1000).toLocaleString()}k so'm\n💳 ${method}`);
};

const notifyNewLead = async (leadName, phone, source, interest) => {
  await notifyAdmin(`📞 *Yangi lead!*\n\n👤 ${leadName}\n📱 ${phone}\n📍 ${source}\n🎯 ${interest || 'Belgilanmagan'}`);
};

const sendDebtReminder = async (parentPhone, studentName, debtAmount, telegramId) => {
  if (telegramId) {
    await sendMessage(telegramId,
      `⚠️ *To'lov eslatmasi*\n\nHurmatli ota-ona, *${studentName}* ning to'lov muddati o'tgan.\n💰 Qarz: *${(debtAmount / 1000).toLocaleString()}k* so'm\n\nIltimos, to'lovni amalga oshiring.`
    );
  }
};

module.exports = { initBot, sendMessage, notifyAdmin, notifyPayment, notifyNewLead, sendDebtReminder }; 