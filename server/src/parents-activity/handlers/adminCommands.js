'use strict';

const state = require('../state');
const config = require('../config');
const scheduler = require('../jobs/scheduler');
const link = require('../services/link');
const { currentWeekStart, previousWeekStart, formatWeek } = require('../utils/time');

function isAdmin(msg) {
  return msg?.from && String(msg.from.id) === String(config.adminChatId);
}

async function reply(chatId, text) {
  const { bot, logger } = state;
  try {
    await bot.sendMessage(String(chatId), text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (err) {
    logger.error('[parents] reply xato', { error: err.message });
  }
}

function register() {
  const { bot, prisma, logger } = state;

  // /parents_help
  bot.onText(/^\/parents_help(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    await reply(
      msg.chat.id,
      `📋 <b>Ota-onalar aktivlik moduli</b>\n\n` +
        `<b>Hisobotlar:</b>\n` +
        `/parents_status — modul holati\n` +
        `/parents_weekly_report — o'tgan hafta hisoboti\n` +
        `/parents_links — bog'langan ota-onalar\n\n` +
        `<b>Qo'lda ishga tushirish:</b>\n` +
        `/parents_run_rewards — mukofotlash\n` +
        `/parents_run_reminders — nofaollarga eslatma\n` +
        `/parents_run_subs — obuna tekshiruvi\n\n` +
        `<b>Bog'lash:</b>\n` +
        `<code>/parents_link 123456789 Aziz Karimov</code>\n` +
        `<code>/parents_unlink 123456789</code>\n\n` +
        `<b>Guruh:</b>\n` +
        `/parents_groups — guruhlar ro'yxati\n` +
        `/parents_chatid — chat ID (istalgan chatda)`
    );
  });

  // /parents_status
  bot.onText(/^\/parents_status(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const weekStart = currentWeekStart();
    const [activityCount, notifCount, linksCount, subsCount] = await Promise.all([
      prisma.parentGroupActivity.count({ where: { weekStart } }),
      prisma.parentBotNotification.count({ where: { sentAt: { gte: weekStart } } }),
      prisma.parentLink.count(),
      prisma.parentSubscriptionCheck.count(),
    ]);

    await reply(
      msg.chat.id,
      `📊 <b>Ota-onalar aktivlik moduli</b>\n\n` +
        `📅 Joriy hafta: <code>${formatWeek(weekStart)}</code>\n` +
        `👥 Aktivlik yozuvlari: <b>${activityCount}</b>\n` +
        `🔗 Bog'langan ota-onalar: <b>${linksCount}</b>\n` +
        `✉️ Bu hafta yuborilgan: <b>${notifCount}</b>\n` +
        `🔔 Obuna tekshirilgan: <b>${subsCount}</b>\n\n` +
        `Weekly: <code>${config.weeklyCron}</code> (UTC)\n` +
        `Subs: <code>${config.dailySubscriptionCron}</code> (UTC)`
    );
  });

  // /parents_weekly_report
  bot.onText(/^\/parents_weekly_report(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const weekStart = previousWeekStart();
    const activities = await prisma.parentGroupActivity.findMany({
      where: { weekStart },
      orderBy: { messageCount: 'desc' },
      take: 25,
    });

    if (activities.length === 0) {
      await reply(msg.chat.id, `📉 O'tgan hafta uchun ma'lumot topilmadi.`);
      return;
    }

    const lines = activities.map(
      (a, i) =>
        `${i + 1}. <code>${a.telegramId}</code> — ${a.messageCount} ta${a.rewarded ? ' ✅' : ''}`
    );
    await reply(
      msg.chat.id,
      `📈 <b>O'tgan hafta hisoboti</b> (${formatWeek(weekStart)})\n\n${lines.join('\n')}`
    );
  });

  // /parents_links
  bot.onText(/^\/parents_links(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const links = await link.listLinks(50);
    if (links.length === 0) {
      await reply(
        msg.chat.id,
        `🔗 Hali bog'lanish yo'q.\n\nOta-onalar botga farzandi ismini yozsa avtomatik bog'lanadi, ` +
          `yoki qo'lda: <code>/parents_link ID Ism Familiya</code>`
      );
      return;
    }
    const lines = links.map(
      (l, i) =>
        `${i + 1}. <code>${l.telegramId}</code> → ${l.studentName} <i>(${l.linkedVia})</i>`
    );
    await reply(msg.chat.id, `🔗 <b>Bog'langanlar</b> (${links.length})\n\n${lines.join('\n')}`);
  });

  // /parents_link <telegramId> <fullName>
  bot.onText(/^\/parents_link(?:@\w+)?\s+(\d{5,})\s+(.+)$/, async (msg, match) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const telegramId = match[1].trim();
    const name = match[2].trim();

    const res = await link.manualLink(telegramId, name);
    if (res.ok) {
      await reply(
        msg.chat.id,
        `✅ Bog'landi:\n<code>${telegramId}</code> → <b>${res.student.fullName}</b>`
      );
    } else if (res.reason === 'not_found') {
      await reply(msg.chat.id, `❌ "${name}" ismli faol o'quvchi topilmadi.`);
    } else if (res.reason === 'ambiguous') {
      const names = res.students.map((s) => `• ${s.fullName}`).join('\n');
      await reply(
        msg.chat.id,
        `⚠️ Bir nechta o'quvchi topildi, aniqroq yozing:\n\n${names}`
      );
    }
  });

  // /parents_link (argumentsiz — yordam)
  bot.onText(/^\/parents_link(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    await reply(
      msg.chat.id,
      `ℹ️ Foydalanish:\n<code>/parents_link 123456789 Aziz Karimov</code>\n\n` +
        `Telegram ID ni <code>/parents_status</code> yoki guruhdagi xabardan olishingiz mumkin.`
    );
  });

  // /parents_unlink <telegramId>
  bot.onText(/^\/parents_unlink(?:@\w+)?\s+(\d{5,})$/, async (msg, match) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const count = await link.unlinkAll(match[1].trim());
    await reply(msg.chat.id, `🗑 ${count} ta bog'lanish o'chirildi (<code>${match[1]}</code>).`);
  });

  // /parents_run_rewards
  bot.onText(/^\/parents_run_rewards(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    await reply(msg.chat.id, '⏳ Mukofotlash boshlandi...');
    try {
      const r = await scheduler.runWeeklyRewards();
      await reply(
        msg.chat.id,
        `✅ Yakunlandi.\nMukofotlangan ota-onalar: <b>${r.rewardedParents}</b>\n` +
          `Ballangan o'quvchilar: <b>${r.awardedStudents}</b>\n` +
          `Bog'lanmagan faollar: <b>${r.unlinkedActive}</b>`
      );
    } catch (err) {
      logger.error('[parents] run_rewards', { error: err.message });
      await reply(msg.chat.id, `❌ Xato: ${err.message}`);
    }
  });

  // /parents_run_reminders
  bot.onText(/^\/parents_run_reminders(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    await reply(msg.chat.id, '⏳ Eslatmalar yuborilmoqda...');
    try {
      const r = await scheduler.runInactivityReminders();
      await reply(msg.chat.id, `✅ Yakunlandi. Eslatma: <b>${r.remindersSent}</b>`);
    } catch (err) {
      logger.error('[parents] run_reminders', { error: err.message });
      await reply(msg.chat.id, `❌ Xato: ${err.message}`);
    }
  });

  // /parents_run_subs
  bot.onText(/^\/parents_run_subs(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    await reply(msg.chat.id, '⏳ Obuna tekshiruvi boshlandi...');
    try {
      const r = await scheduler.runSubscriptionCheck();
      await reply(
        msg.chat.id,
        `✅ Yakunlandi.\nTekshirildi: <b>${r.checked}</b>\nOgohlantirildi: <b>${r.notified}</b>`
      );
    } catch (err) {
      logger.error('[parents] run_subs', { error: err.message });
      await reply(msg.chat.id, `❌ Xato: ${err.message}`);
    }
  });

  // /parents_groups
  bot.onText(/^\/parents_groups(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const groups = await prisma.parentGroupActivity.groupBy({
      by: ['chatId'],
      _count: { _all: true },
    });
    if (groups.length === 0) {
      await reply(msg.chat.id, `📭 Hozircha guruh ma'lumotlari yo'q.`);
      return;
    }
    const lines = groups.map(
      (g, i) => `${i + 1}. <code>${g.chatId}</code> — ${g._count._all} yozuv`
    );
    await reply(msg.chat.id, `🗂 <b>Guruhlar</b>\n\n${lines.join('\n')}`);
  });

  // /parents_chatid — istalgan chatda
  bot.onText(/^\/parents_chatid(?:@\w+)?$/, async (msg) => {
    await reply(
      msg.chat.id,
      `🆔 Chat ID: <code>${msg.chat.id}</code>\nType: <code>${msg.chat.type}</code>\n` +
        `Sizning ID: <code>${msg.from.id}</code>`
    );
  });

  logger.info('[parents] Admin buyruqlari ro\'yxatga olindi');
}

module.exports = { register };
