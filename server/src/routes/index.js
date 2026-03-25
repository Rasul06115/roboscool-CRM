const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { authValidation, studentValidation, paymentValidation, leadValidation } = require('../middleware/validation');
const { uploadAvatar, uploadDocument } = require('../middleware/upload');

const authCtrl = require('../controllers/authController');
const studentCtrl = require('../controllers/studentController');
const cgCtrl = require('../controllers/courseGroupController');
const paymentCtrl = require('../controllers/paymentController');
const leadCtrl = require('../controllers/leadController');
const attCtrl = require('../controllers/attendanceController');
const sfCtrl = require('../controllers/smsFileController');

// ==================== AUTH ====================
router.post('/auth/login', authValidation.login, authCtrl.login);
router.post('/auth/refresh', authCtrl.refreshToken);

// ==================== HIMOYALANGAN ====================
router.use(authenticate);

router.get('/auth/me', authCtrl.getMe);
router.put('/auth/password', authCtrl.changePassword);
router.post('/auth/register', authorize('ADMIN'), authValidation.register, authCtrl.register);

// Dashboard
router.get('/dashboard/overview', attCtrl.getDashboard);

// Students
router.get('/students/stats', studentCtrl.getStats);
router.get('/students/debtors', studentCtrl.getDebtors);
router.get('/students', studentCtrl.getAll);
router.get('/students/:id', studentCtrl.getById);
router.post('/students', studentValidation.create, studentCtrl.create);
router.put('/students/:id', studentValidation.update, studentCtrl.update);
router.delete('/students/:id', authorize('ADMIN', 'MANAGER'), studentCtrl.delete);

// Courses
router.get('/courses', cgCtrl.getAllCourses);
router.get('/courses/:id', cgCtrl.getCourseById);
router.post('/courses', authorize('ADMIN'), cgCtrl.createCourse);
router.put('/courses/:id', authorize('ADMIN'), cgCtrl.updateCourse);
router.delete('/courses/:id', authorize('ADMIN'), cgCtrl.deleteCourse);

// Groups
router.get('/groups', cgCtrl.getAllGroups);
router.get('/groups/:id', cgCtrl.getGroupById);
router.post('/groups', authorize('ADMIN', 'MANAGER'), cgCtrl.createGroup);
router.put('/groups/:id', authorize('ADMIN', 'MANAGER'), cgCtrl.updateGroup);
router.delete('/groups/:id', authorize('ADMIN'), cgCtrl.deleteGroup);

// Payments
router.get('/payments/stats', paymentCtrl.getStats);
router.get('/payments', paymentCtrl.getAll);
router.post('/payments', paymentValidation.create, paymentCtrl.create);
router.delete('/payments/:id', authorize('ADMIN'), paymentCtrl.delete);

// Leads
router.get('/leads/stats', leadCtrl.getStats);
router.get('/leads', leadCtrl.getAll);
router.get('/leads/:id', leadCtrl.getById);
router.post('/leads', leadValidation.create, leadCtrl.create);
router.put('/leads/:id', leadCtrl.update);
router.delete('/leads/:id', leadCtrl.delete);

// Attendance (Davomat)
router.get('/attendance', attCtrl.getAttendance);
router.post('/attendance', attCtrl.markAttendance);
router.post('/attendance/bulk', attCtrl.markBulkAttendance);
router.get('/attendance/student/:studentId', attCtrl.getStudentAttendance);

// Achievements (Ball / Yutuqlar)
router.post('/achievements', attCtrl.addAchievement);
router.get('/achievements/student/:studentId', attCtrl.getStudentAchievements);
router.get('/achievements/leaderboard', attCtrl.getLeaderboard);

// SMS
router.post('/sms/send', authorize('ADMIN', 'MANAGER'), sfCtrl.sendSms);
router.post('/sms/reminders', authorize('ADMIN'), sfCtrl.sendPaymentReminders);
router.get('/sms/logs', authorize('ADMIN'), sfCtrl.getSmsLogs);

// Files
router.post('/files/upload', uploadDocument, sfCtrl.uploadFile);
router.post('/files/avatar', uploadAvatar, sfCtrl.uploadFile);
router.get('/files', sfCtrl.getFiles);
router.delete('/files/:id', sfCtrl.deleteFile);

module.exports = router;
