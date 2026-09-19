'use strict';

const state = require('../state');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Xabar yuborish va parent_bot_notifications ga log yozish.
 */
async function sendAndLog({ chatId, text, replyToMessageId, type, targetTelegramId }) {
  const { bot, prisma, logger } = state;
  try {
    const options = { parse_mode: 'HTML', disable_web_page_preview: true };
    if (replyToMessageId) options.reply_to_message_id = replyToMessageId;

    const sent = await bot.sendMessage(String(chatId), text, options);

    await prisma.parentBotNotification.create({
      data: {
        telegramId: String(targetTelegramId),
        chatId: String(chatId),
        type,
        messageId: sent?.message_id ? Number(sent.message_id) : null,
      },
    });

    return sent;
  } catch (err) {
    logger.error('[parents] Xabar yuborilmadi', {
      error: err.message,
      chatId: String(chatId),
      type,
    });
    return null;
  }
}

/**
 * Oxirgi cooldown kunlarida shu turdagi xabar yuborilganmi?
 */
async function wasNotifiedRecently(telegramId, type, sinceDate) {
  const { prisma } = state;
  const n = await prisma.parentBotNotification.count({
    where: {
      telegramId: String(telegramId),
      type,
      sentAt: { gte: sinceDate },
    },
  });
  return n > 0;
}

function mention(telegramId, name) {
  return `<a href="tg://user?id=${String(telegramId)}">${escapeHtml(name || 'ota-ona')}</a>`;
}

function inactivityText({ firstName, targetTelegramId }) {
  return (
    `👋 ${mention(targetTelegramId, firstName || 'Hurmatli ota-ona')}, ` +
    `sizga farzandingiz o'qishida erishayotgan natijalari qiziq emasmi? 🎓📚\n\n` +
    `Guruhda faol qatnashib, farzandingizning muvaffaqiyatlaridan xabardor bo'lib turing. ` +
    `Har haftalik aktivlik uchun farzandingizga qo'shimcha ballar beriladi ⭐`
  );
}

function rewardText({ firstName, points, studentNames = [], targetTelegramId }) {
  const students = studentNames.length
    ? ` (<b>${escapeHtml(studentNames.join(', '))}</b>)`
    : '';
  return (
    `🎉 Tashakkur sizga, ${mention(targetTelegramId, firstName || 'Hurmatli ota-ona')}!\n\n` +
    `Haftada aktiv xabarlaringiz uchun farzandingizga${students} ` +
    `<b>${points} ball</b> berildi ⭐\n\n` +
    `Faolligingiz farzandingizning muvaffaqiyatiga hissa qo'shadi 💪`
  );
}

function subscriptionText({ firstName, missing }) {
  const list = missing.map((c) => `• https://t.me/${c.replace('@', '')}`).join('\n');
  return (
    `📢 ${escapeHtml(firstName || 'Hurmatli ota-ona')}, ` +
    `iltimos, Roboschool rasmiy kanallariga obuna bo'ling:\n\n` +
    `${list}\n\n` +
    `Kanallarda darslar jadvali, yangi tanlovlar va farzandingiz uchun ` +
    `foydali ma'lumotlar joylanadi 📚`
  );
}

module.exports = {
  sendAndLog,
  wasNotifiedRecently,
  inactivityText,
  rewardText,
  subscriptionText,
  escapeHtml,
};
