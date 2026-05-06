const prisma = require('../config/prisma');

exports.getAll = async (req, res, next) => {
  try {
    const { search, status, groupId, page = 1, limit = 50 } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { parentName: { contains: search, mode: 'insensitive' } },
        { parentPhone: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (groupId) where.groupId = groupId;

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { group: { include: { course: true, teacher: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ success: true, data: students, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        group: { include: { course: true, teacher: true } },
        payments: { orderBy: { paymentDate: 'desc' }, take: 10 },
        attendance: { orderBy: { date: 'desc' }, take: 30 },
        documents: true,
      },
    });
    if (!student) return res.status(404).json({ success: false, error: "O'quvchi topilmadi" });
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const allowed = ['fullName', 'age', 'metrikaNumber', 'fatherName', 'fatherPhone',
      'motherName', 'motherPhone', 'parentPhone', 'address', 'groupId', 'balance',
      'progress', 'totalPoints', 'status', 'notes'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const student = await prisma.student.create({
      data,
      include: { group: { include: { course: true } } },
    });
    res.status(201).json({ success: true, data: student });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    // Faqat ruxsat etilgan maydonlarni olish
    const allowed = ['fullName', 'age', 'metrikaNumber', 'fatherName', 'fatherPhone',
      'motherName', 'motherPhone', 'parentPhone', 'address', 'groupId', 'balance',
      'progress', 'totalPoints', 'status', 'notes'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data,
      include: { group: { include: { course: true } } },
    });
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "O'quvchi o'chirildi" });
  } catch (err) { next(err); }
};

exports.getDebtors = async (req, res, next) => {
  try {
    const debtors = await prisma.student.findMany({
      where: { balance: { lt: 0 }, status: 'ACTIVE' },
      include: { group: { include: { course: true } } },
      orderBy: { balance: 'asc' },
    });
    res.json({ success: true, data: debtors });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const [total, active, inactive, avgProgress, debtors] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.student.count({ where: { status: 'INACTIVE' } }),
      prisma.student.aggregate({ _avg: { progress: true } }),
      prisma.student.count({ where: { balance: { lt: 0 } } }),
    ]);

    res.json({
      success: true,
      data: { total, active, inactive, avgProgress: Math.round(avgProgress._avg.progress || 0), debtors },
    });
  } catch (err) { next(err); }
};
