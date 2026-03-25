const axios = require('axios');
const logger = require('../config/logger');
const prisma = require('../config/prisma');

const SMS_API_URL = process.env.SMS_API_URL || 'https://notify.eskiz.uz/api';
let authToken = null;
let tokenExpiry = null;

// ==================== AUTH ====================

const getToken = async () => {
  // Cache token
  if (authToken && tokenExpiry && new Date() < tokenExpiry) {
    return authToken;
  }

  try {
    const response = await axios.post(`${SMS_API_URL}/auth/login`, {
      email: process.env.SMS_EMAIL,
      password: process.env.SMS_PASSWORD,
    });

    authToken = response.data.data.token;
    tokenExpiry = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 kun
    logger.info('✅ Eskiz SMS token olindi');
    return authToken;
  } catch (err) {
    logger.error('❌ Eskiz auth xatosi:', err.response?.data || err.message);
    return null;
  }
};

// ==================== SMS YUBORISH ====================

const sendSms = async (phone, message) => {
  // SMS sozlanganligini tekshirish
  if (!process.env.SMS_EMAIL || process.env.SMS_EMAIL === 'your_email@example.com') {
    logger.warn('⚠️  SMS xizmati sozlanmagan. .env faylda SMS_EMAIL va SMS_PASSWORD ni kiriting.');
    // Demo mode — logga yozish
    await prisma.smsLog.create({
      data: { phone, message, status: 'demo_mode', provider: 'eskiz' },
    });
    return { success: true, demo: true };
  }

  try {
    const token = await getToken();
    if (!token) throw new Error('SMS auth token olishda xatolik');

    // Telefon raqamni formatlash (998XXXXXXXXX)
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('998') ? cleanPhone : `998${cleanPhone}`;

    const response = await axios.post(
      `${SMS_API_URL}/message/sms/send`,
      {
        mobile_phone: formattedPhone,
        message: message,
        from: process.env.SMS_FROM || '4546',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Logga yozish
    await prisma.smsLog.create({
      data: {
        phone: formattedPhone,
        message,
        status: response.data.status === 'success' ? 'sent' : 'failed',
        provider: 'eskiz',
      },
    });

    logger.info(`SMS yuborildi: ${formattedPhone}`);
    return { success: true, data: response.data };
  } catch (err) {
    logger.error('SMS yuborish xatosi:', err.response?.data || err.message);

    await prisma.smsLog.create({
      data: {
        phone,
        message,
        status: 'failed',
        provider: 'eskiz',
        errorMsg: err.response?.data?.message || err.message,
      },
    });

    return { success: false, error: err.message };
  }
};

// ==================== SHABLONLAR ====================

const templates = {
  // To'lov eslatmasi
  paymentReminder: (studentName, amount) =>
    `RoboSchool: Hurmatli ota-ona, ${studentName} ning to'lov muddati yaqinlashmoqda. ` +
    `Summa: ${(amount / 1000).toLocaleString()}k so'm. Tel: +998901234567`,

  // Qarz eslatmasi
  debtReminder: (studentName, debtAmount) =>
    `RoboSchool: ${studentName} bo'yicha ${(debtAmount / 1000).toLocaleString()}k so'm qarz mavjud. ` +
    `Iltimos to'lovni amalga oshiring. Tel: +998901234567`,

  // Sinov darsi eslatmasi
  trialReminder: (name, date, time) =>
    `RoboSchool: ${name}, sizning sinov darsingiz ${date} kuni soat ${time} da. ` +
    `Manzil: [markaz manzili]. Kutib qolamiz!`,

  // Yangi o'quvchi tabrik
  welcomeStudent: (studentName) =>
    `RoboSchool: ${studentName} ni o'quv markazimizga xush kelibsiz! ` +
    `Darslar jadvali va qo'shimcha ma'lumotlar uchun: +998901234567`,

  // Dars bekor qilinishi
  classCancel: (groupName, date, reason) =>
    `RoboSchool: ${groupName} guruhi darsi ${date} kuni bekor qilindi. ` +
    `Sabab: ${reason}. Qo'shimcha: +998901234567`,
};

// ==================== OMMAVIY SMS ====================

const sendBulkSms = async (recipients) => {
  const results = [];
  for (const r of recipients) {
    const result = await sendSms(r.phone, r.message);
    results.push({ phone: r.phone, ...result });
    // Rate limit - 100ms oraliqda
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
};

// To'lov eslatmalarini yuborish
const sendPaymentReminders = async () => {
  try {
    const debtors = await prisma.student.findMany({
      where: { balance: { lt: 0 }, status: 'ACTIVE' },
    });

    const recipients = debtors.map(d => ({
      phone: d.parentPhone,
      message: templates.debtReminder(d.fullName, Math.abs(d.balance)),
    }));

    if (recipients.length === 0) {
      logger.info('Qarzdor yo\'q, SMS yuborilmadi');
      return [];
    }

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
