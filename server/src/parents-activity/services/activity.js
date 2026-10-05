'use strict';

const state = require('../state');
const { currentWeekStart } = require('../utils/time');

async function recordMessage({ telegramId, chatId, sentAt }) {
  const { prisma, logger } = state;
  const weekStart = currentWeekStart(sentAt);
  const tid = String(telegramId);
  const cid = String(chatId);

  try {
    await prisma.parentGroupActivity.upsert({
      where: {
        telegramId_chatId_weekStart: { telegramId: tid, chatId: cid, weekStart },
      },
      create: {
        telegramId: tid,
        chatId: cid,
        weekStart,
        messageCount: 1,
        lastMessageAt: sentAt,
      },
      update: {
        messageCount: { increment: 1 },
        lastMessageAt: sentAt,
      },
    });
  } catch (err) {
    logger.error('[parents] Aktivlik yozilmadi', {
      error: err.message,
      telegramId: tid,
      chatId: cid,
    });
  }
}

async function getActiveParents(weekStart, minMessages) {
  const { prisma } = state;
  return prisma.parentGroupActivity.findMany({
    where: {
      weekStart,
      messageCount: { gte: minMessages },
      rewarded: false,
    },
  });
}

/**
 * Guruhda o'tgan hafta xabar yozmagan ota-onalar (bog'langanlar ichidan).
 */
async function getInactiveTelegramIdsForGroup(chatId, weekStart, candidateTelegramIds) {
  const { prisma } = state;
  const cid = String(chatId);

  const activities = await prisma.parentGroupActivity.findMany({
    where: { chatId: cid, weekStart },
    select: { telegramId: true, messageCount: true },
  });

  const activeSet = new Set(
    activities.filter((a) => a.messageCount > 0).map((a) => a.telegramId)
  );

  return candidateTelegramIds.filter((tid) => !activeSet.has(String(tid)));
}

async function markRewarded(id) {
  const { prisma } = state;
  await prisma.parentGroupActivity.update({
    where: { id },
    data: { rewarded: true },
  });
}

async function markReminded({ telegramId, chatId, weekStart }) {
  const { prisma } = state;
  const tid = String(telegramId);
  const cid = String(chatId);
  await prisma.parentGroupActivity.upsert({
    where: {
      telegramId_chatId_weekStart: { telegramId: tid, chatId: cid, weekStart },
    },
    create: {
      telegramId: tid,
      chatId: cid,
      weekStart,
      messageCount: 0,
      lastMessageAt: new Date(0),
      reminded: true,
    },
    update: { reminded: true },
  });
}

// ==================== REPLY UCHUN: ota-onaning oxirgi xabari ====================

/** Ota-onaning guruhdagi oxirgi xabarini eslab qolish (eslatma/tashakkur shunga reply qilinadi). */
async function rememberLastMessage({ telegramId, chatId, messageId }) {
  const { prisma } = state;
  if (!messageId) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "parent_last_messages" ("telegram_id", "chat_id", "message_id", "sent_at")
      VALUES (${String(telegramId)}, ${String(chatId)}, ${Number(messageId)}::int, NOW())
      ON CONFLICT ("telegram_id", "chat_id") DO UPDATE
        SET "message_id" = EXCLUDED."message_id", "sent_at" = NOW()
    `;
  } catch (_) { /* jadval yo'q bo'lsa — reply'siz ishlayveradi */ }
}

/** Oxirgi xabar ID si (yo'q bo'lsa — null). */
async function lastMessageId(telegramId, chatId) {
  const { prisma } = state;
  try {
    const rows = await prisma.$queryRaw`
      SELECT "message_id" FROM "parent_last_messages"
      WHERE "telegram_id" = ${String(telegramId)} AND "chat_id" = ${String(chatId)}
      LIMIT 1
    `;
    return rows[0] ? Number(rows[0].message_id) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Eslatma nomzodlari (bitta guruh uchun):
 *   - oxirgi 60 kunda shu guruhda faol bo'lgan har kim (xabar, izoh, reaksiya),
 *   - VA telefon orqali ulangan ota-onalar (guruh a'zoligi keyinroq tekshiriladi);
 * Natija: o'tgan hafta faolligi chegaradan (default 5) KAM bo'lganlar, o'tgan hafta soni bilan.
 * O'quvchilarning o'zlari (students.telegram_id) chiqarib tashlanadi.
 */
async function getReminderCandidates(chatId, weekStart, minMessages) {
  const { prisma } = state;
  const cid = String(chatId);
  const ws = weekStart.toISOString().slice(0, 10);
  const rows = await prisma.$queryRaw`
    WITH seen AS (
      SELECT DISTINCT "telegram_id" FROM "parent_group_activity"
      WHERE "chat_id" = ${cid} AND "message_count" > 0
        AND "last_message_at" >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '60 days'
      UNION
      SELECT DISTINCT "telegram_id" FROM "parent_links"
    ),
    last_week AS (
      SELECT "telegram_id", "message_count" FROM "parent_group_activity"
      WHERE "chat_id" = ${cid} AND "week_start" = ${ws}::date
    )
    SELECT s."telegram_id" AS "telegramId", COALESCE(w."message_count", 0)::int AS "count",
           EXISTS (SELECT 1 FROM "parent_group_activity" a
                   WHERE a."chat_id" = ${cid} AND a."telegram_id" = s."telegram_id" AND a."message_count" > 0) AS "seenHere"
    FROM seen s
    LEFT JOIN last_week w ON w."telegram_id" = s."telegram_id"
    WHERE COALESCE(w."message_count", 0) < ${Number(minMessages)}::int
      AND s."telegram_id" ~ '^[0-9]+$'
      AND NOT EXISTS (SELECT 1 FROM "students" st WHERE st."telegram_id" = s."telegram_id")
    ORDER BY "count" DESC
  `;
  return rows.map((r) => ({ telegramId: String(r.telegramId), count: Number(r.count), seenHere: Boolean(r.seenHere) }));
}

async function getGroupChatIds() {
  const { prisma } = state;
  const groups = await prisma.parentGroupActivity.groupBy({ by: ['chatId'] });
  return groups.map((g) => g.chatId);
}

module.exports = {
  recordMessage,
  getActiveParents,
  getInactiveTelegramIdsForGroup,
  markRewarded,
  markReminded,
  getGroupChatIds,
  rememberLastMessage,
  lastMessageId,
  getReminderCandidates,
};
