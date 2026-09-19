'use strict';

const state = require('../state');
const { currentWeekStart } = require('../utils/time');

async function recordMessage({ telegramId, chatId, sentAt }) {
  const { prisma, logger } = state;
  const weekStart = currentWeekStart(sentAt);
  const tid = String(telegramId);
  const cid = String(chatId);

  try {
    await prisma.parentGroupActivity.upsert({
      where: {
        telegramId_chatId_weekStart: { telegramId: tid, chatId: cid, weekStart },
      },
      create: {
        telegramId: tid,
        chatId: cid,
        weekStart,
        messageCount: 1,
        lastMessageAt: sentAt,
      },
      update: {
        messageCount: { increment: 1 },
        lastMessageAt: sentAt,
      },
    });
  } catch (err) {
    logger.error('[parents] Aktivlik yozilmadi', {
      error: err.message,
      telegramId: tid,
      chatId: cid,
    });
  }
}

async function getActiveParents(weekStart, minMessages) {
  const { prisma } = state;
  return prisma.parentGroupActivity.findMany({
    where: {
      weekStart,
      messageCount: { gte: minMessages },
      rewarded: false,
    },
  });
}

/**
 * Guruhda o'tgan hafta xabar yozmagan ota-onalar (bog'langanlar ichidan).
 */
async function getInactiveTelegramIdsForGroup(chatId, weekStart, candidateTelegramIds) {
  const { prisma } = state;
  const cid = String(chatId);

  const activities = await prisma.parentGroupActivity.findMany({
    where: { chatId: cid, weekStart },
    select: { telegramId: true, messageCount: true },
  });

  const activeSet = new Set(
    activities.filter((a) => a.messageCount > 0).map((a) => a.telegramId)
  );

  return candidateTelegramIds.filter((tid) => !activeSet.has(String(tid)));
}

async function markRewarded(id) {
  const { prisma } = state;
  await prisma.parentGroupActivity.update({
    where: { id },
    data: { rewarded: true },
  });
}

async function markReminded({ telegramId, chatId, weekStart }) {
  const { prisma } = state;
  const tid = String(telegramId);
  const cid = String(chatId);
  await prisma.parentGroupActivity.upsert({
    where: {
      telegramId_chatId_weekStart: { telegramId: tid, chatId: cid, weekStart },
    },
    create: {
      telegramId: tid,
      chatId: cid,
      weekStart,
      messageCount: 0,
      lastMessageAt: new Date(0),
      reminded: true,
    },
    update: { reminded: true },
  });
}

async function getGroupChatIds() {
  const { prisma } = state;
  const groups = await prisma.parentGroupActivity.groupBy({ by: ['chatId'] });
  return groups.map((g) => g.chatId);
}

module.exports = {
  recordMessage,
  getActiveParents,
  getInactiveTelegramIdsForGroup,
  markRewarded,
  markReminded,
  getGroupChatIds,
};
