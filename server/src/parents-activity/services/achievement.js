'use strict';

const state = require('../state');

/**
 * O'quvchiga ball qo'shish — CRM'ning addAchievement mantig'i aynan takrorlangan:
 *   1) achievement yaratiladi (type = PARENT_ACTIVITY)
 *   2) student.totalPoints increment qilinadi
 * Ikkalasi bitta tranzaksiyada.
 *
 * @param {string} studentId
 * @param {number} points
 * @param {string} title
 * @param {string} [description]
 */
async function addParentActivityPoints({ studentId, points, title, description }) {
  const { prisma, logger } = state;

  try {
    const [achievement] = await prisma.$transaction([
      prisma.achievement.create({
        data: {
          studentId,
          type: 'PARENT_ACTIVITY', // enumda mavjud qiymat
          title,
          description: description || null,
          points: Number(points),
        },
      }),
      prisma.student.update({
        where: { id: studentId },
        data: { totalPoints: { increment: Number(points) } },
      }),
    ]);

    logger.info('[parents] Ball berildi', { studentId, points });
    return achievement;
  } catch (err) {
    logger.error('[parents] Ball berishda xato', { error: err.message, studentId });
    return null;
  }
}

module.exports = { addParentActivityPoints };
