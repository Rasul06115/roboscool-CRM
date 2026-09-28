'use strict';

const state = require('../state');
const config = require('../config');
const activity = require('../services/activity');

function isAllowedGroup(chatId) {
  if (config.allowedGroupChatIds.length === 0) return true;
  return config.allowedGroupChatIds.includes(String(chatId));
}

function isAdmin(chatId) {
  return String(chatId) === String(config.adminChatId);
}

/**
 * Guruh xabarlari listeneri — ota-ona aktivligini yozadi.
 * Eslatma: ism bo'yicha avtomatik bog'lash O'CHIRILGAN (noto'g'ri bog'lanishlar bo'lgani uchun).
 * Endi ota-ona faqat telefon raqami orqali bog'lanadi (handlers/contactLink.js).
 */
async function onAnyMessage(msg) {
  try {
    if (!msg || !msg.chat || !msg.from || msg.from.is_bot) return;

    const chatType = msg.chat.type;

    // ---- GURUH aktivligi ----
    if (chatType === 'group' || chatType === 'supergroup') {
      if (msg.text && msg.text.startsWith('/')) return; // buyruqlarni sanamaymiz
      if (!isAllowedGroup(msg.chat.id)) return;

      const sentAt = msg.date ? new Date(msg.date * 1000) : new Date();
      await activity.recordMessage({
        telegramId: msg.from.id,
        chatId: msg.chat.id,
        sentAt,
      });
      return;
    }
  } catch (err) {
    state.logger.error('[parents] onAnyMessage xato', { error: err.message });
  }
}

function register() {
  const { bot, logger } = state;
  // CRM botining o'z 'message' handleri saqlanadi — biz qo'shimcha listener qo'shamiz.
  bot.on('message', onAnyMessage);

  // Media xabarlar ham guruh aktivligiga kiradi (matnsiz)
  bot.on('sticker', onAnyMessage);
  bot.on('photo', onAnyMessage);
  bot.on('video', onAnyMessage);
  bot.on('voice', onAnyMessage);
  bot.on('video_note', onAnyMessage);
  bot.on('animation', onAnyMessage);
  bot.on('document', onAnyMessage);

  logger.info('[parents] Xabar handlerlari o\'rnatildi');
}

module.exports = { register, onAnyMessage, isAllowedGroup, isAdmin };
