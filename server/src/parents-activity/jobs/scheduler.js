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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Guruh a'zosimi (ping yuborishdan oldin tekshiramiz). */
async function isGroupMember(chatId, telegramId) {
  const { bot } = state;
  try {
    const m = await bot.getChatMember(String(chatId), Number(telegramId));
    return ['creator', 'administrator', 'member', 'restricted'].includes(m.status);
  } catch (_) {
    return false;
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

    // Guruhga tashakkur xabari (ota-onani teglab)
    const firstName = await getFirstName(act.telegramId);
    await notification.sendAndLog({
      chatId: act.chatId,
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
          `Ular botga farzandi ismini yozsa avtomatik bog'lanadi, yoki /parents_link bilan qo'lda bog'lang.`,
        { disable_web_page_preview: true }
      );
    } catch (_) { /* ignore */ }
  }

  return { rewardedParents, awardedStudents, unlinkedActive };
}

/**
 * Nofaol (o'tgan hafta guruhda xabar yozmagan) bog'langan ota-onalarga eslatma.
 */
async function runInactivityReminders() {
  const { logger } = state;
  const weekStart = previousWeekStart();
  logger.info('[parents] Nofaollik eslatmalari boshlandi', { week: formatWeek(weekStart) });

  // Nomzodlar: bog'langan ota-onalar (ular aniq Roboschool ota-onasi)
  const links = await link.listLinks(10000);
  const candidateIds = [...new Set(links.map((l) => l.telegramId))];

  const groups = await activity.getGroupChatIds();
  const cooldownSince = daysAgo(config.reminderCooldownDays);

  let remindersSent = 0;

  for (const groupChatId of groups) {
    const inactiveIds = await activity.getInactiveTelegramIdsForGroup(
      groupChatId,
      weekStart,
      candidateIds
    );

    for (const tid of inactiveIds) {
      // Yaqinda eslatma yuborilgan bo'lsa — o'tkazamiz
      const recently = await notification.wasNotifiedRecently(tid, 'INACTIVITY_REPLY', cooldownSince);
      if (recently) continue;

      // Faqat shu guruh a'zolariga
      const member = await isGroupMember(groupChatId, tid);
      if (!member) continue;

      const firstName = await getFirstName(tid);
      const sent = await notification.sendAndLog({
        chatId: groupChatId,
        text: notification.inactivityText({ firstName, targetTelegramId: tid }),
        type: 'INACTIVITY_REPLY',
        targetTelegramId: tid,
      });

      if (sent) {
        await activity.markReminded({ telegramId: tid, chatId: groupChatId, weekStart });
        remindersSent += 1;
        await sleep(150);
      }
    }
  }

  logger.info('[parents] Nofaollik eslatmalari tugadi', { remindersSent });
  return { remindersSent };
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

  cron.schedule(config.weeklyCron, async () => {
    logger.info('[parents] CRON haftalik ish');
    try {
      await runWeeklyRewards();
      await runInactivityReminders();
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

  logger.info('[parents] Cron o\'rnatildi', {
    weekly: config.weeklyCron,
    subs: config.dailySubscriptionCron,
  });
}

module.exports = {
  start,
  runWeeklyRewards,
  runInactivityReminders,
  runSubscriptionCheck,
};
