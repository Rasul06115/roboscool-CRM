const prisma = require('../config/prisma');
const smsService = require('../services/smsService');
const telegramService = require('../services/telegramService');

// Davomat olish
exports.getAttendance = async (req, res, next) => {
  try {
    const { date, groupId } = req.query;
    if (!date || !groupId) return res.status(400).json({ success: false, error: 'date va groupId talab qilinadi' });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { course: true, teacher: true, students: { where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' } } },
    });
    if (!group) return res.status(404).json({ success: false, error: 'Guruh topilmadi' });

    const existing = await prisma.attendance.findMany({ where: { groupId, date: new Date(date) } });
    const existingMap = {};
    existing.forEach(a => { existingMap[a.studentId] = a; });

    const attendanceList = group.students.map(s => ({
      studentId: s.id, studentName: s.fullName,
      fatherName: s.fatherName, fatherPhone: s.fatherPhone,
      motherName: s.motherName, motherPhone: s.motherPhone, parentPhone: s.parentPhone,
      status: existingMap[s.id]?.status || null, note: existingMap[s.id]?.note || '',
      smsSent: existingMap[s.id]?.smsSent || false, attendanceId: existingMap[s.id]?.id || null,
    }));

    res.json({
      success: true,
      data: {
        group: { id: group.id, name: group.name, course: group.course, teacher: group.teacher, schedule: group.schedule, timeSlot: group.timeSlot, startTime: group.startTime, endTime: group.endTime, weekDays: group.weekDays },
        date,
        attendance: attendanceList,
        stats: {
          total: attendanceList.length,
          present: attendanceList.filter(a => a.status === 'PRESENT').length,
          absent: attendanceList.filter(a => a.status === 'ABSENT').length,
          late: attendanceList.filter(a => a.status === 'LATE').length,
          unmarked: attendanceList.filter(a => !a.status).length,
        },
      },
    });
  } catch (err) { next(err); }
};

// Ommaviy davomat + SMS
exports.markBulkAttendance = async (req, res, next) => {
  try {
    const { groupId, date, records, sendSms } = req.body;
    if (!groupId || !date || !records) return res.status(400).json({ success: false, error: "Ma'lumotlar to'liq emas" });

    const results = [];
    const absentStudents = [];
    const lateStudents = [];

    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        const result = await tx.attendance.upsert({
          where: { studentId_date: { studentId: record.studentId, date: new Date(date) } },
          update: { status: record.status, note: record.note || null },
          create: { studentId: record.studentId, groupId, date: new Date(date), status: record.status, note: record.note || null },
        });
        results.push(result);
        if (record.status === 'ABSENT') absentStudents.push(record.studentId);
        if (record.status === 'LATE') lateStudents.push(record.studentId);
      }
    });

    let smsSentCount = 0;

    if (sendSms && (absentStudents.length > 0 || lateStudents.length > 0)) {
      const group = await prisma.group.findUnique({ where: { id: groupId }, include: { course: true } });

      const formattedDate = new Date(date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Kelmagan o'quvchilarga SMS
      if (absentStudents.length > 0) {
        const students = await prisma.student.findMany({ where: { id: { in: absentStudents } } });
        for (const student of students) {
          const message = smsService.templates.absentNotice(student.fullName, formattedDate, group.course.name);
          const result = await smsService.sendSms(student.parentPhone, message);
          if (result.success) {
            smsSentCount++;
            await prisma.attendance.update({
              where: { studentId_date: { studentId: student.id, date: new Date(date) } },
              data: { smsSent: true },
            });
          }
        }
      }

      // Kechikkan o'quvchilarga SMS
      if (lateStudents.length > 0) {
        const students = await prisma.student.findMany({ where: { id: { in: lateStudents } } });
        for (const student of students) {
          const message = smsService.templates.warning(student.fullName, 'darsga kechikib keldi');
          const result = await smsService.sendSms(student.parentPhone, message);
          if (result.success) {
            smsSentCount++;
            await prisma.attendance.update({
              where: { studentId_date: { studentId: student.id, date: new Date(date) } },
              data: { smsSent: true },
            });
          }
        }
      }

      // Telegram admin ga
      telegramService.notifyAdmin(
        `📋 *Davomat saqlandi*\n\n` +
        `📚 ${group.course.name} (${group.name})\n` +
        `📅 ${formattedDate}\n` +
        `✅ Keldi: ${results.length - absentStudents.length - lateStudents.length}\n` +
        `❌ Kelmadi: ${absentStudents.length}\n` +
        `⏰ Kechikdi: ${lateStudents.length}\n` +
        `📱 SMS: ${smsSentCount} ta yuborildi`
      );
    }

    res.json({
      success: true,
      data: { saved: results.length, absent: absentStudents.length, late: lateStudents.length, smsSent: smsSentCount },
      message: `${results.length} ta davomat saqlandi. ${smsSentCount > 0 ? `${smsSentCount} ta SMS yuborildi.` : ''}`,
    });
  } catch (err) { next(err); }
};

// Bitta belgilash
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

// O'quvchi davomati
exports.getStudentAttendance = async (req, res, next) => {
  try {
    const records = await prisma.attendance.findMany({
      where: { studentId: req.params.studentId },
      include: { group: { include: { course: true } } },
      orderBy: { date: 'desc' }, take: Number(req.query.limit) || 30,
    });
    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    res.json({ success: true, data: { records, stats: { total, present, absent: total - present, rate: total > 0 ? Math.round((present / total) * 100) : 0 } } });
  } catch (err) { next(err); }
};

// ==================== BALL / YUTUQLAR ====================
exports.addAchievement = async (req, res, next) => {
  try {
    const { studentId, type, title, description, points, sendSms } = req.body;
    if (!studentId || !title || !points) return res.status(400).json({ success: false, error: "Ma'lumotlar to'liq emas" });

    const achievement = await prisma.achievement.create({
      data: { studentId, type: type || 'PROJECT_DONE', title, description, points: Number(points) },
      include: { student: true },
    });

    await prisma.student.update({
      where: { id: studentId },
      data: { totalPoints: { increment: Number(points) } },
    });

    if (sendSms) {
      const student = achievement.student;
      const message = smsService.templates.achievement(student.fullName, title);
      const result = await smsService.sendSms(student.parentPhone, message);
      if (result.success) {
        await prisma.achievement.update({ where: { id: achievement.id }, data: { smsSent: true } });
      }

      telegramService.notifyAdmin(
        `🏆 *Yangi yutuq!*\n👤 ${student.fullName}\n🎯 ${title}\n⭐ +${points} ball\n📱 SMS: ${result.success ? '✅' : '❌'}`
      );
    }

    res.status(201).json({ success: true, data: achievement });
  } catch (err) { next(err); }
};

exports.getStudentAchievements = async (req, res, next) => {
  try {
    const achievements = await prisma.achievement.findMany({ where: { studentId: req.params.studentId }, orderBy: { createdAt: 'desc' } });
    const totalPoints = achievements.reduce((sum, a) => sum + a.points, 0);
    res.json({ success: true, data: { achievements, totalPoints } });
  } catch (err) { next(err); }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({
      where: { status: 'ACTIVE', totalPoints: { gt: 0 } },
      include: { group: { include: { course: true } } },
      orderBy: { totalPoints: 'desc' }, take: 20,
    });
    res.json({ success: true, data: students });
  } catch (err) { next(err); }
};

// ==================== DASHBOARD ====================
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [studentStats, paymentStats, leadTotal, leadByStatus, leadBySource, debtors, groups, courses, monthlyRevenue, expenses] = await Promise.all([
      prisma.student.aggregate({ _count: true, _avg: { progress: true }, where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: thisMonthStart } } }),
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.$queryRaw`SELECT source, COUNT(*)::int as count, SUM(CASE WHEN status='CONVERTED' THEN 1 ELSE 0 END)::int as converted FROM leads GROUP BY source`,
      prisma.student.findMany({ where: { balance: { lt: 0 }, status: 'ACTIVE' }, include: { group: { include: { course: true } } }, orderBy: { balance: 'asc' }, take: 10 }),
      prisma.group.findMany({ where: { isActive: true }, include: { course: true, teacher: true, _count: { select: { students: { where: { status: 'ACTIVE' } } } } } }),
      prisma.course.findMany({ where: { isActive: true }, include: { _count: { select: { groups: true } }, groups: { include: { _count: { select: { students: true } } } } } }),
      prisma.$queryRaw`SELECT TO_CHAR(payment_date, 'YYYY-MM') as month, SUM(amount) as revenue FROM payments GROUP BY TO_CHAR(payment_date, 'YYYY-MM') ORDER BY month DESC LIMIT 12`,
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: thisMonthStart } } }),
    ]);

    const converted = leadByStatus.find(s => s.status === 'CONVERTED')?._count || 0;
    const totalStudents = await prisma.student.count();
    const inactiveStudents = await prisma.student.count({ where: { status: 'INACTIVE' } });
    const debtorCount = await prisma.student.count({ where: { balance: { lt: 0 } } });

    res.json({
      success: true,
      data: {
        students: { total: totalStudents, active: studentStats._count, inactive: inactiveStudents, avgProgress: Math.round(studentStats._avg.progress || 0), debtors: debtorCount },
        payments: { thisMonth: paymentStats._sum.amount || 0, expenses: expenses._sum.amount || 0, profit: (paymentStats._sum.amount || 0) - (expenses._sum.amount || 0) },
        leads: { total: leadTotal, byStatus: leadByStatus.map(s => ({ status: s.status, count: s._count })), bySource: leadBySource, conversionRate: leadTotal > 0 ? Math.round((converted / leadTotal) * 100) : 0 },
        debtors, groups: groups.map(g => ({ ...g, studentCount: g._count.students })),
        courses: courses.map(c => ({ ...c, groupCount: c._count.groups, studentCount: c.groups.reduce((s, g) => s + g._count.students, 0) })),
        monthlyRevenue: monthlyRevenue.map(m => ({ ...m, revenue: Number(m.revenue) })),
      },
    });
  } catch (err) { next(err); }
};
