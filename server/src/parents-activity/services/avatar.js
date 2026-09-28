'use strict';

/**
 * O'quvchi rasmlari.
 *
 * Rasm Telegram serverida saqlanadi (Railway diski har deploy'da tozalanadi).
 * Bazada students.avatar = "tg:<file_id>" ko'rinishida yoziladi.
 *
 * Kabinetga rasm imzolangan havola orqali beriladi:
 *   /api/cabinet/avatar/<studentId>?s=<imzo>
 * Imzoni faqat server (bot tokeni bilan) yarata oladi — begona odam
 * o'quvchi ID sini bilsa ham rasmni ocha olmaydi.
 */

const crypto = require('crypto');

const PREFIX = 'tg:';

function isTelegramAvatar(avatar) {
  return typeof avatar === 'string' && avatar.startsWith(PREFIX) && avatar.length > PREFIX.length;
}

function fileIdOf(avatar) {
  return isTelegramAvatar(avatar) ? avatar.slice(PREFIX.length) : null;
}

function sign(studentId, avatar) {
  return crypto
    .createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN || 'no-token')
    .update(`avatar:${studentId}:${avatar}`)
    .digest('hex')
    .slice(0, 32);
}

function verify(studentId, avatar, signature) {
  if (!signature || !/^[0-9a-f]{32}$/.test(signature)) return false;
  const expected = Buffer.from(sign(studentId, avatar), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Kabinetga beriladigan rasm manzili (rasm almashsa — imzo ham, havola ham o'zgaradi). */
function publicAvatar(studentId, avatar) {
  if (!avatar) return null;
  if (isTelegramAvatar(avatar)) return `/api/cabinet/avatar/${studentId}?s=${sign(studentId, avatar)}`;
  if (/^(https?:|data:image\/)/.test(avatar)) return avatar;
  return null; // eski lokal fayl yo'llari (Railway'da yo'qolgan) — ko'rsatilmaydi
}

/** Telegram'dan rasmni yuklab olish. */
async function download(bot, avatar) {
  const fileId = fileIdOf(avatar);
  if (!bot || !fileId) return null;
  const url = await bot.getFileLink(fileId);
  const res = await fetch(url);
  if (!res.ok) return null;
  return {
    type: res.headers.get('content-type') || 'image/jpeg',
    buffer: Buffer.from(await res.arrayBuffer()),
  };
}

module.exports = { PREFIX, isTelegramAvatar, fileIdOf, sign, verify, publicAvatar, download };
