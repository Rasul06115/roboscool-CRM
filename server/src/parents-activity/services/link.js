'use strict';

const state = require('../state');
const config = require('../config');

/**
 * Matndan o'quvchilarni qidirish — CRM botidagi mavjud mantiqning aynan nusxasi
 * (ACTIVE, avval AND, keyin OR, fullName ustida contains/insensitive).
 * Hech qanday javob yubormaydi — faqat qidiradi.
 */
async function searchStudentsByText(text) {
  const { prisma, logger } = state;
  const words = String(text).split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  let students = [];
  try {
    students = await prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        AND: words.map((w) => ({ fullName: { contains: w, mode: 'insensitive' } })),
      },
      select: { id: true, fullName: true },
    });
  } catch (e) {
    logger.debug('[parents] link search AND', { error: e.message });
  }

  if (students.length === 0) {
    try {
      students = await prisma.student.findMany({
        where: {
          status: 'ACTIVE',
          OR: words.map((w) => ({ fullName: { contains: w, mode: 'insensitive' } })),
        },
        select: { id: true, fullName: true },
      });
    } catch (e) {
      logger.debug('[parents] link search OR', { error: e.message });
    }
  }

  return students;
}

/**
 * Ota-onaning matn qidiruvidan avtomatik bog'lash.
 * Faqat 1..autoLinkMaxStudents ta natija bo'lsa bog'laydi (noto'g'ri bog'lanishning oldini olish).
 */
async function autoLinkFromLookup(telegramId, text) {
  const { prisma, logger } = state;
  const students = await searchStudentsByText(text);
  if (students.length === 0 || students.length > config.autoLinkMaxStudents) return 0;

  const tid = String(telegramId);
  let linked = 0;

  for (const s of students) {
    try {
      await prisma.parentLink.upsert({
        where: { telegramId_studentId: { telegramId: tid, studentId: s.id } },
        create: {
          telegramId: tid,
          studentId: s.id,
          studentName: s.fullName,
          linkedVia: 'auto_lookup',
        },
        update: { studentName: s.fullName },
      });
      linked += 1;
    } catch (e) {
      logger.debug('[parents] autoLink upsert', { error: e.message });
    }
  }

  if (linked > 0) {
    logger.info('[parents] Avtomatik bog\'landi', {
      telegramId: tid,
      count: linked,
    });
  }
  return linked;
}

/**
 * Ota-onaga bog'langan (mavjud, ACTIVE) o'quvchilarni qaytaradi.
 */
async function getLinkedStudents(telegramId) {
  const { prisma } = state;
  const links = await prisma.parentLink.findMany({
    where: { telegramId: String(telegramId) },
    select: { studentId: true },
  });
  if (links.length === 0) return [];

  const ids = links.map((l) => l.studentId);
  return prisma.student.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    select: { id: true, fullName: true, totalPoints: true, parentPhone: true },
  });
}

/**
 * Admin qo'lda bog'laydi.
 */
async function manualLink(telegramId, fullNameQuery) {
  const { prisma } = state;
  const students = await searchStudentsByText(fullNameQuery);
  if (students.length === 0) return { ok: false, reason: 'not_found', students: [] };
  if (students.length > 1) return { ok: false, reason: 'ambiguous', students };

  const s = students[0];
  await prisma.parentLink.upsert({
    where: { telegramId_studentId: { telegramId: String(telegramId), studentId: s.id } },
    create: {
      telegramId: String(telegramId),
      studentId: s.id,
      studentName: s.fullName,
      linkedVia: 'manual',
    },
    update: { studentName: s.fullName, linkedVia: 'manual' },
  });

  return { ok: true, student: s };
}

async function unlinkAll(telegramId) {
  const { prisma } = state;
  const res = await prisma.parentLink.deleteMany({
    where: { telegramId: String(telegramId) },
  });
  return res.count;
}

async function listLinks(limit = 50) {
  const { prisma } = state;
  return prisma.parentLink.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

module.exports = {
  searchStudentsByText,
  autoLinkFromLookup,
  getLinkedStudents,
  manualLink,
  unlinkAll,
  listLinks,
};
