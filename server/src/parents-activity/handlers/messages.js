'use strict';

const state = require('../state');
const config = require('../config');
const activity = require('../services/activity');
const link = require('../services/link');

function isAllowedGroup(chatId) {
  if (config.allowedGroupChatIds.length === 0) return true;
  return config.allowedGroupChatIds.includes(String(chatId));
}

function isAdmin(chatId) {
  return String(chatId) === String(config.adminChatId);
}

/**
 * Barcha xabarlar uchun bitta listener.
 * - GURUH: ota-ona aktivligini yozadi.
 * - SHAXSIY (admin emas): o'quvchi ismini qidirsa, avtomatik bog'laydi (javob YUBORMAYDI —
 *   CRM botining o'z javobiga umuman tegmaydi).
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

    // ---- SHAXSIY chat: auto-link ----
    if (chatType === 'private') {
      const text = msg.text?.trim();
      if (!text || text.startsWith('/')) return; // buyruqlar avtomatik bog'lanmaydi
      if (isAdmin(msg.chat.id)) return; // admin qidiruvi bog'lanmaydi

      // msg.from.id === msg.chat.id (private) — ota-onaning telegram id si
      await link.autoLinkFromLookup(msg.from.id, text);
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
