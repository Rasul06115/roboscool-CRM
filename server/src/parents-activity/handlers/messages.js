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

      // Guruhga kirdi/chiqdi kabi xizmat xabarlari faollik emas
      if (msg.new_chat_members || msg.left_chat_member || msg.pinned_message) return;

      const sentAt = msg.date ? new Date(msg.date * 1000) : new Date();
      await activity.recordMessage({
        telegramId: msg.from.id,
        chatId: msg.chat.id,
        sentAt,
      });
      // Eslatma va tashakkur shu xabarga REPLY qilinadi
      await activity.rememberLastMessage({
        telegramId: msg.from.id,
        chatId: msg.chat.id,
        messageId: msg.message_id,
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
  // 'message' hodisasi BARCHA turdagi xabarlarda (matn, rasm, stiker, ovoz...) chiqadi.
  // (Oldin rasm/stiker uchun alohida listener ham bor edi — ular ikki marta sanalardi.)
  bot.on('message', onAnyMessage);

  logger.info('[parents] Xabar handlerlari o\'rnatildi');
}

module.exports = { register, onAnyMessage, isAllowedGroup, isAdmin };
