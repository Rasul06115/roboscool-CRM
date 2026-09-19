'use strict';

/**
 * init() chaqirilganda bu obyektga bot, prisma, logger yoziladi.
 * Barcha ichki fayllar shu state orqali ularga kiradi.
 */
const state = {
  bot: null,
  prisma: null,
  logger: null,
  adminChatId: null, // string
  initialized: false,
};

module.exports = state;
