const prisma = require('../config/prisma');
const telegramService = require('../services/telegramService');

exports.getAll = async (req, res, next) => {
  try {
    const { studentId, month, fromDate, toDate, page = 1, limit = 50 } = req.query;
    const where = {};
    if (studentId) where.studentId = studentId;
    if (month) where.monthFor = month;
    if (fromDate || toDate) {
      where.paymentDate = {};
      if (fromDate) where.paymentDate.gte = new Date(fromDate);
      if (toDate) where.paymentDate.lte = new Date(toDate);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { student: { include: { group: { include: { course: true } } } } },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ success: true, data: payments, total });
  } catch (err) { next(err); }
};

// To'lov qo'shish + balansni yangilash (TRANSACTION)
exports.create = async (req, res, next) => {
  try {
    const { studentId, amount, paymentMethod, monthFor, note } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { studentId, amount: Number(amount), paymentMethod, monthFor, note },
        include: { student: true },
      });

      await tx.student.update({
        where: { id: studentId },
        data: { balance: { increment: Number(amount) } },
      });

      return payment;
    });

    // Telegram bildirishnoma
    telegramService.notifyPayment(result.student.fullName, result.amount, result.paymentMethod);

    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, error: "To'lov topilmadi" });

    await prisma.$transaction([
      prisma.student.update({ where: { id: payment.studentId }, data: { balance: { decrement: payment.amount } } }),
      prisma.payment.delete({ where: { id: req.params.id } }),
    ]);

    res.json({ success: true, message: "To'lov o'chirildi va balans qaytarildi" });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [total, thisMonth, lastMonth, monthly, methods] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: thisMonthStart } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: lastMonthStart, lt: thisMonthStart } } }),
      prisma.$queryRaw`
        SELECT TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as revenue, COUNT(*)::int as count
        FROM payments GROUP BY TO_CHAR(payment_date, 'YYYY-MM') ORDER BY month DESC LIMIT 12
      `,
      prisma.$queryRaw`
        SELECT payment_method, SUM(amount) as total, COUNT(*)::int as count
        FROM payments GROUP BY payment_method ORDER BY total DESC
      `,
    ]);

    const thisMonthSum = thisMonth._sum.amount || 0;
    const lastMonthSum = lastMonth._sum.amount || 0;

    res.json({
      success: true,
      data: {
        totalRevenue: total._sum.amount || 0,
        thisMonth: thisMonthSum,
        lastMonth: lastMonthSum,
        growth: lastMonthSum > 0 ? Math.round(((thisMonthSum - lastMonthSum) / lastMonthSum) * 100) : 0,
        monthly: monthly.map(m => ({ ...m, revenue: Number(m.revenue) })),
        methods: methods.map(m => ({ ...m, total: Number(m.total) })),
      },
    });
  } catch (err) { next(err); }
};
