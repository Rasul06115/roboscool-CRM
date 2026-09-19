'use strict';

const state = require('./state');
const config = require('./config');
const messages = require('./handlers/messages');
const adminCommands = require('./handlers/adminCommands');
const scheduler = require('./jobs/scheduler');

/**
 * Ota-onalar aktivlik modulini mavjud CRM botiga ulaydi.
 *
 * @param {Object} opts
 * @param {Object} opts.bot     - CRM'ning telegramService.initBot() qaytargan bot instansiyasi
 * @param {Object} opts.prisma  - CRM'ning prisma instansiyasi (config/prisma)
 * @param {Object} opts.logger  - CRM'ning winston loggeri (config/logger)
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
  });

  messages.register();
  adminCommands.register();
  scheduler.start();

  state.logger.info('[parents] ✅ Ota-onalar aktivlik moduli ishga tushdi');

  return {
    runWeeklyRewards: scheduler.runWeeklyRewards,
    runInactivityReminders: scheduler.runInactivityReminders,
    runSubscriptionCheck: scheduler.runSubscriptionCheck,
  };
}

module.exports = { init };
