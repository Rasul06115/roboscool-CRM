'use strict';

function intOr(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : def;
}

function strOr(name, def) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : def;
}

function parseGroupIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  // Admin — CRM'ning mavjud env nomidan foydalanadi
  adminChatId: strOr('TELEGRAM_ADMIN_CHAT_ID', '319288673'),

  // Faqat shu guruhlarda ishlash (chat_id lar, vergul bilan). Bo'sh — hamma guruh.
  allowedGroupChatIds: parseGroupIds(process.env.PARENTS_ALLOWED_GROUP_IDS || ''),

  // Tekshiriladigan kanallar
  channelChinoz: strOr('CHANNEL_ROBOSCHOOL_CHINOZ', '@roboschool_chinoz'),
  channelMarket: strOr('CHANNEL_ROBOSCHOOL_MARKET', '@roboschool_market'),

  // Ball tizimi
  activeRewardPoints: intOr('PARENTS_ACTIVE_POINTS', 3),
  // Haftada kamida shuncha faollik (xabar + izoh + reaksiya) — aktiv hisoblanadi
  minMessagesForActive: intOr('PARENTS_MIN_MESSAGES', 5),
  inactivityDays: intOr('PARENTS_INACTIVITY_DAYS', 7),

  // Avtomatik bog'lash: bitta qidiruvda nechtagacha o'quvchi bog'lansin
  autoLinkMaxStudents: intOr('PARENTS_AUTOLINK_MAX', 3),

  // Bir odamga eslatma qayta yubormaslik oralig'i (kun)
  reminderCooldownDays: intOr('PARENTS_REMINDER_COOLDOWN_DAYS', 7),

  // Telegram Mini App (shaxsiy kabinet) manzili — https bo'lishi shart.
  // MINI_APP_URL berilmasa, CLIENT_URL + "/cabinet" ishlatiladi.
  miniAppUrl: (() => {
    const explicit = strOr('MINI_APP_URL', '');
    if (explicit) return explicit;
    const client = strOr('CLIENT_URL', '');
    return client ? `${client.replace(/\/+$/, '')}/cabinet` : '';
  })(),

  // Guruhga yutuq e'loni: shu balldan katta/teng yutuqlar e'lon qilinadi
  announceMinPoints: intOr('ANNOUNCE_MIN_POINTS', 5),
  // 'all' — e'lon BARCHA ota-onalar guruhlariga (motivatsiya uchun)
  // 'group' — faqat o'quvchining /guruh_ulash qilingan guruhiga
  announceScope: strOr('ANNOUNCE_SCOPE', 'all') === 'group' ? 'group' : 'all',
  announceCron: strOr('ANNOUNCE_CRON', '* * * * *'), // har daqiqada tekshiradi

  // TOP-N oylik chegirma
  topCount: intOr('TOP_DISCOUNT_COUNT', 5),
  topDiscountPercent: intOr('TOP_DISCOUNT_PERCENT', 40),
  // G'olib keyingi oy reytingda "dam oladi" (true). O'chirish uchun: TOP_REST_WINNERS=0
  topRestWinners: strOr('TOP_REST_WINNERS', '1') !== '0',
  // Tabriknoma yuboriladigan kanal (bot kanalda ADMIN bo'lishi shart). O'chirish: CONGRATS_CHANNEL=off
  congratsChannel: (() => {
    const v = strOr('CONGRATS_CHANNEL', '');
    if (v.toLowerCase() === 'off') return '';
    return v || strOr('CHANNEL_ROBOSCHOOL_CHINOZ', '@roboschool_chinoz');
  })(),

  // Cron (Railway serveri UTC). Toshkent = UTC+5.
  // Dushanba 09:00 Toshkent = 04:00 UTC
  weeklyCron: strOr('PARENTS_WEEKLY_CRON', '0 4 * * 1'),
  // Har kuni 20:00 Toshkent = 15:00 UTC
  dailySubscriptionCron: strOr('PARENTS_SUBS_CRON', '0 15 * * *'),
  // Har oyning 1-sanasi 10:00 Toshkent = 05:00 UTC
  monthlyTopCron: strOr('TOP_DISCOUNT_CRON', '0 5 1 * *'),
};

module.exports = config;
