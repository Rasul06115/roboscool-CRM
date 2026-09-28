'use strict';

/**
 * O'quvchi rasmini bot orqali yuklash (faqat admin).
 *
 *  1) Telefonda o'quvchini rasmga oling
 *  2) Botga shaxsiy chatda rasmni yuboring, IZOHIGA o'quvchi ismini yozing
 *     (masalan: "Aziz Karimov")
 *  3) Bot o'quvchini topib, rasmni saqlaydi
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

async function onPhoto(msg) {
  const { bot, prisma, logger } = state;
  try {
    if (!msg?.chat || msg.chat.type !== 'private' || !Array.isArray(msg.photo)) return;
    if (!isAdmin(msg)) return; // ota-onalar yuborgan rasmlar e'tiborsiz qoldiriladi

    const caption = (msg.caption || '').trim();
    if (!caption) {
      await bot.sendMessage(
        msg.chat.id,
        "📷 Rasm qabul qilindi, lekin <b>izoh yo'q</b>.\n\n" +
          "Rasmni qayta yuboring va izohiga o'quvchining ismini yozing, masalan: <code>Aziz Karimov</code>",
        { parse_mode: 'HTML' }
      );
      return;
    }

    const found = await findStudents(caption);
    if (found.length === 0) {
      await bot.sendMessage(msg.chat.id, `❌ "${escapeHtml(caption)}" — faol o'quvchi topilmadi.`, { parse_mode: 'HTML' });
      return;
    }
    if (found.length > 1) {
      const list = found.slice(0, 10).map((s) => `• ${escapeHtml(s.fullName)} <i>(${escapeHtml(s.group?.name || '—')})</i>`).join('\n');
      await bot.sendMessage(
        msg.chat.id,
        `⚠️ Bir nechta o'quvchi topildi — izohga <b>to'liq ism-familiya</b> yozib qayta yuboring:\n\n${list}`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const student = found[0];
    const biggest = msg.photo[msg.photo.length - 1]; // eng katta o'lcham
    const value = `${avatar.PREFIX}${biggest.file_id}`;
    await prisma.student.update({ where: { id: student.id }, data: { avatar: value } });

    await bot.sendMessage(
      msg.chat.id,
      `✅ Rasm saqlandi: <b>${escapeHtml(student.fullName)}</b>` +
        (student.group?.name ? ` <i>(${escapeHtml(student.group.name)})</i>` : '') +
        (student.avatar ? '\n♻️ Oldingi rasm almashtirildi.' : '') +
        '\n\nEndi u kabinetda va guruhdagi e\'lonlarda ko\'rinadi.',
      { parse_mode: 'HTML' }
    );
    logger.info('[photos] Rasm saqlandi', { studentId: student.id });
  } catch (err) {
    logger.error('[photos] xato', { error: err.message });
    try { await state.bot.sendMessage(msg.chat.id, `❌ Xato: ${err.message}`); } catch (_) { /* ignore */ }
  }
}

function register() {
  const { bot, prisma, logger } = state;

  bot.on('photo', onPhoto);

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

module.exports = { register, onPhoto };
