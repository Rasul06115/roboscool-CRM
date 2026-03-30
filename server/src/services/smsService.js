const axios = require('axios');
const logger = require('../config/logger');
const prisma = require('../config/prisma');

const SMS_API_URL = process.env.SMS_API_URL || 'https://notify.eskiz.uz/api';
let authToken = null;
let tokenExpiry = null;

// ==================== AUTH ====================
const getToken = async () => {
  if (authToken && tokenExpiry && new Date() < tokenExpiry) return authToken;

  try {
    const response = await axios.post(`${SMS_API_URL}/auth/login`, {
      email: process.env.SMS_EMAIL,
      password: process.env.SMS_PASSWORD,
    });
    authToken = response.data.data.token;
    tokenExpiry = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
    logger.info('✅ Eskiz SMS token olindi');
    return authToken;
  } catch (err) {
    logger.error('❌ Eskiz auth xatosi:', err.response?.data || err.message);
    return null;
  }
};

// ==================== SMS YUBORISH ====================
const sendSms = async (phone, message) => {
  if (!process.env.SMS_EMAIL || process.env.SMS_EMAIL === 'your_email@example.com') {
    logger.warn('⚠️ SMS demo mode');
    await prisma.smsLog.create({ data: { phone, message, status: 'demo_mode', provider: 'eskiz' } });
    return { success: true, demo: true };
  }

  try {
    const token = await getToken();
    if (!token) throw new Error('SMS auth token olishda xatolik');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('998') ? cleanPhone : `998${cleanPhone}`;

    const response = await axios.post(
      `${SMS_API_URL}/message/sms/send`,
      {
        mobile_phone: formattedPhone,
        message: message,
        from: process.env.SMS_FROM || '4546',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const status = response.data.status === 'success' ? 'sent' : 'failed';
    await prisma.smsLog.create({ data: { phone: formattedPhone, message, status, provider: 'eskiz' } });
    logger.info(`SMS ${status}: ${formattedPhone}`);
    return { success: status === 'sent', data: response.data };
  } catch (err) {
    logger.error('SMS xatosi:', err.response?.data || err.message);
    await prisma.smsLog.create({
      data: { phone, message, status: 'failed', provider: 'eskiz', errorMsg: err.response?.data?.message || err.message },
    });
    return { success: false, error: err.message };
  }
};

// ==================== SHABLONLAR (LOTIN, 160 belgi) ====================
const templates = {
  // 1. Oylik to'lov eslatmasi
  paymentReminder: (parentName, courseName) =>
    `Hurmatli ${parentName}! Shartnoma bo'yicha ${courseName} kursi uchun 15-sanagacha to'lov qilishingizni so'raymiz. ROBOSCHOOL`,

  // 2. Darsga kelmadi
  absentNotice: (studentName, date, courseName) =>
    `Farzandingiz ${studentName} bugungi ${date} ${courseName} darsiga kelmadi. Sababini aniqlashingizni so'raymiz. ROBOSCHOOL`,

  // 3. Yangi o'quvchi qabul qilindi
  welcomeStudent: (studentName) =>
    `Assalomu alaykum! Farzandingiz ${studentName} Roboschool o'quv markaziga qabul qilindi. Telegram: https://t.me/roboschool_chinoz ROBOSCHOOL`,

  // 4. Muvaffaqiyat (loyiha/vazifa topshirdi)
  achievement: (studentName, achievementTitle) =>
    `Farzandingiz ${studentName} ${achievementTitle} muvaffaqiyatli topshirdi. Tabriklaymiz! Hurmat bilan ROBOSCHOOL`,

  // 5. Ogohlantirish (kechikish, tayyorgarlik)
  warning: (studentName, reason) =>
    `Farzandingiz ${studentName} bugungi darsda ${reason}. Iltimos e'tibor bering. Hurmat bilan ROBOSCHOOL`,

  // 6. Qarz ogohlantirishi
  debtWarning: (parentName) =>
    `Hurmatli ${parentName}! Farzandingiz uchun o'tgan oy to'lovi qilinmagan. To'lov qilishingizni so'raymiz. ROBOSCHOOL`,

  // 7. To'lov uchun tashakkur
  paymentThanks: (parentName) =>
    `Hurmatli ${parentName}! To'lovni o'z vaqtida qilganingiz uchun tashakkur. Hurmat bilan ROBOSCHOOL`,
};

// ==================== OMMAVIY SMS ====================
const sendBulkSms = async (recipients) => {
  const results = [];
  for (const r of recipients) {
    const result = await sendSms(r.phone, r.message);
    results.push({ phone: r.phone, ...result });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
};

// Qarzdorlarga eslatma
const sendPaymentReminders = async () => {
  try {
    const debtors = await prisma.student.findMany({
      where: { balance: { lt: 0 }, status: 'ACTIVE' },
      include: { group: { include: { course: true } } },
    });

    const recipients = debtors.map(d => ({
      phone: d.parentPhone,
      message: templates.debtWarning(d.fatherName || d.motherName || 'ota-ona'),
    }));

    if (recipients.length === 0) return [];
    const results = await sendBulkSms(recipients);
    logger.info(`${results.length} ta qarzdorga eslatma yuborildi`);
    return results;
  } catch (err) {
    logger.error('Payment reminders error:', err);
    return [];
  }
};

module.exports = {
  sendSms,
  sendBulkSms,
  sendPaymentReminders,
  templates,
};
