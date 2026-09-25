'use strict';

/**
 * Telegram Mini App ulash:
 *  - Botning chap pastdagi menyu tugmasi "📱 Kabinet" (barcha shaxsiy chatlar uchun)
 *  - /kabinet buyrug'i — kabinetni ochadigan tugma yuboradi
 */

const state = require('../state');
const config = require('../config');

function isHttps(url) {
  return /^https:\/\/[^\s]+$/i.test(url || '');
}

async function setupMenuButton() {
  const { bot, logger } = state;
  if (!isHttps(config.miniAppUrl)) {
    logger.warn('[cabinet] Mini App manzili yo\'q yoki https emas — menyu tugmasi o\'rnatilmadi', {
      miniAppUrl: config.miniAppUrl || '(bo\'sh)',
    });
    return false;
  }
  try {
    await bot.setChatMenuButton({
      menu_button: JSON.stringify({
        type: 'web_app',
        text: '📱 Kabinet',
        web_app: { url: config.miniAppUrl },
      }),
    });
    logger.info('[cabinet] Menyu tugmasi o\'rnatildi', { url: config.miniAppUrl });
    return true;
  } catch (err) {
    logger.warn('[cabinet] Menyu tugmasini o\'rnatib bo\'lmadi', { error: err.message });
    return false;
  }
}

function register() {
  const { bot, logger } = state;

  bot.onText(/^\/kabinet(?:@\w+)?$/, async (msg) => {
    if (msg.chat.type !== 'private') return;
    if (!isHttps(config.miniAppUrl)) {
      await bot.sendMessage(msg.chat.id, '⚠️ Kabinet hali sozlanmagan. Birozdan so\'ng urinib ko\'ring.');
      return;
    }
    try {
      await bot.sendMessage(
        msg.chat.id,
        '📱 <b>Farzandingizning shaxsiy kabineti</b>\n\n' +
          'Ballar, daraja, reyting, baholash mezonlari va davomat — barchasi bir joyda.\n\n' +
          'Ochish uchun pastdagi tugmani bosing 👇',
        {
          parse_mode: 'HTML',
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: '📱 Kabinetni ochish', web_app: { url: config.miniAppUrl } }]],
          }),
        }
      );
    } catch (err) {
      logger.error('[cabinet] /kabinet xato', { error: err.message });
    }
  });

  setupMenuButton();
  logger.info('[cabinet] /kabinet buyrug\'i ro\'yxatga olindi');
}

module.exports = { register, setupMenuButton };
