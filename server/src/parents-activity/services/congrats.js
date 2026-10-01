'use strict';

/**
 * Oylik TOP g'oliblari uchun TABRIKNOMA.
 *
 * CRM Boshqaruv sahifasidagi "🎉 Tabriknoma" tugmasi bosilganda:
 *   - o'quvchi rasmi + ostida tabrik matni (caption)
 *   - barcha ota-onalar Telegram guruhlariga VA Roboschool kanaliga yuboriladi
 *   - matn oxirida ota-onalar uchun CTA: "Keyingi oy sizning farzandingiz ham ..."
 *   - "📱 Farzandim natijalari" tugmasi — botdagi shaxsiy kabinetga olib boradi
 *
 * Takroriy yuborishning oldi olinadi: monthly_discounts.congratulated_at
 * (qayta yuborish faqat aniq so'ralganda — force).
 */

const prisma = require('../../config/prisma');
const state = require('../state');
const config = require('../config');
const avatar = require('./avatar');
const announce = require('./announce');
const { escapeHtml } = require('./notification');
const { monthName } = require('../utils/time');

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const CAPTION_LIMIT = 1024; // Telegram rasm izohi chegarasi

function deepLink(payload) {
  return state.botUsername ? `https://t.me/${state.botUsername}?start=${payload}` : null;
}

/** Tabriknoma matni (rasm ostidagi caption). */
function congratsCaption(d) {
  const percent = d.discountPercent || config.topDiscountPercent;
  const medal = MEDALS[d.rank - 1] || '🏅';
  const text =
    `🏆 <b>${monthName(d.period).toUpperCase()} OYINING TOP-${config.topCount} O'QUVCHISI!</b>\n\n` +
    `${medal} <b>${d.rank}-o'rin — ${escapeHtml(d.studentName)}</b>\n` +
    (d.groupName ? `👥 Guruh: ${escapeHtml(d.groupName)}\n` : '') +
    `⭐ Oy davomida to'plangan ball: <b>${d.points}</b>\n\n` +
    `🎁 Mukofot: <b>${monthName(d.validMonth)}</b> oyi to'loviga <b>${percent}% chegirma!</b>\n\n` +
    `Tabriklaymiz! Bilim va mehnat albatta o'z samarasini beradi 💪\n\n` +
    `📣 <b>Hurmatli ota-onalar!</b> Keyingi oy sizning farzandingiz ham ` +
    `<b>${percent}% chegirmani</b> qo'lga kiritishi mumkin! Darslarda faol qatnashish, ` +
    `vazifalarni bajarish va yutuqlar — har biri ball olib keladi.\n\n` +
    `<i>ℹ️ Adolat uchun bu oy g'oliblari keyingi oy reytingda dam oladi — imkoniyat hammaga!</i>\n\n` +
    `<i>Roboschool o'quv markazi</i> 🤖📚`;
  // Juda uzun ism yoki guruh nomi bo'lsa ham chegaradan oshmasin
  return text.length <= CAPTION_LIMIT ? text : text.slice(0, CAPTION_LIMIT - 1);
}

function replyMarkup() {
  const link = deepLink('kabinet');
  if (!link) return undefined;
  return JSON.stringify({ inline_keyboard: [[{ text: '📱 Farzandim natijalari', url: link }]] });
}

async function getDiscount(id) {
  const rows = await prisma.$queryRaw`
    SELECT d."id", d."student_id", d."student_name", d."group_name", d."period", d."valid_month",
           d."rank", d."points", d."discount_percent", d."congratulated_at",
           s."avatar"
    FROM "monthly_discounts" d
    LEFT JOIN "students" s ON s."id" = d."student_id"
    WHERE d."id" = ${String(id)}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    groupName: r.group_name,
    period: r.period,
    validMonth: r.valid_month,
    rank: Number(r.rank),
    points: Number(r.points),
    discountPercent: Number(r.discount_percent),
    congratulatedAt: r.congratulated_at,
    avatar: r.avatar,
  };
}

/** Rasm manbai: Telegram file_id yoki ochiq https havola. Yo'q bo'lsa — null (matn yuboriladi). */
function photoSource(av) {
  const fileId = avatar.fileIdOf(av);
  if (fileId) return fileId;
  if (/^https:\/\//i.test(av || '')) return av;
  return null;
}

async function sendOne(chatId, d, { remember }) {
  const { bot } = state;
  const text = congratsCaption(d);
  const opts = { parse_mode: 'HTML' };
  const markup = replyMarkup();
  if (markup) opts.reply_markup = markup;

  const photo = photoSource(d.avatar);
  let sent;
  if (photo) {
    try {
      sent = await bot.sendPhoto(chatId, photo, { ...opts, caption: text });
    } catch (err) {
      // Rasm yuborilmasa (eskirgan havola va h.k.) — matn bilan yuboramiz
      state.logger.warn('[congrats] rasm yuborilmadi, matn yuborilmoqda', { chatId, error: err.message });
      sent = await bot.sendMessage(chatId, text, { ...opts, disable_web_page_preview: true });
    }
  } else {
    sent = await bot.sendMessage(chatId, text, { ...opts, disable_web_page_preview: true });
  }
  // O'quvchi o'z tabrigiga reaksiya qo'ysa — ota-ona faolligi hisoblanmasin
  if (remember && sent?.message_id) await announce.rememberMessage(chatId, sent.message_id, d.studentId);
  return sent;
}

/**
 * Bitta g'olibni guruhlarga va kanalga e'lon qilish.
 * @returns {Promise<{ok:boolean, error?:string, groupsSent:number, groupsFailed:number, channelSent:boolean, channelError?:string, alreadySent?:boolean}>}
 */
async function congratulate(id, { force = false } = {}) {
  const { bot, logger } = state;
  if (!bot) return { ok: false, error: 'Bot ishlamayapti' };

  const d = await getDiscount(id);
  if (!d) return { ok: false, notFound: true, error: 'Yozuv topilmadi' };
  if (d.congratulatedAt && !force) {
    return { ok: false, alreadySent: true, error: 'Tabriknoma oldin yuborilgan', congratulatedAt: d.congratulatedAt };
  }

  // Avval "band qilamiz" — ikki marta bosilsa ham bir marta yuborilsin
  const claimed = force
    ? await prisma.$queryRaw`
        UPDATE "monthly_discounts" SET "congratulated_at" = NOW()
        WHERE "id" = ${d.id} RETURNING "id"`
    : await prisma.$queryRaw`
        UPDATE "monthly_discounts" SET "congratulated_at" = NOW()
        WHERE "id" = ${d.id} AND "congratulated_at" IS NULL RETURNING "id"`;
  if (!claimed.length) return { ok: false, alreadySent: true, error: 'Tabriknoma oldin yuborilgan' };

  const result = { ok: true, groupsSent: 0, groupsFailed: 0, channelSent: false, channelError: null };

  // 1) Barcha ota-onalar guruhlari
  const chats = await announce.targetChats(null, { all: true });
  for (const chatId of chats) {
    try {
      await sendOne(chatId, d, { remember: true });
      result.groupsSent += 1;
    } catch (err) {
      result.groupsFailed += 1;
      logger.warn('[congrats] guruhga yuborilmadi', { chatId, error: err.message });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // 2) Roboschool kanali
  if (config.congratsChannel) {
    try {
      await sendOne(config.congratsChannel, d, { remember: false });
      result.channelSent = true;
    } catch (err) {
      result.channelError = err.message;
      logger.warn('[congrats] kanalga yuborilmadi', { channel: config.congratsChannel, error: err.message });
    }
  }

  // Hech qayerga ketmagan bo'lsa — belgini qaytaramiz, qayta bosish mumkin bo'lsin
  if (result.groupsSent === 0 && !result.channelSent) {
    if (d.congratulatedAt) {
      await prisma.$executeRaw`UPDATE "monthly_discounts" SET "congratulated_at" = ${new Date(d.congratulatedAt).toISOString()}::timestamptz AT TIME ZONE 'UTC' WHERE "id" = ${d.id}`;
    } else {
      await prisma.$executeRaw`UPDATE "monthly_discounts" SET "congratulated_at" = NULL WHERE "id" = ${d.id}`;
    }
    result.ok = false;
    result.error = chats.length
      ? "Hech qayerga yuborilmadi — bot guruh/kanalda admin ekanini tekshiring"
      : "Guruhlar topilmadi va kanalga ham yuborilmadi";
  } else {
    await prisma.$executeRaw`
      UPDATE "monthly_discounts"
      SET "congrats_groups" = ${result.groupsSent}::int, "congrats_channel" = ${result.channelSent}::boolean
      WHERE "id" = ${d.id}`;
  }

  logger.info('[congrats] tabriknoma', { id: d.id, student: d.studentName, ...result });
  return result;
}

/** Shu oy uchun hali tabriklanmagan barcha g'oliblar (o'rin tartibida). */
async function congratulateAll(validMonth) {
  const rows = await prisma.$queryRaw`
    SELECT "id" FROM "monthly_discounts"
    WHERE "valid_month" = ${validMonth} AND "congratulated_at" IS NULL
    ORDER BY "rank" ASC
  `;
  const summary = { total: rows.length, sent: 0, failed: 0, groupsSent: 0, channelSent: 0, channelError: null, errors: [] };
  for (const r of rows) {
    const res = await congratulate(r.id);
    if (res.ok) {
      summary.sent += 1;
      summary.groupsSent += res.groupsSent;
      if (res.channelSent) summary.channelSent += 1;
      if (res.channelError) summary.channelError = res.channelError;
    } else {
      summary.failed += 1;
      summary.errors.push(res.error);
    }
  }
  return summary;
}

module.exports = { congratulate, congratulateAll, congratsCaption, getDiscount };
