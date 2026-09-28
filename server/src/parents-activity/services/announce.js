'use strict';

/**
 * Guruhga yutuq e'loni.
 *
 * CRM'da o'quvchiga katta ball (default: 5+) berilganda, o'quvchining
 * CRM guruhiga ulangan Telegram guruhga rasm bilan tabrik yuboriladi.
 *
 * CRM kodiga tegilmaydi: bot har daqiqada yangi yutuqlarni o'zi tekshiradi.
 * Har bir yutuq faqat BIR MARTA e'lon qilinadi (announced_achievements jadvali).
 * Jazo (PENALTY) va ota-ona faolligi (PARENT_ACTIVITY) e'lon qilinmaydi.
 */

const prisma = require('../../config/prisma');
const state = require('../state');
const config = require('../config');
const avatar = require('./avatar');
const { levelInfo } = require('./cabinet');
const { escapeHtml } = require('./notification');

const BOOT_TIME = Date.now();
const LOOKBACK_MS = 2 * 60 * 60 * 1000; // 2 soat

// ==================== GURUH ↔ TELEGRAM ====================

/** CRM guruhini nomi bo'yicha topish (aniq moslik ustun). */
async function findCrmGroups(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const groups = await prisma.group.findMany({
    where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 10,
  });
  const exact = groups.filter((g) => g.name.trim().toLowerCase() === q.toLowerCase());
  return exact.length === 1 ? exact : groups;
}

async function listCrmGroups() {
  return prisma.group.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function linkChat({ chatId, chatTitle, group }) {
  await prisma.$executeRaw`
    INSERT INTO "group_chats" ("chat_id", "group_id", "group_name", "chat_title", "linked_at")
    VALUES (${String(chatId)}, ${group.id}, ${group.name}, ${chatTitle || null}, NOW())
    ON CONFLICT ("chat_id") DO UPDATE
      SET "group_id" = EXCLUDED."group_id",
          "group_name" = EXCLUDED."group_name",
          "chat_title" = EXCLUDED."chat_title",
          "linked_at" = NOW()
  `;
}

async function unlinkChat(chatId) {
  return prisma.$executeRaw`DELETE FROM "group_chats" WHERE "chat_id" = ${String(chatId)}`;
}

async function listLinkedChats() {
  return prisma.$queryRaw`
    SELECT "chat_id" AS "chatId", "group_name" AS "groupName", "chat_title" AS "chatTitle"
    FROM "group_chats" ORDER BY "group_name"
  `;
}

// ==================== E'LON ====================

function caption({ fullName, title, points, totalPoints }) {
  const lvl = levelInfo(totalPoints);
  return (
    `🎉 <b>Tabriklaymiz!</b>\n\n` +
    `👤 <b>${escapeHtml(fullName)}</b>\n` +
    `🏆 ${escapeHtml(title || 'Yutuq')}\n` +
    `⭐ <b>+${points} ball</b> — jami ${totalPoints} ball (${lvl.emoji} ${lvl.name})\n\n` +
    `Barakalla, shunday davom et! 💪`
  );
}

/** Yangi yutuqlarni topib, guruhlarga e'lon qiladi. */
async function runAnnouncements() {
  const { bot, logger } = state;
  if (!bot) return { announced: 0 };

  // Prisma created_at ni UTC da saqlaydi (vaqt mintaqasisiz ustun) — sanani aniq UTC qilib beramiz
  const since = new Date(Math.max(Date.now() - LOOKBACK_MS, BOOT_TIME - 10 * 60 * 1000));
  const minPoints = config.announceMinPoints;

  const rows = await prisma.$queryRaw`
    SELECT a."id", a."title", a."points",
           s."full_name" AS "fullName", s."avatar", s."total_points" AS "totalPoints", s."group_id" AS "groupId"
    FROM "achievements" a
    JOIN "students" s ON s."id" = a."student_id"
    LEFT JOIN "announced_achievements" x ON x."achievement_id" = a."id"
    WHERE a."created_at" >= (${since.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND a."points" >= ${minPoints}::int
      AND a."type"::text NOT IN ('PENALTY', 'PARENT_ACTIVITY')
      AND s."status"::text = 'ACTIVE'
      AND x."achievement_id" IS NULL
    ORDER BY a."created_at" ASC
    LIMIT 20
  `;

  let announced = 0;
  for (const r of rows) {
    // Avval "band qilamiz" — ikki marta e'lon bo'lmasligi uchun
    const claimed = await prisma.$queryRaw`
      INSERT INTO "announced_achievements" ("achievement_id") VALUES (${r.id})
      ON CONFLICT DO NOTHING RETURNING "achievement_id"
    `;
    if (!claimed.length) continue;

    if (!r.groupId) continue;
    const chats = await prisma.$queryRaw`
      SELECT "chat_id" AS "chatId" FROM "group_chats" WHERE "group_id" = ${r.groupId}
    `;
    if (!chats.length) continue;

    const text = caption({ ...r, points: Number(r.points), totalPoints: Number(r.totalPoints) });
    const fileId = avatar.fileIdOf(r.avatar);

    for (const c of chats) {
      try {
        if (fileId) {
          await bot.sendPhoto(c.chatId, fileId, { caption: text, parse_mode: 'HTML' });
        } else {
          await bot.sendMessage(c.chatId, text, { parse_mode: 'HTML' });
        }
        announced += 1;
      } catch (err) {
        logger.warn('[announce] yuborilmadi', { chatId: c.chatId, error: err.message });
      }
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  if (announced) logger.info('[announce] e\'lon qilindi', { announced });
  return { announced };
}

module.exports = {
  findCrmGroups,
  listCrmGroups,
  linkChat,
  unlinkChat,
  listLinkedChats,
  runAnnouncements,
  caption,
};
