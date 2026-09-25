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
  minMessagesForActive: intOr('PARENTS_MIN_MESSAGES', 3),
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

  // TOP-N oylik chegirma
  topCount: intOr('TOP_DISCOUNT_COUNT', 5),
  topDiscountPercent: intOr('TOP_DISCOUNT_PERCENT', 40),

  // Cron (Railway serveri UTC). Toshkent = UTC+5.
  // Dushanba 09:00 Toshkent = 04:00 UTC
  weeklyCron: strOr('PARENTS_WEEKLY_CRON', '0 4 * * 1'),
  // Har kuni 20:00 Toshkent = 15:00 UTC
  dailySubscriptionCron: strOr('PARENTS_SUBS_CRON', '0 15 * * *'),
  // Har oyning 1-sanasi 10:00 Toshkent = 05:00 UTC
  monthlyTopCron: strOr('TOP_DISCOUNT_CRON', '0 5 1 * *'),
};

module.exports = config;
