const prisma = require('../config/prisma');

exports.getAll = async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        student: {
          select: { id: true, fullName: true, groupId: true, parentPhone: true,
            group: { select: { id: true, name: true, course: { select: { id: true, name: true, icon: true, color: true } } } }
          }
        }
      },
      orderBy: { paymentDate: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { studentId, amount, paymentMethod, monthFor, note } = req.body;
    if (!studentId || !amount) return res.status(400).json({ success: false, error: "O'quvchi va summa kerak" });

    const payment = await prisma.payment.create({
      data: {
        studentId, amount: Number(amount),
        paymentMethod: paymentMethod || 'CASH',
        monthFor: monthFor || null, note: note || null,
      },
    });

    // Balansni yangilash
    await prisma.student.update({
      where: { id: studentId },
      data: { balance: { increment: Number(amount) } },
    });

    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, error: "To'lov topilmadi" });

    // Balansdan qaytarish
    await prisma.student.update({
      where: { id: payment.studentId },
      data: { balance: { decrement: payment.amount } },
    });

    await prisma.payment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "To'lov o'chirildi" });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [totalRevenue, monthlyRevenue, allActive] = await Promise.all([
  prisma.payment.aggregate({ _sum: { amount: true } }),
  prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: thisMonthStart } } }),
  prisma.student.findMany({
    where: { status: 'ACTIVE' },
    include: {
      group: { include: { course: true } },
      payments: { where: { monthFor: monthStr } }
    }
  }),
]);

// Bu oy uchun to'lov qilmaganlar = qarzdorlar
const debtors = allActive
  .filter(s => s.payments.length === 0)
  .map(s => ({ ...s, balance: -400000, payments: undefined }));

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue._sum.amount || 0,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        totalDebt: debtors.reduce((s, d) => s + Math.abs(d.balance), 0),
        debtors,
      },
    });
  } catch (err) { next(err); }
};
