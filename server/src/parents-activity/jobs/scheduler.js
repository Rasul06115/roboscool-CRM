'use strict';

const cron = require('node-cron');
const state = require('../state');
const config = require('../config');
const { previousWeekStart, formatWeek, daysAgo } = require('../utils/time');

const activity = require('../services/activity');
const achievement = require('../services/achievement');
const notification = require('../services/notification');
const subscription = require('../services/subscription');
const link = require('../services/link');
const topReward = require('../services/topReward');
const announce = require('../services/announce');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Guruhdagi holati: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | null */
async function memberStatus(chatId, telegramId) {
  const { bot } = state;
  try {
    const m = await bot.getChatMember(String(chatId), Number(telegramId));
    if (m.user && m.user.is_bot) return 'bot';
    return m.status;
  } catch (_) {
    return null;
  }
}

async function getFirstName(telegramId) {
  const { prisma } = state;
  try {
    const bu = await prisma.botUser.findUnique({
      where: { chatId: String(telegramId) },
      select: { firstName: true },
    });
    return bu?.firstName || 'Hurmatli ota-ona';
  } catch (_) {
    return 'Hurmatli ota-ona';
  }
}

/**
 * O'tgan hafta faol ota-onalarni mukofotlash.
 */
async function runWeeklyRewards() {
  const { logger } = state;
  const weekStart = previousWeekStart();
  const weekLabel = formatWeek(weekStart);
  logger.info('[parents] Mukofotlash boshlandi', { week: weekLabel });

  const activeList = await activity.getActiveParents(weekStart, config.minMessagesForActive);

  let rewardedParents = 0;
  let awardedStudents = 0;
  let unlinkedActive = 0;

  for (const act of activeList) {
    const students = await link.getLinkedStudents(act.telegramId);

    if (students.length === 0) {
      // Faol, lekin hech qanday o'quvchiga bog'lanmagan — ball berilmaydi
      unlinkedActive += 1;
      logger.warn('[parents] Faol ota-ona bog\'lanmagan', { telegramId: act.telegramId });
      continue;
    }

    // Har bir bog'langan o'quvchiga ball
    for (const s of students) {
      const created = await achievement.addParentActivityPoints({
        studentId: s.id,
        points: config.activeRewardPoints,
        title: 'Ota-ona faolligi',
        description: `${weekLabel} haftada guruhda ${act.messageCount} ta xabar`,
      });
      if (created) awardedStudents += 1;
    }

    // Guruhga tashakkur xabari (ota-onani teglab, oxirgi xabariga reply + tugma)
    const firstName = await getFirstName(act.telegramId);
    await notification.sendAndLog({
      chatId: act.chatId,
      replyToMessageId: await activity.lastMessageId(act.telegramId, act.chatId),
      replyMarkup: notification.resultsButton(),
      text: notification.rewardText({
        firstName,
        points: config.activeRewardPoints,
        studentNames: students.map((s) => s.fullName),
        targetTelegramId: act.telegramId,
      }),
      type: 'REWARD_REPLY',
      targetTelegramId: act.telegramId,
    });

    await activity.markRewarded(act.id);
    rewardedParents += 1;
    await sleep(120);
  }

  logger.info('[parents] Mukofotlash tugadi', {
    rewardedParents,
    awardedStudents,
    unlinkedActive,
  });

  // Adminni bog'lanmagan faollar haqida ogohlantirish
  if (unlinkedActive > 0) {
    try {
      await state.bot.sendMessage(
        String(config.adminChatId),
        `ℹ️ Ota-onalar moduli: ${unlinkedActive} ta faol ota-ona hech qanday o'quvchiga ` +
          `bog'lanmagani uchun ball ololmadi.\n` +
          `Ular botda /ulash orqali telefon raqamini yuborsa, keyingi haftadan ball oladi. /ulash_elon — guruhlarga eslatish.`,
        { disable_web_page_preview: true }
      );
    } catch (_) { /* ignore */ }
  }

  return { rewardedParents, awardedStudents, unlinkedActive };
}

/**
 * Nofaol ota-onalarga eslatma (har dushanba 08:00).
 *
 * Kimga: o'tgan hafta guruhda faolligi chegaradan (default 5) kam bo'lganlar —
 *   - oxirgi 60 kunda shu guruhda yozgan/reaksiya qo'ygan har kim,
 *   - telefon orqali ulangan ota-onalar (guruh a'zosi bo'lsa).
 * Kimga EMAS: guruh adminlari (o'qituvchilar), botlar, o'quvchilarning o'zlari,
 *   oxirgi 6 kunda eslatma olganlar.
 * Har bir eslatma ota-onaning oxirgi xabariga REPLY qilinadi va
 * "📱 Farzandimning natijalari" tugmasi bilan yuboriladi.
 */
async function runInactivityReminders() {
  const { logger } = state;
  const weekStart = previousWeekStart();
  logger.info('[parents] Nofaollik eslatmalari boshlandi', { week: formatWeek(weekStart) });

  const groups = (await announce.targetChats(null, { all: true }).catch(() => null)) || (await activity.getGroupChatIds());
  const cooldownSince = daysAgo(config.reminderCooldownDays);
  const button = notification.resultsButton();

  let remindersSent = 0;
  let skippedAdmins = 0;
  const perGroup = [];

  for (const groupChatId of groups) {
    let candidates = [];
    try {
      candidates = await activity.getReminderCandidates(groupChatId, weekStart, config.minMessagesForActive);
    } catch (err) {
      logger.error('[parents] eslatma nomzodlari xato', { chatId: groupChatId, error: err.message });
      continue;
    }

    let sentHere = 0;
    for (const c of candidates) {
      if (sentHere >= config.reminderMaxPerGroup) break;
      if (String(c.telegramId) === String(config.adminChatId)) continue;

      // Yaqinda eslatma yuborilgan bo'lsa — o'tkazamiz
      const recently = await notification.wasNotifiedRecently(c.telegramId, 'INACTIVITY_REPLY', cooldownSince);
      if (recently) continue;

      // Faqat shu guruhning oddiy a'zolariga (adminlar/o'qituvchilar va botlar — yo'q)
      const status = await memberStatus(groupChatId, c.telegramId);
      if (status === 'creator' || status === 'administrator') { skippedAdmins += 1; continue; }
      if (status !== 'member' && status !== 'restricted') continue;

      const firstName = await getFirstName(c.telegramId);
      const sent = await notification.sendAndLog({
        chatId: groupChatId,
        text: notification.inactivityText({ firstName, targetTelegramId: c.telegramId, count: c.count }),
        replyToMessageId: await activity.lastMessageId(c.telegramId, groupChatId),
        replyMarkup: button,
        type: 'INACTIVITY_REPLY',
        targetTelegramId: c.telegramId,
      });

      if (sent) {
        await activity.markReminded({ telegramId: c.telegramId, chatId: groupChatId, weekStart });
        remindersSent += 1;
        sentHere += 1;
        await sleep(1200); // Telegram guruh limiti: ~20 xabar/daqiqa
      }
    }
    if (sentHere) perGroup.push(sentHere);
  }

  logger.info('[parents] Nofaollik eslatmalari tugadi', { remindersSent, groups: perGroup.length, skippedAdmins });
  return { remindersSent, groups: perGroup.length };
}

/**
 * Barcha bot foydalanuvchilarining kanal obunasini tekshirish.
 */
async function runSubscriptionCheck() {
  const { prisma, logger } = state;
  logger.info('[parents] Obuna tekshiruvi boshlandi');

  // Faqat haqiqiy foydalanuvchilar (musbat chatId). Guruh id lari manfiy — chiqarib tashlaymiz.
  const users = await prisma.botUser.findMany({
    select: { chatId: true, firstName: true },
  });
  const parents = users.filter((u) => /^\d+$/.test(String(u.chatId)));

  let checked = 0;
  let notified = 0;

  for (const p of parents) {
    const res = await subscription.checkAndStore(p.chatId);
    checked += 1;
    if (res.missing.length === 0) continue;

    const sent = await notification.sendAndLog({
      chatId: p.chatId,
      text: notification.subscriptionText({
        firstName: p.firstName || 'Hurmatli ota-ona',
        missing: res.missing,
      }),
      type: 'SUBSCRIPTION_REMINDER',
      targetTelegramId: p.chatId,
    });

    if (sent) {
      await subscription.markNotified(p.chatId);
      notified += 1;
    }
    await sleep(100);
  }

  logger.info('[parents] Obuna tekshiruvi tugadi', { checked, notified });
  return { checked, notified };
}

function start() {
  const { logger } = state;

  // Dushanba 08:00 — nofaollarga eslatma
  cron.schedule(config.reminderCron, async () => {
    logger.info('[parents] CRON nofaollik eslatmalari');
    try {
      await runInactivityReminders();
    } catch (err) {
      logger.error('[parents] CRON eslatma xato', { error: err.message });
    }
  });

  // Dushanba 09:00 — faollarga tashakkur + ball
  cron.schedule(config.weeklyCron, async () => {
    logger.info('[parents] CRON haftalik mukofot');
    try {
      await runWeeklyRewards();
    } catch (err) {
      logger.error('[parents] CRON haftalik xato', { error: err.message });
    }
  });

  cron.schedule(config.dailySubscriptionCron, async () => {
    logger.info('[parents] CRON obuna tekshiruvi');
    try {
      await runSubscriptionCheck();
    } catch (err) {
      logger.error('[parents] CRON obuna xato', { error: err.message });
    }
  });

  cron.schedule(config.monthlyTopCron, async () => {
    logger.info('[parents] CRON oylik TOP chegirma');
    try {
      await topReward.runMonthlyTop();
    } catch (err) {
      logger.error('[parents] CRON oylik TOP xato', { error: err.message });
    }
  });

  let announcing = false;
  cron.schedule(config.announceCron, async () => {
    if (announcing) return; // oldingi tekshiruv tugamagan bo'lsa — kutamiz
    announcing = true;
    try {
      await announce.runAnnouncements();
    } catch (err) {
      // Jadval hali yaratilmagan bo'lsa log to'lib ketmasin
      if (!String(err.message).includes('announced_achievements')) {
        logger.error('[parents] CRON e\'lon xato', { error: err.message });
      }
    } finally {
      announcing = false;
    }
  });

  logger.info('[parents] Cron o\'rnatildi', {
    weekly: config.weeklyCron,
    reminders: config.reminderCron,
    subs: config.dailySubscriptionCron,
    monthlyTop: config.monthlyTopCron,
    announce: config.announceCron,
  });
}

module.exports = {
  start,
  runWeeklyRewards,
  runInactivityReminders,
  runSubscriptionCheck,
  runMonthlyTop: topReward.runMonthlyTop,
};
