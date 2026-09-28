'use strict';

/**
 * Telefon raqam orqali ota-ona ↔ farzand bog'lash.
 *
 * Telegram "contact" xabaridagi raqam Telegram tomonidan tasdiqlangan bo'ladi
 * (faqat o'z raqamini yubora oladi). U CRM'dagi o'quvchining
 * parent_phone / father_phone / mother_phone raqamlari bilan solishtiriladi.
 * Raqam formati farq qilsa ham (+998 90 111 22 33, 901112233 ...) —
 * oxirgi 9 raqam solishtiriladi.
 */

const prisma = require('../../config/prisma');

function last9(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/** Shu raqamga mos faol o'quvchilar (aka-uka/opa-singillar ham). */
async function findStudentsByPhone(phone) {
  const key = last9(phone);
  if (!key) return [];
  const rows = await prisma.$queryRaw`
    SELECT "id", "full_name" AS "fullName"
    FROM "students"
    WHERE "status" = 'ACTIVE'
      AND (
        right(regexp_replace(coalesce("parent_phone", ''), '\\D', '', 'g'), 9) = ${key}
        OR right(regexp_replace(coalesce("father_phone", ''), '\\D', '', 'g'), 9) = ${key}
        OR right(regexp_replace(coalesce("mother_phone", ''), '\\D', '', 'g'), 9) = ${key}
      )
    ORDER BY "full_name"
  `;
  return rows;
}

/**
 * Raqamni tekshirib, topilgan o'quvchilarni shu Telegram akkauntga bog'laydi.
 * @returns {Promise<Array<{id:string, fullName:string}>>}
 */
async function linkByPhone(telegramId, phone) {
  const students = await findStudentsByPhone(phone);
  const tid = String(telegramId);
  for (const s of students) {
    await prisma.parentLink.upsert({
      where: { telegramId_studentId: { telegramId: tid, studentId: s.id } },
      create: { telegramId: tid, studentId: s.id, studentName: s.fullName, linkedVia: 'phone' },
      update: { studentName: s.fullName, linkedVia: 'phone' },
    });
  }
  return students;
}

async function countLinks(telegramId) {
  return prisma.parentLink.count({ where: { telegramId: String(telegramId) } });
}

module.exports = { last9, findStudentsByPhone, linkByPhone, countLinks };
