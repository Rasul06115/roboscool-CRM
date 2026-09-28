'use strict';

/**
 * Ota-onani TELEFON RAQAMI orqali farzandiga bog'lash.
 *
 *  - /ulash — "📞 Raqamni yuborish" tugmasini chiqaradi
 *  - Ota-ona tugmani bosib raqamini yuboradi (yoki kabinetdagi tugma orqali)
 *  - Bot raqamni CRM'dagi ota-ona telefonlari bilan solishtiradi va bog'laydi
 */

const state = require('../state');
const config = require('../config');
const phoneLink = require('../services/phoneLink');
const { escapeHtml, cleanName } = require('../services/notification');

function isHttps(url) {
  return /^https:\/\/[^\s]+$/i.test(url || '');
}

/** Raqam so'rovchi tugma bilan xabar yuborish. */
async function askContact(chatId, intro) {
  const { bot } = state;
  await bot.sendMessage(
    String(chatId),
    (intro ? `${intro}\n\n` : '') +
      '📞 <b>Telefon raqamingizni tasdiqlang</b>\n\n' +
      "Pastdagi tugmani bosing — raqamingiz Roboschool'dagi ota-ona raqami bilan solishtiriladi " +
      "va farzandingiz kabinetingizga avtomatik ulanadi.\n\n" +
      "🔒 Raqamingiz faqat shu tekshiruv uchun ishlatiladi.",
    {
      parse_mode: 'HTML',
      reply_markup: JSON.stringify({
        keyboard: [[{ text: '📞 Raqamni yuborish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      }),
    }
  );
}

async function onContact(msg) {
  const { bot, logger } = state;
  try {
    if (!msg?.chat || msg.chat.type !== 'private' || !msg.contact) return;

    // Faqat O'Z raqamini yuborishi mumkin (boshqa odamning kontaktini emas)
    if (!msg.contact.user_id || String(msg.contact.user_id) !== String(msg.from.id)) {
      await bot.sendMessage(
        msg.chat.id,
        "⚠️ Iltimos, boshqa odamning kontaktini emas, <b>o'z raqamingizni</b> pastdagi tugma orqali yuboring.",
        { parse_mode: 'HTML' }
      );
      return;
    }

    const students = await phoneLink.linkByPhone(msg.from.id, msg.contact.phone_number);
    const removeKeyboard = JSON.stringify({ remove_keyboard: true });

    if (students.length === 0) {
      await bot.sendMessage(
        msg.chat.id,
        '😔 <b>Raqamingiz bazada topilmadi.</b>\n\n' +
          "Ehtimol, ro'yxatdan o'tishda boshqa raqam yozilgan. " +
          "Iltimos, Roboschool administratoriga murojaat qiling — raqamingizni qo'shib qo'yamiz.",
        { parse_mode: 'HTML', reply_markup: removeKeyboard }
      );
      // Adminga xabar — qo'lda tekshirish uchun
      try {
        await bot.sendMessage(
          String(config.adminChatId),
          `ℹ️ <b>Raqam bazada topilmadi</b>\n\n` +
            `👤 ${escapeHtml(cleanName(msg.from.first_name, '—'))}` +
            (msg.from.username ? ` (@${escapeHtml(msg.from.username)})` : '') +
            `\n📞 <code>${escapeHtml(msg.contact.phone_number)}</code>\n🆔 <code>${msg.from.id}</code>\n\n` +
            `CRM'da o'quvchining ota-ona raqamini tekshiring yoki qo'lda bog'lang:\n` +
            `<code>/parents_link ${msg.from.id} Ism Familiya</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (_) { /* ignore */ }
      return;
    }

    const names = students.map((s) => `• <b>${escapeHtml(s.fullName)}</b>`).join('\n');
    const options = { parse_mode: 'HTML', reply_markup: removeKeyboard };
    await bot.sendMessage(
      msg.chat.id,
      `✅ <b>Tasdiqlandi!</b>\n\nKabinetingizga ulandi:\n${names}`,
      options
    );

    if (isHttps(config.miniAppUrl)) {
      await bot.sendMessage(msg.chat.id, '📱 Farzandingiz natijalarini ko\'rish uchun kabinetni oching 👇', {
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: '📱 Kabinetni ochish', web_app: { url: config.miniAppUrl } }]],
        }),
      });
    }
    logger.info('[parents] Telefon orqali bog\'landi', { telegramId: String(msg.from.id), count: students.length });
  } catch (err) {
    logger.error('[parents] contact xato', { error: err.message });
  }
}

function register() {
  const { bot, logger } = state;

  bot.on('contact', onContact);

  bot.onText(/^\/ulash(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private') return;
    try {
      await askContact(msg.chat.id);
    } catch (err) {
      logger.error('[parents] /ulash xato', { error: err.message });
    }
  });

  logger.info('[parents] Telefon orqali bog\'lash yoqildi (/ulash)');
}

module.exports = { register, askContact, onContact };
