'use strict';

/**
 * Guruhdagi REAKSIYALARNI (👍 ❤️ 🔥 ...) ota-ona faolligi sifatida hisoblash.
 *
 * Telegram reaksiyalarni botga faqat so'ralganda yuboradi ("message_reaction"),
 * va bu kutubxona versiyasi (node-telegram-bot-api 0.64) ularni o'zi chiqarmaydi.
 * Shuning uchun:
 *   1) polling so'roviga allowed_updates ichida "message_reaction" qo'shiladi;
 *   2) bot.processUpdate o'raladi — reaksiya kelsa "message_reaction" hodisasi chiqariladi.
 * CRM'ning telegramService.js fayliga TEGILMAYDI.
 *
 * Qoidalar:
 *   - bitta odam bitta xabarga — FAQAT BIR MARTA hisoblanadi (qo'yib-olib sonini oshirib bo'lmaydi);
 *   - o'quvchi o'zi haqidagi e'longa reaksiya qo'ysa — hisoblanmaydi;
 *   - anonim (kanal/guruh nomidan) reaksiyalar hisoblanmaydi;
 *   - ball baribir faqat telefon orqali tasdiqlangan ota-onalarga beriladi.
 */

const state = require('../state');
const config = require('../config');
const activity = require('../services/activity');

// Bot oladigan yangilanish turlari (standart ro'yxat + reaksiyalar)
const ALLOWED_UPDATES = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'inline_query',
  'chosen_inline_result',
  'callback_query',
  'shipping_query',
  'pre_checkout_query',
  'poll',
  'poll_answer',
  'my_chat_member',
  'chat_join_request',
  'message_reaction',
];

function isAllowedGroup(chatId) {
  if (config.allowedGroupChatIds.length === 0) return true;
  return config.allowedGroupChatIds.includes(String(chatId));
}

/** Polling'ga reaksiyalarni qo'shish va processUpdate'ni o'rash. */
function enableReactionUpdates(bot) {
  const { logger } = state;

  // 1) Keyingi getUpdates so'rovlarida reaksiyalar ham kelsin
  const params = bot._polling?.options?.params;
  if (params) {
    params.allowed_updates = JSON.stringify(ALLOWED_UPDATES);
  } else {
    logger.warn('[reactions] Polling topilmadi — reaksiyalar hisoblanmaydi');
    return false;
  }

  // 2) Reaksiya kelsa — alohida hodisa chiqaramiz (bir marta o'raladi)
  if (!bot.__reactionsWrapped) {
    const original = bot.processUpdate.bind(bot);
    bot.processUpdate = (update) => {
      if (update && update.message_reaction) {
        try { bot.emit('message_reaction', update.message_reaction); } catch (_) { /* ignore */ }
      }
      return original(update);
    };
    bot.__reactionsWrapped = true;
  }
  return true;
}

async function onReaction(r) {
  const { prisma, logger } = state;
  try {
    if (!r?.chat || (r.chat.type !== 'group' && r.chat.type !== 'supergroup')) return;
    if (!r.user || r.user.is_bot) return; // anonim yoki bot
    if (!isAllowedGroup(r.chat.id)) return;

    const added = Array.isArray(r.new_reaction) && r.new_reaction.length > 0;
    if (!added) return; // reaksiyani olib tashlash hisoblanmaydi

    const chatId = String(r.chat.id);
    const userId = String(r.user.id);

    // O'quvchi o'zi haqidagi e'longa reaksiya qo'ydimi?
    const own = await prisma.$queryRaw`
      SELECT 1 FROM "announcement_messages" m
      JOIN "students" s ON s."id" = m."student_id"
      WHERE m."chat_id" = ${chatId} AND m."message_id" = ${Number(r.message_id)}::int
        AND s."telegram_id" = ${userId}
      LIMIT 1
    `;
    if (own.length) return;

    // Bitta odam — bitta xabar — bir marta
    const inserted = await prisma.$queryRaw`
      INSERT INTO "parent_reactions" ("telegram_id", "chat_id", "message_id")
      VALUES (${userId}, ${chatId}, ${Number(r.message_id)}::int)
      ON CONFLICT DO NOTHING
      RETURNING "telegram_id"
    `;
    if (!inserted.length) return;

    await activity.recordMessage({
      telegramId: userId,
      chatId,
      sentAt: r.date ? new Date(r.date * 1000) : new Date(),
    });
  } catch (err) {
    // Jadval yaratilmagan bo'lsa log to'lib ketmasin
    if (!/parent_reactions|announcement_messages/.test(String(err.message))) {
      logger.error('[reactions] xato', { error: err.message });
    }
  }
}

function register() {
  const { bot, logger } = state;
  const ok = enableReactionUpdates(bot);
  bot.on('message_reaction', onReaction);
  if (ok) logger.info('[reactions] Reaksiyalar hisobga olinmoqda');
}

module.exports = { register, onReaction, enableReactionUpdates, ALLOWED_UPDATES };
