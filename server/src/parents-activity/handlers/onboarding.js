'use strict';

/**
 * Ota-onalarni oson ulash.
 *
 *  - /start — ulanmagan ota-onaga CRM salomlashuvidan keyin "📞 Raqamni yuborish" tugmasi
 *  - Havola: t.me/<bot>?start=ulash   — darhol raqam so'raydi
 *            t.me/<bot>?start=kabinet — ulangan bo'lsa kabinet, bo'lmasa raqam
 *  - /ulash_elon (admin) — barcha guruhlarga "📞 Farzandimni ulash" tugmali e'lon
 *  - Buyruqlar menyusi: ota-onalar faqat /kabinet va /ulash ni ko'radi,
 *    admin esa o'z chatida admin buyruqlarini ham ko'radi.
 *
 * CRM'ning telegramService.js fayliga TEGILMAYDI — uning /start javobi o'z holicha qoladi.
 */

const state = require('../state');
const config = require('../config');
const phoneLink = require('../services/phoneLink');
const announce = require('../services/announce');
const { askContact } = require('./contactLink');
const { sendCabinetButton } = require('./cabinetCommands');

const PARENT_COMMANDS = [
  { command: 'kabinet', description: '📱 Farzandim kabineti' },
  { command: 'ulash', description: '📞 Telefon raqamni tasdiqlash' },
];

const ADMIN_COMMANDS = [
  ...PARENT_COMMANDS,
  { command: 'parents_help', description: '📋 Ota-onalar moduli — barcha buyruqlar' },
  { command: 'parents_status', description: '📊 Modul holati' },
  { command: 'parents_weekly_report', description: '📈 O\'tgan hafta faolligi' },
  { command: 'parents_links', description: '🔗 Ulangan ota-onalar' },
  { command: 'parents_top5', description: '🏆 Joriy oy TOP-5' },
  { command: 'rasmsiz', description: '📷 Rasmi yo\'q o\'quvchilar' },
  { command: 'ulash_elon', description: '📣 Guruhlarga "Farzandimni ulash" e\'loni' },
  { command: 'guruhlar', description: '👥 Ulangan Telegram guruhlar' },
  { command: 'stats', description: '📊 CRM statistika' },
  { command: 'debtors', description: '⚠️ Qarzdorlar' },
  { command: 'users', description: '👥 Bot foydalanuvchilari' },
  { command: 'reklama', description: '📢 Ommaviy xabar' },
];

function isAdminId(id) {
  return String(id) === String(config.adminChatId);
}

function deepLink(payload) {
  return state.botUsername ? `https://t.me/${state.botUsername}?start=${payload}` : null;
}

function elonText() {
  return (
    '📱 <b>Hurmatli ota-onalar!</b>\n\n' +
    "Farzandingizning ballari, reytingi, baholash natijalari va davomati endi bitta joyda — " +
    "Roboschool botidagi <b>shaxsiy kabinetda</b>.\n\n" +
    '<b>Kabinetni ochish uchun:</b>\n' +
    '1️⃣ Pastdagi <b>«📞 Farzandimni ulash»</b> tugmasini bosing\n' +
    '2️⃣ Botda <b>«📞 Raqamni yuborish»</b> ni bosing\n' +
    '3️⃣ Tayyor! Farzandingiz avtomatik ulanadi ✅\n\n' +
    `⭐ Guruhda haftasiga kamida <b>${config.minMessagesForActive} marta</b> faol bo'lsangiz ` +
    "(xabar, izoh yoki reaksiya), farzandingizga <b>+3 ball</b> beriladi.\n\n" +
    "🔒 Farzandingiz natijalarini faqat siz ko'rasiz."
  );
}

async function setupCommands() {
  const { bot, logger } = state;
  try {
    const me = await bot.getMe();
    state.botUsername = me.username;
  } catch (err) {
    logger.warn('[onboarding] getMe xato', { error: err.message });
  }
  try {
    await bot.setMyCommands(PARENT_COMMANDS, { scope: { type: 'all_private_chats' } });
    await bot.setMyCommands(ADMIN_COMMANDS, { scope: { type: 'chat', chat_id: Number(config.adminChatId) } });
    logger.info('[onboarding] Buyruqlar menyusi o\'rnatildi');
  } catch (err) {
    logger.warn('[onboarding] Buyruqlar menyusini o\'rnatib bo\'lmadi', { error: err.message });
  }
}

async function onStart(msg, match) {
  const { logger } = state;
  try {
    if (msg.chat.type !== 'private' || isAdminId(msg.from?.id)) return;
    const payload = (match && match[1] ? match[1] : '').toLowerCase();
    const linked = (await phoneLink.countLinks(msg.from.id)) > 0;

    if (payload === 'ulash' || payload === 'kabinet') {
      if (linked) await sendCabinetButton(msg.chat.id);
      else await askContact(msg.chat.id, '👋 Xush kelibsiz! Farzandingizni kabinetga ulaymiz.');
      return;
    }

    // Oddiy /start: CRM salomlashuvi birinchi chiqsin, keyin raqam tugmasi
    if (!linked) {
      await new Promise((r) => setTimeout(r, 700));
      await askContact(
        msg.chat.id,
        "📱 <b>Yangi imkoniyat:</b> farzandingizning shaxsiy kabineti! Ballar, reyting va baholash — bir joyda."
      );
    }
  } catch (err) {
    logger.error('[onboarding] /start xato', { error: err.message });
  }
}

async function onUlashElon(msg) {
  const { bot, logger } = state;
  if (msg.chat.type !== 'private' || !isAdminId(msg.from?.id)) return;
  const link = deepLink('ulash');
  if (!link) {
    await bot.sendMessage(msg.chat.id, "⚠️ Bot nomi aniqlanmadi. Birozdan so'ng qayta urinib ko'ring.");
    return;
  }
  try {
    const chats = await announce.targetChats(null, { all: true });
    if (!chats.length) {
      await bot.sendMessage(
        msg.chat.id,
        "📭 Hali birorta guruh aniqlanmadi. Ota-onalar guruhda yozgach yoki guruhda /guruh_ulash qilingach qayta urinib ko'ring."
      );
      return;
    }
    const markup = JSON.stringify({ inline_keyboard: [[{ text: '📞 Farzandimni ulash', url: link }]] });
    let ok = 0;
    const failed = [];
    for (const chatId of chats) {
      try {
        await bot.sendMessage(chatId, elonText(), { parse_mode: 'HTML', reply_markup: markup });
        ok += 1;
      } catch (err) {
        failed.push(chatId);
        logger.warn('[onboarding] e\'lon yuborilmadi', { chatId, error: err.message });
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    await bot.sendMessage(
      msg.chat.id,
      `✅ E'lon yuborildi: <b>${ok}</b> ta guruhga` +
        (failed.length ? `\n⚠️ Yuborilmadi: ${failed.length} ta (bot guruhdan chiqarilgan bo'lishi mumkin)` : '') +
        `\n\n🔗 Havola: ${link}`,
      { parse_mode: 'HTML', disable_web_page_preview: true }
    );
  } catch (err) {
    logger.error('[onboarding] /ulash_elon xato', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Xato: ${err.message}`);
  }
}

function register() {
  const { bot, logger } = state;
  bot.onText(/^\/start(?:@\w+)?(?:\s+(\S+))?$/, onStart);
  bot.onText(/^\/ulash_elon(?:@\w+)?$/, onUlashElon);
  setupCommands();
  logger.info('[onboarding] /start raqam tugmasi va /ulash_elon yoqildi');
}

module.exports = { register, onStart, onUlashElon, setupCommands, elonText, PARENT_COMMANDS, ADMIN_COMMANDS };
