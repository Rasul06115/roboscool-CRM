'use strict';

const state = require('./state');
const config = require('./config');
const messages = require('./handlers/messages');
const adminCommands = require('./handlers/adminCommands');
const scheduler = require('./jobs/scheduler');
const rewardsRouter = require('./routes');
const cabinetRouter = require('./cabinetRoutes');
const cabinetCommands = require('./handlers/cabinetCommands');

/**
 * Ota-onalar aktivlik moduli + oylik TOP chegirma.
 *
 * @param {Object} opts
 * @param {Object} opts.bot     - telegramService.initBot() qaytargan bot
 * @param {Object} opts.prisma  - CRM prisma (config/prisma)
 * @param {Object} opts.logger  - CRM winston logger (config/logger)
 */
function init({ bot, prisma, logger }) {
  if (!bot) {
    (logger || console).warn('[parents] bot yo\'q — modul ishga tushmadi (token sozlanmaganmi?)');
    return null;
  }
  if (!prisma) throw new Error('[parents] prisma kerak');

  state.bot = bot;
  state.prisma = prisma;
  state.logger = logger || console;
  state.adminChatId = config.adminChatId;
  state.initialized = true;

  state.logger.info('[parents] Ishga tushmoqda...', {
    admin: config.adminChatId,
    channels: [config.channelChinoz, config.channelMarket],
    allowedGroups: config.allowedGroupChatIds.length || 'HAMMA',
    top: `${config.topCount} ta / ${config.topDiscountPercent}%`,
  });

  messages.register();
  adminCommands.register();
  cabinetCommands.register();
  scheduler.start();

  state.logger.info('[parents] ✅ Ota-onalar aktivlik moduli ishga tushdi');

  return {
    runWeeklyRewards: scheduler.runWeeklyRewards,
    runInactivityReminders: scheduler.runInactivityReminders,
    runSubscriptionCheck: scheduler.runSubscriptionCheck,
    runMonthlyTop: scheduler.runMonthlyTop,
  };
}

// API routerlar (bot bo'lmasa ham ishlaydi)
module.exports = { init, rewardsRouter, cabinetRouter };
