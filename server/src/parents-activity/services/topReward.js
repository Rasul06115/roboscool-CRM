'use strict';

/**
 * Oylik TOP-N (default 5) o'quvchilar va keyingi oyga chegirma.
 *
 * - Ball hisoblash CRM Dashboard'dagi "Oyning eng yaxshi o'quvchisi" bilan bir xil:
 *   oy ichida olingan MUSBAT ballar yig'indisi, faqat ACTIVE o'quvchilar.
 * - Oy chegaralari Toshkent vaqti bo'yicha.
 * - Natija `monthly_discounts` jadvaliga yoziladi (raw SQL — Prisma schema o'zgarmaydi).
 * - Bir oy uchun qayta ishga tushirilsa, takroriy yozuv va takroriy xabar bo'lmaydi.
 */

const crypto = require('crypto');
const prisma = require('../../config/prisma');
const logger = require('../../config/logger');
const state = require('../state');
const config = require('../config');
const {
  isValidPeriod,
  previousPeriod,
  shiftPeriod,
  periodRange,
  periodLabel,
  monthName,
} = require('../utils/time');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Berilgan oy uchun reyting (TOP limit + tenglikni aniqlash uchun bitta ortiqcha).
 * @returns {Promise<{ top: Array, next: Object|null }>}
 */
async function computeRanking(period, limit = config.topCount) {
  const { start, end } = periodRange(period);

  const grouped = await prisma.achievement.groupBy({
    by: ['studentId'],
    where: { createdAt: { gte: start, lt: end }, points: { gt: 0 } },
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: limit * 4, // faol bo'lmaganlar chiqib ketsa ham yetarli bo'lsin
  });

  if (grouped.length === 0) return { top: [], next: null };

  const students = await prisma.student.findMany({
    where: { id: { in: grouped.map((g) => g.studentId) }, status: 'ACTIVE' },
    select: { id: true, fullName: true, group: { select: { name: true } } },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  const ranked = grouped
    .filter((g) => byId.has(g.studentId))
    .map((g) => {
      const s = byId.get(g.studentId);
      return {
        studentId: s.id,
        fullName: s.fullName,
        groupName: s.group?.name || null,
        points: Number(g._sum.points) || 0,
      };
    });

  const top = ranked.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  const next = ranked[limit] || null;
  return { top, next };
}

/** O'quvchiga bog'langan ota-onalarning Telegram ID lari. */
async function getParentTelegramIds(studentId) {
  const links = await prisma.parentLink.findMany({
    where: { studentId },
    select: { telegramId: true },
  });
  return [...new Set(links.map((l) => l.telegramId))];
}

function parentMessage({ fullName, rank, points, period, validMonth, percent }) {
  return (
    `🎉 <b>Tabriklaymiz!</b>\n\n` +
    `Farzandingiz <b>${escapeHtml(fullName)}</b> ${monthName(period)} oyida ` +
    `Roboschool o'quv markazi bo'yicha eng ko'p ball to'plagan ` +
    `<b>TOP-${config.topCount}</b> o'quvchi qatoridan joy oldi! 🏆\n\n` +
    `${MEDALS[rank - 1] || '🏅'} O'rin: <b>${rank}</b>\n` +
    `⭐ To'plangan ball: <b>${points}</b>\n\n` +
    `🎁 Mukofot: <b>${monthName(validMonth)}</b> oyi uchun to'lovga ` +
    `<b>${percent}% chegirma</b>!\n\n` +
    `Chegirma to'lov vaqtida qo'llaniladi. ` +
    `Farzandingizga yangi zafarlar tilaymiz! 💪\n\n` +
    `<i>Roboschool o'quv markazi</i> 🤖📚`
  );
}

async function sendDM(chatId, text) {
  const { bot } = state;
  if (!bot) return false;
  try {
    await bot.sendMessage(String(chatId), text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    try {
      await prisma.parentBotNotification.create({
        data: { telegramId: String(chatId), chatId: String(chatId), type: 'TOP_DISCOUNT' },
      });
    } catch (_) { /* log jadvali ixtiyoriy */ }
    return true;
  } catch (err) {
    logger.warn('[top5] Xabar yuborilmadi', { chatId: String(chatId), error: err.message });
    return false;
  }
}

/**
 * Oyning TOP-N ni aniqlab, jadvalga yozadi va ota-onalarga xabar yuboradi.
 * @param {string} [period] "YYYY-MM" — default: o'tgan oy (Toshkent)
 */
async function runMonthlyTop(period) {
  const p = period && isValidPeriod(period) ? period : previousPeriod();
  const validMonth = shiftPeriod(p, 1);
  const percent = config.topDiscountPercent;

  logger.info('[top5] Oylik TOP hisoblanmoqda', { period: p });
  const { top, next } = await computeRanking(p);

  const result = {
    period: p,
    validMonth,
    winners: [],
    created: 0,
    alreadyExisted: 0,
    notified: 0,
    unlinked: [],
    tieWarning: null,
  };

  if (top.length === 0) {
    logger.info('[top5] Bu oyda ball berilmagan', { period: p });
    return result;
  }

  const last = top[top.length - 1];
  if (next && next.points === last.points) {
    result.tieWarning =
      `${last.rank}-o'rin (${last.fullName}) va keyingi o'quvchi (${next.fullName}) ` +
      `ballari teng: ${last.points}. Qo'lda tekshiring.`;
  }

  for (const w of top) {
    // Takrorlanmas yozuv: (student_id, period) unique
    const inserted = await prisma.$queryRaw`
      INSERT INTO "monthly_discounts"
        ("id", "student_id", "student_name", "group_name", "period", "valid_month",
         "rank", "points", "discount_percent")
      VALUES
        (${crypto.randomUUID()}, ${w.studentId}, ${w.fullName}, ${w.groupName}::text, ${p}, ${validMonth},
         ${w.rank}::int, ${w.points}::int, ${percent}::int)
      ON CONFLICT ("student_id", "period") DO NOTHING
      RETURNING "id"
    `;

    const isNew = Array.isArray(inserted) && inserted.length > 0;
    result.winners.push({ ...w, isNew });

    if (!isNew) {
      result.alreadyExisted += 1;
      continue; // oldin xabar yuborilgan — qayta yubormaymiz
    }
    result.created += 1;

    const parentIds = await getParentTelegramIds(w.studentId);
    if (parentIds.length === 0) {
      result.unlinked.push(w.fullName);
      continue;
    }

    let sentCount = 0;
    for (const tid of parentIds) {
      const ok = await sendDM(
        tid,
        parentMessage({ ...w, period: p, validMonth, percent })
      );
      if (ok) sentCount += 1;
      await new Promise((r) => setTimeout(r, 120));
    }

    if (sentCount > 0) {
      await prisma.$executeRaw`
        UPDATE "monthly_discounts"
        SET "notified_count" = ${sentCount}::int, "notified_at" = NOW()
        WHERE "student_id" = ${w.studentId} AND "period" = ${p}
      `;
      result.notified += sentCount;
    } else {
      result.unlinked.push(w.fullName);
    }
  }

  await sendAdminReport(result);
  logger.info('[top5] Tugadi', {
    period: p,
    created: result.created,
    notified: result.notified,
  });
  return result;
}

async function sendAdminReport(r) {
  const { bot } = state;
  if (!bot) return;

  const lines = r.winners.map(
    (w) =>
      `${MEDALS[w.rank - 1] || w.rank + '.'} ${escapeHtml(w.fullName)} — ${w.points} ball` +
      (w.groupName ? ` <i>(${escapeHtml(w.groupName)})</i>` : '') +
      (w.isNew ? '' : ' • <i>oldin yozilgan</i>')
  );

  let text =
    `🏆 <b>${periodLabel(r.period)} — TOP-${config.topCount}</b>\n` +
    `🎁 ${monthName(r.validMonth)} oyiga ${config.topDiscountPercent}% chegirma:\n\n` +
    `${lines.join('\n')}\n\n` +
    `✉️ Ota-onalarga yuborildi: <b>${r.notified}</b>`;

  if (r.unlinked.length > 0) {
    text +=
      `\n\n⚠️ Ota-onasi botga bog'lanmagan (qo'lda xabar bering):\n` +
      r.unlinked.map((n) => `• ${escapeHtml(n)}`).join('\n');
  }
  if (r.tieWarning) {
    text += `\n\n⚖️ ${escapeHtml(r.tieWarning)}`;
  }
  text += `\n\n💡 Chegirma to'lov paytida qo'lda qo'llaniladi. CRM Boshqaruv sahifasida belgilab boring.`;

  try {
    await bot.sendMessage(String(config.adminChatId), text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (err) {
    logger.warn('[top5] Admin hisoboti yuborilmadi', { error: err.message });
  }
}

// ==================== CRM API uchun ====================

async function listDiscounts(validMonth) {
  const rows = await prisma.$queryRaw`
    SELECT "id", "student_id", "student_name", "group_name", "period", "valid_month",
           "rank", "points", "discount_percent", "notified_count", "notified_at",
           "applied", "applied_at", "created_at"
    FROM "monthly_discounts"
    WHERE "valid_month" = ${validMonth}
    ORDER BY "rank" ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    groupName: r.group_name,
    period: r.period,
    periodLabel: periodLabel(r.period),
    validMonth: r.valid_month,
    validMonthLabel: periodLabel(r.valid_month),
    rank: Number(r.rank),
    points: Number(r.points),
    discountPercent: Number(r.discount_percent),
    notifiedCount: Number(r.notified_count),
    notifiedAt: r.notified_at,
    applied: Boolean(r.applied),
    appliedAt: r.applied_at,
  }));
}

async function setApplied(id, applied) {
  const count = await prisma.$executeRaw`
    UPDATE "monthly_discounts"
    SET "applied" = ${Boolean(applied)}::boolean,
        "applied_at" = CASE WHEN ${Boolean(applied)}::boolean THEN NOW() ELSE NULL END
    WHERE "id" = ${String(id)}
  `;
  return count > 0;
}

module.exports = {
  computeRanking,
  runMonthlyTop,
  listDiscounts,
  setApplied,
  MEDALS,
};
