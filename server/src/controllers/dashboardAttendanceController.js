const prisma = require('../config/prisma');

// ==================== ATTENDANCE ====================
exports.getAttendance = async (req, res, next) => {
  try {
    const { date, groupId } = req.query;
    if (!date || !groupId) return res.status(400).json({ success: false, error: 'date va groupId talab qilinadi' });

    const records = await prisma.attendance.findMany({
      where: { date: new Date(date), groupId },
      include: { student: { select: { id: true, fullName: true, avatar: true } } },
      orderBy: { student: { fullName: 'asc' } },
    });
    res.json({ success: true, data: records });
  } catch (err) { next(err); }
};

exports.markAttendance = async (req, res, next) => {
  try {
    const { studentId, groupId, date, status, note } = req.body;
    const record = await prisma.attendance.upsert({
      where: { studentId_date: { studentId, date: new Date(date) } },
      update: { status, note },
      create: { studentId, groupId, date: new Date(date), status, note },
    });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
};

exports.markBulkAttendance = async (req, res, next) => {
  try {
    const { records } = req.body;
    const results = await prisma.$transaction(
      records.map(r => prisma.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date: new Date(r.date) } },
        update: { status: r.status, note: r.note },
        create: { studentId: r.studentId, groupId: r.groupId, date: new Date(r.date), status: r.status, note: r.note },
      }))
    );
    res.json({ success: true, data: { count: results.length } });
  } catch (err) { next(err); }
};

exports.getStudentAttendance = async (req, res, next) => {
  try {
    const records = await prisma.attendance.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { date: 'desc' },
      take: Number(req.query.limit) || 30,
    });

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({ success: true, data: { records, stats: { total, present, rate } } });
  } catch (err) { next(err); }
};

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      studentStats, paymentStats, leadTotal, leadByStatus, leadBySource,
      debtors, groups, courses, monthlyRevenue, expenses
    ] = await Promise.all([
      // O'quvchilar
      prisma.student.aggregate({
        _count: true,
        _avg: { progress: true },
        where: { status: 'ACTIVE' },
      }),
      // Oylik daromad
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: thisMonthStart } } }),
      // Leadlar
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.$queryRaw`SELECT source, COUNT(*)::int as count, SUM(CASE WHEN status='CONVERTED' THEN 1 ELSE 0 END)::int as converted FROM leads GROUP BY source`,
      // Qarzdorlar
      prisma.student.findMany({ where: { balance: { lt: 0 }, status: 'ACTIVE' }, include: { group: { include: { course: true } } }, orderBy: { balance: 'asc' }, take: 10 }),
      // Guruhlar
      prisma.group.findMany({ where: { isActive: true }, include: { course: true, teacher: true, _count: { select: { students: { where: { status: 'ACTIVE' } } } } } }),
      // Kurslar
      prisma.course.findMany({ where: { isActive: true }, include: { _count: { select: { groups: true } }, groups: { include: { _count: { select: { students: true } } } } } }),
      // Oylik daromad tarixi
      prisma.$queryRaw`SELECT TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as revenue FROM payments GROUP BY TO_CHAR(payment_date, 'YYYY-MM') ORDER BY month DESC LIMIT 12`,
      // Oylik xarajat
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: thisMonthStart } } }),
    ]);

    const converted = leadByStatus.find(s => s.status === 'CONVERTED')?._count || 0;
    const totalStudents = await prisma.student.count();
    const inactiveStudents = await prisma.student.count({ where: { status: 'INACTIVE' } });
    const debtorCount = await prisma.student.count({ where: { balance: { lt: 0 } } });

    res.json({
      success: true,
      data: {
        students: {
          total: totalStudents,
          active: studentStats._count,
          inactive: inactiveStudents,
          avgProgress: Math.round(studentStats._avg.progress || 0),
          debtors: debtorCount,
        },
        payments: {
          thisMonth: paymentStats._sum.amount || 0,
          expenses: expenses._sum.amount || 0,
          profit: (paymentStats._sum.amount || 0) - (expenses._sum.amount || 0),
        },
        leads: {
          total: leadTotal,
          byStatus: leadByStatus.map(s => ({ status: s.status, count: s._count })),
          bySource: leadBySource,
          conversionRate: leadTotal > 0 ? Math.round((converted / leadTotal) * 100) : 0,
        },
        debtors,
        groups: groups.map(g => ({ ...g, studentCount: g._count.students })),
        courses: courses.map(c => ({ ...c, groupCount: c._count.groups, studentCount: c.groups.reduce((s, g) => s + g._count.students, 0) })),
        monthlyRevenue: monthlyRevenue.map(m => ({ ...m, revenue: Number(m.revenue) })),
      },
    });
  } catch (err) { next(err); }
};
