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

    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await saveUser(msg);

      if (isAdmin(chatId)) {
        const userCount = await prisma.botUser.count().catch(() => 0);
        bot.sendMessage(chatId,
          `🤖 *RoboSchool CRM Bot (Admin)*\n\n` +
          `👥 Jami bot foydalanuvchilari: *${userCount}*\n\n` +
          `*Admin buyruqlari:*\n` +
          `/stats — Statistika\n` +
          `/debtors — Qarzdorlar\n` +
          `/users — Foydalanuvchilar ro'yxati\n` +
          `/reklama — Ommaviy xabar yuborish\n` +
          `/bekor — Reklamani bekor qilish\n\n` +
          `*Ota-onalar uchun:*\n` +
          `O'quvchi ismini yozing — natijalar qaytariladi.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId,
          `🤖 *RoboSchool CRM Bot*\n\n` +
          `Xush kelibsiz! 👋\n\n` +
          `*Ota-onalar uchun:*\n` +
          `Farzandingiz to'liq ismini yozing — natijalar qaytariladi.\n` +
          `Masalan: *Aziz Karimov*`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // Admin: Foydalanuvchilar ro'yxati
    bot.onText(/\/(users|foydalanuvchilar)/, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
      try {
        const users = await prisma.botUser.findMany({
          orderBy: { createdAt: 'desc' },
        });
        const total = users.length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = users.filter(u => new Date(u.createdAt) >= today).length;

        let list = '';
        users.forEach((u, i) => {
          const date = new Date(u.createdAt).toLocaleDateString('uz-UZ');
          const username = u.username ? `@${u.username}` : '—';
          const name = u.firstName || '—';
          const admin = u.isAdmin ? ' 👑' : '';
          list += `${i + 1}. ${name} (${username})${admin} — ${date}\n`;
        });

        // Telegram xabar limiti 4096 belgi
        if (list.length > 3500) {
          // Ro'yxat juda uzun — qisqartirib yuborish
          const shortList = list.substring(0, 3500) + '\n...';
          await bot.sendMessage(msg.chat.id,
            `👥 *Bot foydalanuvchilari*\n\n` +
            `📊 Jami: *${total}* ta\n` +
            `🆕 Bugun: *${todayCount}* ta\n\n` +
            `${shortList}`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await bot.sendMessage(msg.chat.id,
            `👥 *Bot foydalanuvchilari*\n\n` +
            `📊 Jami: *${total}* ta\n` +
            `🆕 Bugun: *${todayCount}* ta\n\n` +
            `${list}`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err) {
        logger.error('Users list error:', err);
        bot.sendMessage(msg.chat.id, '❌ Xatolik yuz berdi.');
      }
    });

    // Admin: Reklama/Ommaviy xabar yuborish
    let waitingForBroadcast = false;

    bot.onText(/\/reklama/, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
      const total = await prisma.botUser.count().catch(() => 0);
      waitingForBroadcast = true;
      bot.sendMessage(msg.chat.id,
        `📢 *Ommaviy xabar yuborish*\n\n` +
        `👥 ${total} ta foydalanuvchiga yuboriladi.\n\n` +
        `Xabar matnini yozing (yoki /bekor qiling):`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.onText(/\/bekor/, (msg) => {
      if (isAdmin(msg.chat.id) && waitingForBroadcast) {
        waitingForBroadcast = false;
        bot.sendMessage(msg.chat.id, '❌ Reklama bekor qilindi.');
      }
    });

    bot.onText(/\/stats/, async (msg) => {
      if (!isAdmin(msg.chat.id)) {
        return bot.sendMessage(msg.chat.id, '⛔ Bu buyruq faqat admin uchun.');
      }
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

      // Foydalanuvchini saqlash (har qanday xabar yozganda)
      await saveUser(msg);

      // Admin reklama yuborish rejimi
      if (isAdmin(chatId) && waitingForBroadcast) {
        waitingForBroadcast = false;

        const users = await prisma.botUser.findMany();
        let sent = 0, failed = 0;

        bot.sendMessage(chatId, `📤 *Yuborilmoqda...* ${users.length} ta foydalanuvchiga`, { parse_mode: 'Markdown' });

        for (const user of users) {
          try {
            await bot.sendMessage(user.chatId, text, { parse_mode: 'Markdown' });
            sent++;
          } catch (e) { failed++; }
          // Telegram limit uchun kichik kutish
          await new Promise(r => setTimeout(r, 50));
        }

        bot.sendMessage(chatId,
          `✅ *Reklama yuborildi!*\n\n` +
          `📨 Yuborildi: *${sent}*\n` +
          `❌ Xatolik: *${failed}*\n` +
          `👥 Jami: *${users.length}*`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      try {
        // Ismni so'zlarga ajratib, har biri bo'yicha qidirish
        const words = text.split(/\s+/).filter(w => w.length >= 2);
        
        let students = [];
        
        if (words.length > 0) {
          // 1-urinish: Har bir so'z fullName ichida bo'lishi kerak (AND sharti)
          try {
            students = await prisma.student.findMany({
              where: {
                status: 'ACTIVE',
                AND: words.map(word => ({
                  fullName: { contains: word, mode: 'insensitive' },
                })),
              },
              include: {
                group: { include: { course: true } },
              },
            });
          } catch (e) {
            logger.error('Search AND error:', e.message);
          }

          // 2-urinish: Agar topilmasa, har qanday so'z bo'yicha (OR sharti)
          if (students.length === 0) {
            try {
              students = await prisma.student.findMany({
                where: {
                  status: 'ACTIVE',
                  OR: words.map(word => ({
                    fullName: { contains: word, mode: 'insensitive' },
                  })),
                },
                include: {
                  group: { include: { course: true } },
                },
              });
            } catch (e) {
              logger.error('Search OR error:', e.message);
            }
          }
        }

        if (students.length === 0) {
          bot.sendMessage(chatId,
            `❌ "${text}" ismli o'quvchi topilmadi.\n\nIltimos, to'liq ismni yozing (masalan: *Aziz Karimov*)`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const ratingEmoji = { POOR: '🔴', AVERAGE: '🟡', GOOD: '🟢', EXCELLENT: '⭐' };
        const ratingLabel = { POOR: 'Qoniqarsiz', AVERAGE: "O'rta", GOOD: 'Yaxshi', EXCELLENT: "A'lo" };

        for (const student of students) {
          try {
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
            let attRate = 0, presentAtt = 0, totalAtt = 0;
            try {
              const attendanceRecords = await prisma.attendance.findMany({
                where: { studentId: student.id },
                take: 30,
                orderBy: { date: 'desc' },
              });
              totalAtt = attendanceRecords.length;
              presentAtt = attendanceRecords.filter(a => a.status === 'PRESENT').length;
              attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
            } catch (e) { /* ignore */ }

            // So'nggi yutuqlar (alohida yuklash)
            let achievementText = '';
            try {
              const achievements = await prisma.achievement.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' },
                take: 5,
              });
              if (achievements.length > 0) {
                achievementText = '\n📋 *So\'nggi yutuqlar:*\n';
                achievements.forEach(a => {
                  const sign = a.points >= 0 ? '+' : '';
                  achievementText += `  ${sign}${a.points} ball - ${a.title || 'Yutuq'}\n`;
                });
              }
            } catch (e) { /* ignore */ }

            // So'nggi baholash (alohida yuklash)
            let evalText = '';
            try {
              const evals = await prisma.studentEvaluation.findMany({
                where: { studentId: student.id },
                orderBy: { period: 'desc' },
                take: 1,
              });
              const eval_ = evals[0];
              if (eval_) {
                evalText = `\n📊 *Baholash (${eval_.period}):*\n` +
                  `  ${ratingEmoji[eval_.teamwork] || '🟡'} Jamoaviy ish: ${ratingLabel[eval_.teamwork] || "O'rta"}\n` +
                  `  ${ratingEmoji[eval_.thinking] || '🟡'} Fikrlash: ${ratingLabel[eval_.thinking] || "O'rta"}\n` +
                  `  ${ratingEmoji[eval_.behavior] || '🟡'} Xulq: ${ratingLabel[eval_.behavior] || "O'rta"}\n` +
                  `  ${ratingEmoji[eval_.mastery] || '🟡'} O'zlashtirish: ${ratingLabel[eval_.mastery] || "O'rta"}\n` +
                  `  ${ratingEmoji[eval_.creativity] || '🟡'} Kreativ fikrlash: ${ratingLabel[eval_.creativity] || "O'rta"}\n` +
                  `  ${ratingEmoji[eval_.decisionMaking] || '🟡'} Tezkor qaror: ${ratingLabel[eval_.decisionMaking] || "O'rta"}\n` +
                  `  ${ratingEmoji[eval_.independence] || '🟡'} Mustaqillik: ${ratingLabel[eval_.independence] || "O'rta"}\n`;
              }
            } catch (e) { /* ignore */ }

            const message =
              `👤 *${student.fullName}*\n\n` +
              `${level.emoji} Daraja: *${level.name}*\n` +
              `⭐ Umumiy ball: *${totalPoints}*\n` +
              `📚 Kurs: *${student.group?.course?.name || '—'}*\n` +
              `👥 Guruh: *${student.group?.name || '—'}*\n` +
              `📊 Davomat: *${attRate}%* (${presentAtt}/${totalAtt})\n` +
              evalText +
              achievementText;

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          } catch (studentErr) {
            logger.error(`Bot student error for ${student.fullName}:`, studentErr.message);
            // Markdown xato bo'lsa — oddiy matn yuborish
            try {
              await bot.sendMessage(chatId,
                `👤 ${student.fullName}\n` +
                `Daraja: ${student.totalPoints || 0} ball\n` +
                `Kurs: ${student.group?.course?.name || '—'}\n` +
                `Guruh: ${student.group?.name || '—'}`
              );
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