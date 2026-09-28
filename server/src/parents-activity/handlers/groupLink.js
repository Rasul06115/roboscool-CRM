'use strict';

/**
 * Telegram guruhni CRM guruhiga ulash (faqat admin).
 *
 *  Telegram guruh ichida:
 *    /guruh_ulash              — CRM guruhlari ro'yxatini ko'rsatadi
 *    /guruh_ulash ROBOSCHOOL R-5 — shu Telegram guruhni CRM'dagi "ROBOSCHOOL R-5" ga ulaydi
 *    /guruh_uzish              — ulanishni bekor qiladi
 *
 *  Shaxsiy chatda:
 *    /guruhlar                 — qaysi Telegram guruh qaysi CRM guruhga ulangan
 */

const state = require('../state');
const config = require('../config');
const announce = require('../services/announce');
const { escapeHtml } = require('../services/notification');

function isAdmin(msg) {
  return msg?.from && String(msg.from.id) === String(config.adminChatId);
}

function isGroup(msg) {
  return msg?.chat && (msg.chat.type === 'group' || msg.chat.type === 'supergroup');
}

async function reply(chatId, text) {
  try {
    await state.bot.sendMessage(String(chatId), text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    state.logger.error('[groupLink] reply xato', { error: err.message });
  }
}

function register() {
  const { bot, logger } = state;

  bot.onText(/^\/guruh_ulash(?:@\w+)?(?:\s+(.+))?$/, async (msg, match) => {
    if (!isAdmin(msg)) return;
    if (!isGroup(msg)) {
      await reply(msg.chat.id, "ℹ️ Bu buyruqni <b>Telegram guruh ichida</b> yozing (bot guruhda admin bo'lishi kerak).");
      return;
    }
    const query = match && match[1] ? match[1].trim() : '';
    try {
      if (!query) {
        const groups = await announce.listCrmGroups();
        const list = groups.map((g) => `• <code>${escapeHtml(g.name)}</code>`).join('\n');
        await reply(
          msg.chat.id,
          `📚 <b>CRM guruhlari</b>\n\n${list || '—'}\n\n` +
            `Ulash uchun nomini yozing, masalan:\n<code>/guruh_ulash ${escapeHtml(groups[0]?.name || 'ROBOSCHOOL R-5')}</code>`
        );
        return;
      }
      const found = await announce.findCrmGroups(query);
      if (found.length === 0) {
        await reply(msg.chat.id, `❌ "${escapeHtml(query)}" nomli CRM guruhi topilmadi. <code>/guruh_ulash</code> — ro'yxat.`);
        return;
      }
      if (found.length > 1) {
        const list = found.map((g) => `• <code>${escapeHtml(g.name)}</code>`).join('\n');
        await reply(msg.chat.id, `⚠️ Bir nechta guruh topildi, aniqroq yozing:\n\n${list}`);
        return;
      }
      await announce.linkChat({ chatId: msg.chat.id, chatTitle: msg.chat.title, group: found[0] });
      await reply(
        msg.chat.id,
        `✅ Bu guruh CRM'dagi <b>${escapeHtml(found[0].name)}</b> ga ulandi.\n\n` +
          `Endi o'quvchilar ${config.announceMinPoints}+ ball olganda shu yerda tabrik e'lon qilinadi 🎉`
      );
    } catch (err) {
      logger.error('[groupLink] ulash xato', { error: err.message });
      const hint = String(err.message).includes('group_chats')
        ? "\n\nℹ️ <code>group_chats</code> jadvali yo'q — 5-bosqich SQL'ni Neon'da ishga tushiring."
        : '';
      await reply(msg.chat.id, `❌ Xato: ${escapeHtml(err.message)}${hint}`);
    }
  });

  bot.onText(/^\/guruh_uzish(?:@\w+)?$/, async (msg) => {
    if (!isAdmin(msg) || !isGroup(msg)) return;
    try {
      const n = await announce.unlinkChat(msg.chat.id);
      await reply(msg.chat.id, n ? "🔌 Ulanish bekor qilindi. Bu guruhga e'lonlar yuborilmaydi." : "ℹ️ Bu guruh hech qaysi CRM guruhga ulanmagan edi.");
    } catch (err) {
      await reply(msg.chat.id, `❌ Xato: ${escapeHtml(err.message)}`);
    }
  });

  bot.onText(/^\/guruhlar(?:@\w+)?$/, async (msg) => {
    if (!isAdmin(msg) || msg.chat.type !== 'private') return;
    try {
      const rows = await announce.listLinkedChats();
      if (!rows.length) {
        await reply(msg.chat.id, "📭 Hali birorta Telegram guruh ulanmagan.\n\nHar bir guruhda: <code>/guruh_ulash Guruh nomi</code>");
        return;
      }
      const list = rows.map((r) => `• ${escapeHtml(r.chatTitle || r.chatId)} → <b>${escapeHtml(r.groupName || '—')}</b>`).join('\n');
      await reply(msg.chat.id, `🔗 <b>Ulangan guruhlar</b> (${rows.length})\n\n${list}`);
    } catch (err) {
      await reply(msg.chat.id, `❌ Xato: ${escapeHtml(err.message)}`);
    }
  });

  logger.info('[groupLink] /guruh_ulash yoqildi');
}

module.exports = { register };
