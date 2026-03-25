const prisma = require('../config/prisma');
const telegramService = require('../services/telegramService');
const smsService = require('../services/smsService');

exports.getAll = async (req, res, next) => {
  try {
    const { search, status, source, page = 1, limit = 50 } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { interest: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (source) where.source = source;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: Number(limit) }),
      prisma.lead.count({ where }),
    ]);

    res.json({ success: true, data: leads, total });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ success: false, error: 'Lead topilmadi' });
    res.json({ success: true, data: lead });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const lead = await prisma.lead.create({ data: req.body });

    // Telegram bildirishnoma
    telegramService.notifyNewLead(lead.fullName, lead.phone, lead.source, lead.interest);

    res.status(201).json({ success: true, data: lead });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });

    // Agar sinov darsi belgilangan bo'lsa — SMS yuborish
    if (req.body.status === 'TRIAL_SCHEDULED' && req.body.trialDate) {
      const date = new Date(req.body.trialDate).toLocaleDateString('uz-UZ');
      smsService.sendSms(lead.phone, smsService.templates.trialReminder(lead.fullName, date, '14:00'));
    }

    res.json({ success: true, data: lead });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Lead o'chirildi" });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const [total, byStatus, bySource] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.$queryRaw`
        SELECT source, COUNT(*)::int as count,
          SUM(CASE WHEN status = 'CONVERTED' THEN 1 ELSE 0 END)::int as converted
        FROM leads GROUP BY source
      `,
    ]);

    const converted = byStatus.find(s => s.status === 'CONVERTED')?._count || 0;

    res.json({
      success: true,
      data: {
        total,
        byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
        bySource,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      },
    });
  } catch (err) { next(err); }
};
