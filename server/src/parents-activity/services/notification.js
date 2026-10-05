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
async function sendAndLog({ chatId, text, replyToMessageId, type, targetTelegramId, replyMarkup }) {
  const { bot, prisma, logger } = state;
  try {
    const options = { parse_mode: 'HTML', disable_web_page_preview: true };
    if (replyToMessageId) {
      options.reply_to_message_id = Number(replyToMessageId);
      // Ota-ona xabarini o'chirib yuborgan bo'lsa ham xabar baribir yuborilsin
      options.allow_sending_without_reply = true;
    }
    if (replyMarkup) options.reply_markup = JSON.stringify(replyMarkup);

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

/**
 * Telegram ismini tozalash: maxsus shriftlar (𝐀𝐳𝐢𝐳 → Aziz) oddiy harfga aylanadi,
 * harf bo'lmasa (faqat belgi/emoji) — umumiy murojaat ishlatiladi.
 */
function cleanName(name, fallback = 'Hurmatli ota-ona') {
  const s = String(name || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s'’.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /\p{L}/u.test(s) ? s.slice(0, 40) : fallback;
}

function mention(telegramId, name) {
  return `<a href="tg://user?id=${String(telegramId)}">${escapeHtml(cleanName(name))}</a>`;
}

/** "📱 Farzandimning natijalari" — botdagi shaxsiy kabinetga olib boradi. */
function resultsButton() {
  if (!state.botUsername) return null;
  return {
    inline_keyboard: [[
      { text: '📱 Farzandimning natijalari', url: `https://t.me/${state.botUsername}?start=kabinet` },
    ]],
  };
}

// Har hafta bir xil matn zerikarli bo'lmasligi uchun bir nechta variant
const INACTIVE_VARIANTS = [
  (n) =>
    `👋 Assalomu alaykum, ${n}!\n\n` +
    `🤔 Sizga farzandingizning o'qishda erishayotgan natijalari qiziq emasmi? 🎓📚\n\n` +
    `🤖 Farzandingiz har darsda robot yig'ib, dastur yozib, yangi bilimlarni o'rganmoqda. ` +
    `Uning muvaffaqiyatlarini birga kuzatib boraylik! 🚀`,
  (n) =>
    `🌟 ${n}, farzandingiz sizning e'tiboringizni kutmoqda! 💙\n\n` +
    `👨‍👩‍👦 Ota-ona qiziqishi — bolaning eng katta motivatsiyasi. ` +
    `Guruhdagi yangiliklarga bitta reaksiya 👍 yoki izoh ✍️ ham farzandingizni ruhlantiradi! 💪`,
  (n) =>
    `📚 ${n}, o'tgan hafta guruhda sizni ko'rmadik 😊\n\n` +
    `🏆 Farzandingiz ballar to'plab, reytingda ko'tarilmoqda. ` +
    `Uning yutuqlari, baholari va davomatini bir tugma bilan ko'ring 👇`,
];

function inactivityText({ firstName, targetTelegramId, count = 0, variant }) {
  const n = mention(targetTelegramId, firstName || 'Hurmatli ota-ona');
  const min = require('../config').minMessagesForActive;
  const v = Number.isInteger(variant) ? variant : Math.floor(Math.random() * INACTIVE_VARIANTS.length);
  const body = INACTIVE_VARIANTS[v % INACTIVE_VARIANTS.length](n);
  const progress = count > 0
    ? `\n\n📊 O'tgan hafta faolligingiz: <b>${count} / ${min}</b> — yana ozgina qoldi! 🔥`
    : '';
  return (
    body + progress +
    `\n\n⭐ Haftasiga kamida <b>${min} marta</b> faol bo'lsangiz (xabar, izoh yoki reaksiya), ` +
    `farzandingizga <b>+3 ball</b> beriladi! 🎁`
  );
}

function rewardText({ firstName, points, studentNames = [], targetTelegramId }) {
  const students = studentNames.length
    ? ` (<b>${escapeHtml(studentNames.join(', '))}</b>)`
    : '';
  return (
    `🎉 Tashakkur sizga, ${mention(targetTelegramId, firstName || 'Hurmatli ota-ona')}!\n\n` +
    `Haftadagi faolligingiz (xabar, izoh va reaksiyalar) uchun farzandingizga${students} ` +
    `<b>${points} ball</b> berildi ⭐\n\n` +
    `Faolligingiz farzandingizning muvaffaqiyatiga hissa qo'shadi 💪`
  );
}

function subscriptionText({ firstName, missing }) {
  const list = missing.map((c) => `• https://t.me/${c.replace('@', '')}`).join('\n');
  return (
    `📢 ${escapeHtml(cleanName(firstName))}, ` +
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
  resultsButton,
  INACTIVE_VARIANTS,
  subscriptionText,
  escapeHtml,
  cleanName,
};
