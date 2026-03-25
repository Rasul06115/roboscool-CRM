const prisma = require('../config/prisma');

// ==================== COURSES ====================
exports.getAllCourses = async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { groups: true } },
        groups: { where: { isActive: true }, include: { _count: { select: { students: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    const data = courses.map(c => ({
      ...c,
      groupCount: c._count.groups,
      studentCount: c.groups.reduce((sum, g) => sum + g._count.students, 0),
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id }, include: { groups: { include: { teacher: true, _count: { select: { students: true } } } } } });
    if (!course) return res.status(404).json({ success: false, error: 'Kurs topilmadi' });
    res.json({ success: true, data: course });
  } catch (err) { next(err); }
};

exports.createCourse = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await prisma.course.create({ data: req.body }) }); }
  catch (err) { next(err); }
};

exports.updateCourse = async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.course.update({ where: { id: req.params.id }, data: req.body }) }); }
  catch (err) { next(err); }
};

exports.deleteCourse = async (req, res, next) => {
  try { await prisma.course.update({ where: { id: req.params.id }, data: { isActive: false } }); res.json({ success: true }); }
  catch (err) { next(err); }
};

// ==================== GROUPS ====================
exports.getAllGroups = async (req, res, next) => {
  try {
    const where = { isActive: true };
    if (req.query.courseId) where.courseId = req.query.courseId;

    const groups = await prisma.group.findMany({
      where,
      include: { course: true, teacher: true, _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
      orderBy: { name: 'asc' },
    });

    const data = groups.map(g => ({ ...g, studentCount: g._count.students }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getGroupById = async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { course: true, teacher: true, students: { where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' } } },
    });
    if (!group) return res.status(404).json({ success: false, error: 'Guruh topilmadi' });
    res.json({ success: true, data: group });
  } catch (err) { next(err); }
};

exports.createGroup = async (req, res, next) => {
  try {
    const group = await prisma.group.create({ data: req.body, include: { course: true, teacher: true } });
    res.status(201).json({ success: true, data: group });
  } catch (err) { next(err); }
};

exports.updateGroup = async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.group.update({ where: { id: req.params.id }, data: req.body, include: { course: true, teacher: true } }) }); }
  catch (err) { next(err); }
};

exports.deleteGroup = async (req, res, next) => {
  try { await prisma.group.update({ where: { id: req.params.id }, data: { isActive: false } }); res.json({ success: true }); }
  catch (err) { next(err); }
};
