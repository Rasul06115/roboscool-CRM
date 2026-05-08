const prisma = require('../config/prisma');
const smsService = require('../services/smsService');
const telegramService = require('../services/telegramService');

// Baholash nomlari (uz)
const RATING_LABELS = {
  POOR: 'Qoniqarsiz',
  AVERAGE: "O'rta",
  GOOD: 'Yaxshi',
  EXCELLENT: "A'lo",
};

const FIELD_LABELS = {
  teamwork: 'Jamoaviy ish',
  thinking: 'Fikrlash',
  behavior: 'Xulq',
  mastery: "O'zlashtirish",
  creativity: 'Kreativ fikrlash',
  decisionMaking: 'Tezkor qaror',
  independence: 'Mustaqillik',
};

// Daraja aniqlash
const getLevel = (points) => {
  const levels = [
    { name: 'Beginner', emoji: '🟢', min: 0, max: 50 },
    { name: 'Junior', emoji: '🔵', min: 51, max: 150 },
    { name: 'Middle', emoji: '🟡', min: 151, max: 300 },
    { name: 'Senior', emoji: '🟠', min: 301, max: 500 },
    { name: 'Master', emoji: '🔴', min: 501, max: Infinity },
  ];
  return levels.find(l => points >= l.min && points <= l.max) || levels[0];
};

// ==================== BAHOLASH CRUD ====================

// O'quvchini baholash (yaratish/yangilash)
exports.upsertEvaluation = async (req, res, next) => {
  try {
    const { studentId, period, teamwork, thinking, behavior, mastery, creativity, decisionMaking, independence, note, sendSms } = req.body;

    if (!studentId || !period) {
      return res.status(400).json({ success: false, error: "studentId va period talab qilinadi" });
    }

    const evaluation = await prisma.studentEvaluation.upsert({
      where: { studentId_period: { studentId, period } },
      update: { teamwork, thinking, behavior, mastery, creativity, decisionMaking, independence, note },
      create: { studentId, period, teamwork, thinking, behavior, mastery, creativity, decisionMaking, independence, note },
      include: { student: { include: { group: { include: { course: true } } } } },
    });

    // SMS yuborish
    if (sendSms && evaluation.student) {
      const s = evaluation.student;
      const level = getLevel(s.totalPoints);

      // Eskiz.uz uchun SMS shablon (moderatsiyadan o'tkaziladigan)
      const message = `RoboSchool: Hurmatli ota-ona! ${s.fullName} ning ${period} oyi natijalari: ` +
        `Jamoaviy ish: ${RATING_LABELS[teamwork]}, ` +
        `Xulq: ${RATING_LABELS[behavior]}, ` +
        `O'zlashtirish: ${RATING_LABELS[mastery]}. ` +
        `Daraja: ${level.name} (${s.totalPoints} ball). ` +
        `Batafsil: Telegram botimizga yozing.`;

      const result = await smsService.sendSms(s.parentPhone, message);
      if (result.success) {
        await prisma.studentEvaluation.update({
          where: { id: evaluation.id },
          data: { smsSent: true },
        });
      }

      // Telegram admin bildirishnoma
      telegramService.notifyAdmin(
        `📊 *Baholash saqlandi*\n\n` +
        `👤 ${s.fullName}\n` +
        `📚 ${s.group?.course?.name || '—'} (${s.group?.name || '—'})\n` +
        `📅 Davr: ${period}\n` +
        `⭐ Daraja: ${level.emoji} ${level.name}\n` +
        `📱 SMS: ${result.success ? '✅' : '❌'}`
      );
    }

    res.json({ success: true, data: evaluation });
  } catch (err) { next(err); }
};

// O'quvchining baholashlari
exports.getStudentEvaluations = async (req, res, next) => {
  try {
    const evaluations = await prisma.studentEvaluation.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { period: 'desc' },
      take: 12,
    });
    res.json({ success: true, data: evaluations });
  } catch (err) { next(err); }
};

// Guruh bo'yicha baholashlar (bir oy uchun)
exports.getGroupEvaluations = async (req, res, next) => {
  try {
    const { groupId, period } = req.query;
    if (!groupId || !period) {
      return res.status(400).json({ success: false, error: "groupId va period talab qilinadi" });
    }

    const students = await prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        evaluations: { where: { period } },
      },
      orderBy: { fullName: 'asc' },
    });

    const data = students.map(s => ({
      studentId: s.id,
      fullName: s.fullName,
      totalPoints: s.totalPoints,
      level: getLevel(s.totalPoints),
      evaluation: s.evaluations[0] || null,
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ==================== SMS SHABLONLAR ====================

// Ota-onaga ball haqida SMS
exports.sendPointsSms = async (req, res, next) => {
  try {
    const { studentId, points, title } = req.body;
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });

    const level = getLevel(student.totalPoints);
    const message = `RoboSchool: Hurmatli ota-ona! Farzandingiz ${student.fullName} bugungi darsda "${title}" uchun ${points} ball qo'lga kiritdi. Jami: ${student.totalPoints} ball (${level.emoji} ${level.name}). Zo'r natija!`;

    const result = await smsService.sendSms(student.parentPhone, message);
    res.json({ success: true, data: { sent: result.success } });
  } catch (err) { next(err); }
};

// Telegram guruhga kirish eslatmasi
exports.sendGroupJoinSms = async (req, res, next) => {
  try {
    const { studentId, telegramGroupLink } = req.body;
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });

    const message = `RoboSchool: Hurmatli ota-ona! Farzandingiz ${student.fullName} uchun muhim xabarlar Telegram guruhda beriladi. Guruhga kiring: ${telegramGroupLink}. Izoh qoldiring: "Kirdim".`;

    const result = await smsService.sendSms(student.parentPhone, message);
    res.json({ success: true, data: { sent: result.success } });
  } catch (err) { next(err); }
};

// Ommaviy SMS (guruh bo'yicha)
exports.sendBulkSms = async (req, res, next) => {
  try {
    const { groupId, template, customMessage } = req.body;

    const students = await prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: { group: { include: { course: true } } },
    });

    let sentCount = 0;
    for (const s of students) {
      const level = getLevel(s.totalPoints);
      let message;

      switch (template) {
        case 'TELEGRAM_JOIN':
          message = `RoboSchool: Hurmatli ota-ona! ${s.fullName} uchun Telegram guruhga kiring. Tezkor xabarlar bor. Izoh qoldiring: "${s.fullName} otasi/onasi".`;
          break;
        case 'PAYMENT_REMINDER':
          message = `RoboSchool: Hurmatli ota-ona! ${s.fullName} ning ${s.group?.course?.name || ''} kursi uchun to'lov muddati yaqinlashdi. Iltimos, to'lovni amalga oshiring.`;
          break;
        case 'MONTHLY_REPORT':
          message = `RoboSchool: Hurmatli ota-ona! ${s.fullName} ning oylik natijalari: ${s.totalPoints} ball, daraja: ${level.emoji} ${level.name}. Batafsil: botga yozing.`;
          break;
        case 'CUSTOM':
          message = `RoboSchool: ${customMessage.replace('{ism}', s.fullName).replace('{ball}', s.totalPoints).replace('{daraja}', level.name)}`;
          break;
        default:
          message = `RoboSchool: Hurmatli ota-ona! ${s.fullName} haqida muhim xabar bor. Batafsil: Telegram botimizga yozing.`;
      }

      const result = await smsService.sendSms(s.parentPhone, message);
      if (result.success) sentCount++;
    }

    res.json({ success: true, data: { total: students.length, sent: sentCount } });
  } catch (err) { next(err); }
};