'use strict';

const state = require('../state');
const config = require('../config');

const SUBSCRIBED = new Set(['creator', 'administrator', 'member', 'restricted']);

async function isSubscribed(channelUsername, telegramId) {
  const { bot, logger } = state;
  try {
    const member = await bot.getChatMember(channelUsername, Number(telegramId));
    return SUBSCRIBED.has(member.status);
  } catch (err) {
    logger.debug('[parents] Obuna tekshiruvi', {
      channel: channelUsername,
      telegramId: String(telegramId),
      error: err.message,
    });
    return false;
  }
}

async function checkAndStore(telegramId) {
  const { prisma } = state;
  const [chinoz, market] = await Promise.all([
    isSubscribed(config.channelChinoz, telegramId),
    isSubscribed(config.channelMarket, telegramId),
  ]);

  const tid = String(telegramId);
  await prisma.parentSubscriptionCheck.upsert({
    where: { telegramId: tid },
    create: {
      telegramId: tid,
      subscribedRoboschoolChinoz: chinoz,
      subscribedRoboschoolMarket: market,
    },
    update: {
      subscribedRoboschoolChinoz: chinoz,
      subscribedRoboschoolMarket: market,
      lastCheckedAt: new Date(),
    },
  });

  const missing = [];
  if (!chinoz) missing.push(config.channelChinoz);
  if (!market) missing.push(config.channelMarket);

  return { chinoz, market, missing };
}

async function markNotified(telegramId) {
  const { prisma } = state;
  await prisma.parentSubscriptionCheck.update({
    where: { telegramId: String(telegramId) },
    data: { notifiedAt: new Date() },
  });
}

module.exports = { isSubscribed, checkAndStore, markNotified };
