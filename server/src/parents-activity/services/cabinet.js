'use strict';

/**
 * Telegram Mini App — o'quvchi shaxsiy kabineti uchun ma'lumotlar.
 *
 * Maxfiylik: ota-onaga faqat o'z farzandining o'quv ma'lumotlari beriladi.
 * Telefon raqamlari, balans va to'lovlar QAYTARILMAYDI.
 */

const prisma = require('../../config/prisma');
const {
  toTashkent,
  currentPeriod,
  shiftPeriod,
  periodRange,
  periodLabel,
} = require('../utils/time');

const LEVELS = [
  { name: 'Beginner', emoji: '🟢', min: 0, max: 50 },
  { name: 'Junior', emoji: '🔵', min: 51, max: 150 },
  { name: 'Middle', emoji: '🟡', min: 151, max: 300 },
  { name: 'Senior', emoji: '🟠', min: 301, max: 500 },
  { name: 'Master', emoji: '🔴', min: 501, max: Infinity },
];

// Baholash mezonlari — CRM'dagi EVALUATION_FIELDS bilan bir xil tartib
const EVAL_FIELDS = [
  { key: 'teamwork', label: 'Jamoaviy ish', icon: '🤝' },
  { key: 'thinking', label: 'Algoritmik fikrlash', icon: '🧩' },
  { key: 'behavior', label: 'Xulq', icon: '😊' },
  { key: 'mastery', label: "O'zlashtirish", icon: '📚' },
  { key: 'creativity', label: 'Kreativ fikrlash', icon: '💡' },
  { key: 'decisionMaking', label: 'Tezkor qaror', icon: '⚡' },
  { key: 'independence', label: 'Muammoni yechish', icon: '🔧' },
  { key: 'attention', label: 'Diqqat va aniqlik', icon: '🎯' },
  { key: 'initiative', label: 'Tashabbuskorlik', icon: '🚀' },
];

const RATING_SCORE = { POOR: 1, AVERAGE: 2, GOOD: 3, EXCELLENT: 4 };

// Grafik uchun qisqa oy nomlari (iyun/iyul farqlanadi)
const MONTH_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

const ACH_ICONS = {
  HOMEWORK: '📝',
  PROJECT: '🏆',
  ACTIVITY: '🙋',
  PARENT_ACTIVITY: '👨‍👩‍👦',
  CONTEST_WIN: '🥇',
  GOOD_BEHAVIOR: '⭐',
  ATTENDANCE_STREAK: '📅',
  PENALTY: '⛔',
  OTHER: '🎯',
};

function levelInfo(points) {
  const p = Number(points) || 0;
  const idx = Math.max(0, LEVELS.findIndex((l) => p >= l.min && p <= l.max));
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  let progress = 100;
  if (next) {
    const span = next.min - cur.min;
    progress = Math.max(0, Math.min(100, Math.round(((p - cur.min) / span) * 100)));
  }
  return {
    name: cur.name,
    emoji: cur.emoji,
    next: next ? { name: next.name, emoji: next.emoji, min: next.min } : null,
    remaining: next ? Math.max(0, next.min - p) : 0,
    progress,
  };
}

function initials(fullName) {
  return String(fullName || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Ro'yxat uchun qisqa ma'lumot. */
function summary(s) {
  return {
    id: s.id,
    fullName: s.fullName,
    initials: initials(s.fullName),
    avatar: s.avatar || null,
    groupName: s.group?.name || null,
    courseName: s.group?.course?.name || null,
    courseIcon: s.group?.course?.icon || '📚',
    totalPoints: s.totalPoints || 0,
    level: levelInfo(s.totalPoints),
  };
}

const SUMMARY_SELECT = {
  id: true,
  fullName: true,
  avatar: true,
  totalPoints: true,
  status: true,
  group: { select: { name: true, course: { select: { name: true, icon: true } } } },
};

/** Ota-onaga bog'langan faol o'quvchilar. */
async function getChildren(telegramId) {
  const links = await prisma.parentLink.findMany({
    where: { telegramId: String(telegramId) },
    select: { studentId: true },
  });
  if (links.length === 0) return [];
  const students = await prisma.student.findMany({
    where: { id: { in: links.map((l) => l.studentId) }, status: 'ACTIVE' },
    select: SUMMARY_SELECT,
    orderBy: { fullName: 'asc' },
  });
  return students.map(summary);
}

/** Ota-ona shu o'quvchini ko'rishga haqlimi. */
async function canView(telegramId, studentId) {
  const n = await prisma.parentLink.count({
    where: { telegramId: String(telegramId), studentId: String(studentId) },
  });
  return n > 0;
}

/** Admin uchun qidiruv. */
async function searchStudents(q) {
  const words = String(q || '').trim().split(/\s+/).filter((w) => w.length >= 2);
  const where = { status: 'ACTIVE' };
  if (words.length > 0) {
    where.AND = words.map((w) => ({ fullName: { contains: w, mode: 'insensitive' } }));
  }
  const students = await prisma.student.findMany({
    where,
    select: SUMMARY_SELECT,
    orderBy: words.length > 0 ? { fullName: 'asc' } : { totalPoints: 'desc' },
    take: 20,
  });
  return students.map(summary);
}

/** Oy ichidagi musbat ballar bo'yicha o'rin (TOP-5 chegirma bilan bir xil hisob). */
async function monthlyRank(studentId, period) {
  const { start, end } = periodRange(period);
  const grouped = await prisma.achievement.groupBy({
    by: ['studentId'],
    where: { createdAt: { gte: start, lt: end }, points: { gt: 0 } },
    _sum: { points: true },
  });
  if (grouped.length === 0) return { rank: null, total: 0, points: 0 };

  const active = await prisma.student.findMany({
    where: { id: { in: grouped.map((g) => g.studentId) }, status: 'ACTIVE' },
    select: { id: true },
  });
  const activeIds = new Set(active.map((a) => a.id));
  const list = grouped
    .filter((g) => activeIds.has(g.studentId))
    .map((g) => ({ id: g.studentId, points: Number(g._sum.points) || 0 }))
    .sort((a, b) => b.points - a.points);

  const mine = list.find((x) => x.id === studentId);
  if (!mine) return { rank: null, total: list.length, points: 0 };
  // Teng ball — bir xil o'rin
  const rank = list.filter((x) => x.points > mine.points).length + 1;
  return { rank, total: list.length, points: mine.points };
}

/** Shu o'quvchiga tegishli TOP chegirmalar (jadval bo'lmasa — bo'sh). */
async function getDiscounts(studentId) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT "period", "valid_month", "rank", "points", "discount_percent", "applied"
      FROM "monthly_discounts"
      WHERE "student_id" = ${studentId}
      ORDER BY "period" DESC
      LIMIT 6
    `;
    const nowPeriod = currentPeriod();
    return rows.map((r) => ({
      // Faqat joriy yoki kelgusi oy uchun amal qiladi
      current: String(r.valid_month) >= nowPeriod,
      period: r.period,
      periodLabel: periodLabel(r.period),
      validMonth: r.valid_month,
      validMonthLabel: periodLabel(r.valid_month),
      rank: Number(r.rank),
      points: Number(r.points),
      percent: Number(r.discount_percent),
      applied: Boolean(r.applied),
    }));
  } catch (_) {
    return [];
  }
}

function shapeEvaluation(ev) {
  if (!ev) return null;
  return {
    period: ev.period,
    periodLabel: /^\d{4}-\d{2}$/.test(ev.period) ? periodLabel(ev.period) : ev.period,
    note: ev.note || null,
    items: EVAL_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      icon: f.icon,
      rating: ev[f.key] || 'AVERAGE',
      score: RATING_SCORE[ev[f.key]] || 2,
    })),
  };
}

/** Kabinet uchun to'liq profil. */
async function getProfile(studentId) {
  const s = await prisma.student.findUnique({
    where: { id: String(studentId) },
    select: {
      ...SUMMARY_SELECT,
      groupId: true,
      enrollDate: true,
      group: {
        select: {
          name: true,
          schedule: true,
          startTime: true,
          endTime: true,
          course: { select: { name: true, icon: true } },
          teacher: { select: { fullName: true } },
        },
      },
    },
  });
  if (!s || s.status !== 'ACTIVE') return null;

  const period = currentPeriod();
  const firstPeriod = shiftPeriod(period, -5);
  const historyStart = periodRange(firstPeriod).start;

  const [monthRank, overallAbove, overallTotal, groupAbove, groupTotal, recentAch, historyAch, evals, attendance, discounts] =
    await Promise.all([
      monthlyRank(s.id, period),
      prisma.student.count({ where: { status: 'ACTIVE', totalPoints: { gt: s.totalPoints || 0 } } }),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      s.groupId
        ? prisma.student.count({
            where: { status: 'ACTIVE', groupId: s.groupId, totalPoints: { gt: s.totalPoints || 0 } },
          })
        : Promise.resolve(0),
      s.groupId ? prisma.student.count({ where: { status: 'ACTIVE', groupId: s.groupId } }) : Promise.resolve(0),
      prisma.achievement.findMany({
        where: { studentId: s.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { type: true, title: true, points: true, createdAt: true },
      }),
      prisma.achievement.findMany({
        where: { studentId: s.id, createdAt: { gte: historyStart } },
        select: { points: true, createdAt: true },
      }),
      prisma.studentEvaluation.findMany({
        where: { studentId: s.id },
        orderBy: { period: 'desc' },
        take: 2,
      }),
      prisma.attendance.findMany({
        where: { studentId: s.id },
        orderBy: { date: 'desc' },
        take: 30,
        select: { date: true, status: true },
      }),
      getDiscounts(s.id),
    ]);

  // Oxirgi 6 oy bo'yicha ballar (Toshkent vaqti)
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const p = shiftPeriod(period, -i);
    months.push({ period: p, label: MONTH_SHORT[Number(p.slice(5, 7)) - 1], fullLabel: periodLabel(p), points: 0 });
  }
  const byPeriod = new Map(months.map((m) => [m.period, m]));
  for (const a of historyAch) {
    const t = toTashkent(new Date(a.createdAt));
    const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = byPeriod.get(key);
    if (bucket) bucket.points += Number(a.points) || 0;
  }
  const thisMonth = byPeriod.get(period);

  // Davomat
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
  attendance.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const attended = counts.PRESENT + counts.LATE;
  const attRate = attendance.length > 0 ? Math.round((attended / attendance.length) * 100) : null;

  // Baholash va o'tgan oy bilan taqqoslash
  const latest = shapeEvaluation(evals[0]);
  const previous = shapeEvaluation(evals[1]);
  if (latest && previous) {
    const prevMap = new Map(previous.items.map((i) => [i.key, i.score]));
    latest.items = latest.items.map((i) => ({ ...i, delta: i.score - (prevMap.get(i.key) || i.score) }));
    latest.previousLabel = previous.periodLabel;
  }
  if (latest) {
    const avg = latest.items.reduce((sum, i) => sum + i.score, 0) / latest.items.length;
    latest.average = Math.round(avg * 10) / 10;
  }

  return {
    student: {
      ...summary(s),
      teacherName: s.group?.teacher?.fullName || null,
      schedule: s.group?.schedule || null,
      time: s.group?.startTime ? `${s.group.startTime}${s.group.endTime ? '–' + s.group.endTime : ''}` : null,
      enrollDate: s.enrollDate,
    },
    points: {
      total: s.totalPoints || 0,
      thisMonth: thisMonth ? thisMonth.points : 0,
      monthLabel: periodLabel(period),
      history: months.map(({ period: p, label, fullLabel, points }) => ({ period: p, label, fullLabel, points })),
    },
    ranks: {
      overall: { rank: overallAbove + 1, total: overallTotal },
      group: s.groupId && s.group ? { rank: groupAbove + 1, total: groupTotal, name: s.group.name } : null,
      month: monthRank,
    },
    evaluation: latest,
    attendance: {
      rate: attRate,
      total: attendance.length,
      counts,
      recent: attendance.map((r) => ({ date: r.date, status: r.status })).reverse(),
    },
    achievements: recentAch.map((a) => ({
      icon: ACH_ICONS[a.type] || '🎯',
      title: a.title,
      points: a.points,
      date: a.createdAt,
    })),
    discounts,
  };
}

module.exports = {
  getChildren,
  canView,
  searchStudents,
  getProfile,
  levelInfo,
  EVAL_FIELDS,
};
