const prisma = require('../config/prisma');
const smsService = require('../services/smsService');
const path = require('path');

// ==================== SMS CONTROLLER ====================
exports.sendSms = async (req, res, next) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, error: 'Telefon va xabar talab qilinadi' });
    const result = await smsService.sendSms(phone, message);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.sendPaymentReminders = async (req, res, next) => {
  try {
    const results = await smsService.sendPaymentReminders();
    res.json({ success: true, data: { sent: results.length, results } });
  } catch (err) { next(err); }
};

exports.sendBulkSms = async (req, res, next) => {
  try {
    const { recipients } = req.body;
    const results = await smsService.sendBulkSms(recipients);
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};

exports.getSmsLogs = async (req, res, next) => {
  try {
    const logs = await prisma.smsLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

// ==================== FILE UPLOAD CONTROLLER ====================
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Fayl tanlanmagan' });

    const doc = await prisma.document.create({
      data: {
        studentId: req.body.studentId || null,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });

    res.status(201).json({
      success: true,
      data: { ...doc, url: `/uploads/${req.uploadType}/${req.file.filename}` },
    });
  } catch (err) { next(err); }
};

exports.getFiles = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.studentId) where.studentId = req.query.studentId;

    const files = await prisma.document.findMany({
      where,
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: files });
  } catch (err) { next(err); }
};

exports.deleteFile = async (req, res, next) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ success: false, error: 'Fayl topilmadi' });

    // Faylni diskdan o'chirish
    const fs = require('fs');
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);

    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Fayl o'chirildi" });
  } catch (err) { next(err); }
};
