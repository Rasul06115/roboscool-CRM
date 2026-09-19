'use strict';

/**
 * O'zbekiston UTC+5 (DST yo'q). Toshkent vaqtini UTC ga 5 soat qo'shib olamiz.
 * Hafta dushanbadan boshlanadi (ISO).
 */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Berilgan instant uchun Toshkent bo'yicha "shifted" Date (getUTC* Toshkent vaqtini beradi). */
function toTashkent(date) {
  return new Date(date.getTime() + TZ_OFFSET_MS);
}

/**
 * Joriy haftaning dushanbasi (Toshkent) — DATE (UTC yarim tunida, faqat y-m-d muhim).
 */
function currentWeekStart(now = new Date()) {
  const s = toTashkent(now);
  const dow = s.getUTCDay(); // 0=Yakshanba..6=Shanba
  const diff = dow === 0 ? 6 : dow - 1;
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() - diff));
}

/**
 * O'tgan haftaning dushanbasi.
 */
function previousWeekStart(now = new Date()) {
  const cur = currentWeekStart(now);
  return new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() - 7));
}

/**
 * DATE ni "YYYY-MM-DD" ko'rinishida (Toshkent kalendar sanasi).
 */
function formatWeek(dateOnly) {
  const y = dateOnly.getUTCFullYear();
  const m = String(dateOnly.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateOnly.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * To'liq vaqtni Toshkent bo'yicha "YYYY-MM-DD HH:mm".
 */
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

module.exports = {
  TZ_OFFSET_MS,
  toTashkent,
  currentWeekStart,
  previousWeekStart,
  formatWeek,
  formatDateTime,
  daysAgo,
};
