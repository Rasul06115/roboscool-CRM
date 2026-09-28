'use strict';

/**
 * O'quvchi rasmini bot orqali yuklash (faqat admin).
 *
 *  Telefonda o'quvchini rasmga oling va botga shaxsiy chatda yuboring. Ismni 3 usulda berish mumkin:
 *    1) rasm izohiga (caption) ism-familiya yozish;
 *    2) rasmga REPLY qilib ism-familiya yozish;
 *    3) izohsiz rasm yuborish — bot "Bu kimning rasmi?" deb so'raydi, keyingi xabarda ism yoziladi (5 daqiqa).
 *  Bir nechta o'quvchi topilsa — to'liqroq ismni keyingi xabarda yozish kifoya.
 *
 *  /rasmsiz — rasmi hali yuklanmagan o'quvchilar ro'yxati
 */

const state = require('../state');
const config = require('../config');
const avatar = require('../services/avatar');
const { escapeHtml } = require('../services/notification');

function isAdmin(msg) {
  return msg?.from && String(msg.from.id) === String(config.adminChatId);
}

async function findStudents(query) {
  const { prisma } = state;
  const words = String(query || '').trim().split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  return prisma.student.findMany({
    where: {
      status: 'ACTIVE',
      AND: words.map((w) => ({ fullName: { contains: w, mode: 'insensitive' } })),
    },
    select: { id: true, fullName: true, avatar: true, group: { select: { name: true } } },
    orderBy: { fullName: 'asc' },
    take: 11,
  });
}

// Izohsiz yuborilgan oxirgi rasm (admin keyingi xabarda ism yozishi uchun)
const PENDING_MS = 5 * 60 * 1000;
const pending = new Map(); // adminId -> { fileId, at }

function largestFileId(photo) {
  return Array.isArray(photo) && photo.length ? photo[photo.length - 1].file_id : null;
}

/**
 * Rasmni o'quvchiga biriktirish.
 * @returns {Promise<boolean>} saqlandimi
 */
async function assignPhoto(chatId, fileId, nameQuery) {
  const { bot, prisma, logger } = state;
  const query = String(nameQuery || '').trim();

  const found = await findStudents(query);
  if (found.length === 0) {
    await bot.sendMessage(
      chatId,
      `❌ "${escapeHtml(query)}" — faol o'quvchi topilmadi.\n\nIsm-familiyani tekshirib qayta yozing.`,
      { parse_mode: 'HTML' }
    );
    return false;
  }
  if (found.length > 1) {
    const list = found.slice(0, 10).map((st) => `• ${escapeHtml(st.fullName)} <i>(${escapeHtml(st.group?.name || '—')})</i>`).join('\n');
    await bot.sendMessage(
      chatId,
      `⚠️ Bir nechta o'quvchi topildi — <b>to'liq ism-familiyani</b> yozing:\n\n${list}`,
      { parse_mode: 'HTML' }
    );
    return false;
  }

  const student = found[0];
  await prisma.student.update({ where: { id: student.id }, data: { avatar: `${avatar.PREFIX}${fileId}` } });
  await bot.sendMessage(
    chatId,
    `✅ Rasm saqlandi: <b>${escapeHtml(student.fullName)}</b>` +
      (student.group?.name ? ` <i>(${escapeHtml(student.group.name)})</i>` : '') +
      (student.avatar ? '\n♻️ Oldingi rasm almashtirildi.' : '') +
      "\n\nEndi u kabinetda va guruhdagi e'lonlarda ko'rinadi.",
    { parse_mode: 'HTML' }
  );
  logger.info('[photos] Rasm saqlandi', { studentId: student.id });
  return true;
}

/** 1-usul: rasm + izohga ism.  3-usul (boshlanishi): izohsiz rasm — ism so'raladi. */
async function onPhoto(msg) {
  const { bot, logger } = state;
  try {
    if (!msg?.chat || msg.chat.type !== 'private' || !Array.isArray(msg.photo)) return;
    if (!isAdmin(msg)) return; // ota-onalar yuborgan rasmlar e'tiborsiz qoldiriladi

    const fileId = largestFileId(msg.photo);
    const caption = (msg.caption || '').trim();

    if (caption) {
      const ok = await assignPhoto(msg.chat.id, fileId, caption);
      if (ok) pending.delete(String(msg.from.id));
      else pending.set(String(msg.from.id), { fileId, at: Date.now() }); // aniqroq ismni keyingi xabarda yozsa bo'ladi
      return;
    }

    pending.set(String(msg.from.id), { fileId, at: Date.now() });
    await bot.sendMessage(
      msg.chat.id,
      '📷 <b>Bu kimning rasmi?</b>\n\n' +
        "O'quvchining ism-familiyasini yozing (masalan: <code>Aziz Karimov</code>).\n" +
        "Rasmga <i>reply</i> qilib yozsangiz ham bo'ladi.",
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    logger.error('[photos] xato', { error: err.message });
    try { await bot.sendMessage(msg.chat.id, `❌ Xato: ${err.message}`); } catch (_) { /* ignore */ }
  }
}

/** 2-usul: rasmga reply qilib ism.  3-usul: izohsiz rasmdan keyingi xabarda ism. */
async function onText(msg) {
  const { logger } = state;
  try {
    if (!msg?.chat || msg.chat.type !== 'private' || !isAdmin(msg)) return;
    const text = (msg.text || '').trim();
    if (!text || text.startsWith('/')) return;

    const adminId = String(msg.from.id);
    let fileId = null;

    const repliedPhoto = msg.reply_to_message && largestFileId(msg.reply_to_message.photo);
    if (repliedPhoto) {
      fileId = repliedPhoto;
    } else {
      const p = pending.get(adminId);
      if (p && Date.now() - p.at <= PENDING_MS) fileId = p.fileId;
      else if (p) pending.delete(adminId);
    }
    if (!fileId) return; // oddiy xabar — rasm bilan bog'liq emas

    const ok = await assignPhoto(msg.chat.id, fileId, text);
    if (ok) pending.delete(adminId);
    else pending.set(adminId, { fileId, at: Date.now() });
  } catch (err) {
    logger.error('[photos] ism xabari xato', { error: err.message });
  }
}

function register() {
  const { bot, prisma, logger } = state;

  bot.on('photo', onPhoto);
  bot.on('message', onText);

  // /rasmsiz — rasmi yo'q o'quvchilar (guruhlar bo'yicha)
  bot.onText(/^\/rasmsiz(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private' || !isAdmin(msg)) return;
    try {
      const students = await prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: { fullName: true, avatar: true, group: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
      });
      const missing = students.filter((s) => !avatar.isTelegramAvatar(s.avatar) && !/^(https?:|data:image\/)/.test(s.avatar || ''));
      if (missing.length === 0) {
        await bot.sendMessage(msg.chat.id, "🎉 Barcha faol o'quvchilarning rasmi bor!");
        return;
      }
      const byGroup = new Map();
      missing.forEach((s) => {
        const g = s.group?.name || 'Guruhsiz';
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(s.fullName);
      });
      let text = `📷 <b>Rasmi yo'q o'quvchilar: ${missing.length} / ${students.length}</b>\n`;
      for (const [g, names] of [...byGroup.entries()].sort()) {
        text += `\n<b>${escapeHtml(g)}</b>\n${names.map((n) => `• ${escapeHtml(n)}`).join('\n')}\n`;
      }
      text += "\n💡 Rasmni botga yuboring, izohiga o'quvchi ismini yozing.";
      // Telegram limiti — 4096 belgi; HTML teglar buzilmasligi uchun qatorlar bo'yicha bo'lamiz
      const chunks = [];
      let cur = '';
      for (const line of text.split('\n')) {
        if ((cur + line + '\n').length > 3800) { chunks.push(cur); cur = ''; }
        cur += `${line}\n`;
      }
      if (cur.trim()) chunks.push(cur);
      for (const c of chunks) {
        await bot.sendMessage(msg.chat.id, c, { parse_mode: 'HTML' });
      }
    } catch (err) {
      logger.error('[photos] /rasmsiz xato', { error: err.message });
    }
  });

  logger.info('[photos] Rasm yuklash yoqildi');
}

module.exports = { register, onPhoto, onText, assignPhoto };
