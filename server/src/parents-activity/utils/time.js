'use strict';

/**
 * O'zbekiston UTC+5 (yozgi vaqt yo'q). Hafta dushanbadan boshlanadi.
 */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** getUTC* metodlari Toshkent vaqtini beradigan "siljitilgan" Date. */
function toTashkent(date) {
  return new Date(date.getTime() + TZ_OFFSET_MS);
}

/** Joriy haftaning dushanbasi (Toshkent kalendari bo'yicha, DATE sifatida). */
function currentWeekStart(now = new Date()) {
  const s = toTashkent(now);
  const dow = s.getUTCDay(); // 0=Yakshanba..6=Shanba
  const diff = dow === 0 ? 6 : dow - 1;
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() - diff));
}

/** O'tgan haftaning dushanbasi. */
function previousWeekStart(now = new Date()) {
  const cur = currentWeekStart(now);
  return new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() - 7));
}

/** DATE ni "YYYY-MM-DD" ko'rinishida. */
function formatWeek(dateOnly) {
  const y = dateOnly.getUTCFullYear();
  const m = String(dateOnly.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateOnly.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Toshkent vaqti bo'yicha "YYYY-MM-DD HH:mm". */
function formatDateTime(date) {
  const s = toTashkent(date);
  const y = s.getUTCFullYear();
  const m = String(s.getUTCMonth() + 1).padStart(2, '0');
  const d = String(s.getUTCDate()).padStart(2, '0');
  const hh = String(s.getUTCHours()).padStart(2, '0');
  const mm = String(s.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

/** N kun oldingi instant. */
function daysAgo(n, now = new Date()) {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}

// ==================== OY (PERIOD) YORDAMCHILARI ====================

function periodKey(year, month1) {
  return `${year}-${String(month1).padStart(2, '0')}`;
}

/** "YYYY-MM" to'g'ri formatdami. */
function isValidPeriod(p) {
  if (!/^\d{4}-\d{2}$/.test(String(p))) return false;
  const m = Number(String(p).slice(5, 7));
  return m >= 1 && m <= 12;
}

/** Toshkent bo'yicha joriy oy: "YYYY-MM". */
function currentPeriod(now = new Date()) {
  const s = toTashkent(now);
  return periodKey(s.getUTCFullYear(), s.getUTCMonth() + 1);
}

/** Berilgan oydan N oy siljitish: shiftPeriod("2026-12", 1) => "2027-01". */
function shiftPeriod(period, delta) {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(y, m, 1));
  return periodKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** Toshkent bo'yicha o'tgan oy. */
function previousPeriod(now = new Date()) {
  return shiftPeriod(currentPeriod(now), -1);
}

/** Oy chegaralari (Toshkent vaqti bo'yicha) — haqiqiy UTC instantlarda. [start, end) */
function periodRange(period) {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7)) - 1;
  const start = new Date(Date.UTC(y, m, 1) - TZ_OFFSET_MS);
  const end = new Date(Date.UTC(y, m + 1, 1) - TZ_OFFSET_MS);
  return { start, end };
}

/** "2026-09" => "sentabr 2026" */
function periodLabel(period) {
  const y = period.slice(0, 4);
  const m = Number(period.slice(5, 7)) - 1;
  return `${MONTHS_UZ[m]} ${y}`;
}

/** "2026-09" => "sentabr" */
function monthName(period) {
  return MONTHS_UZ[Number(period.slice(5, 7)) - 1];
}

module.exports = {
  TZ_OFFSET_MS,
  toTashkent,
  currentWeekStart,
  previousWeekStart,
  formatWeek,
  formatDateTime,
  daysAgo,
  isValidPeriod,
  currentPeriod,
  previousPeriod,
  shiftPeriod,
  periodRange,
  periodLabel,
  monthName,
};
