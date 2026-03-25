const { body, validationResult } = require('express-validator');

// Validatsiya natijalarini tekshirish
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validatsiya xatosi',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ==================== VALIDATSIYA QOIDALARI ====================

const authValidation = {
  login: [
    body('email').isEmail().withMessage("Noto'g'ri email format"),
    body('password').isLength({ min: 6 }).withMessage('Parol kamida 6 ta belgidan iborat bo\'lishi kerak'),
    validate,
  ],
  register: [
    body('email').isEmail().withMessage("Noto'g'ri email format"),
    body('password').isLength({ min: 6 }).withMessage('Parol kamida 6 ta belgidan iborat bo\'lishi kerak'),
    body('fullName').notEmpty().withMessage('Ism kiritilishi shart'),
    validate,
  ],
};

const studentValidation = {
  create: [
    body('fullName').notEmpty().withMessage('Ism kiritilishi shart'),
    body('parentPhone').notEmpty().withMessage('Telefon kiritilishi shart')
      .matches(/^\+998\d{9}$/).withMessage("Telefon formati: +998XXXXXXXXX"),
    body('age').optional().isInt({ min: 5, max: 25 }).withMessage('Yosh 5-25 orasida bo\'lishi kerak'),
    validate,
  ],
  update: [
    body('fullName').optional().notEmpty().withMessage('Ism bo\'sh bo\'lishi mumkin emas'),
    body('parentPhone').optional().matches(/^\+998\d{9}$/).withMessage("Telefon formati: +998XXXXXXXXX"),
    validate,
  ],
};

const paymentValidation = {
  create: [
    body('studentId').notEmpty().withMessage("O'quvchi tanlanishi shart"),
    body('amount').isInt({ min: 1000 }).withMessage("Summa kamida 1000 so'm bo'lishi kerak"),
    body('paymentMethod').isIn(['CASH', 'CLICK', 'PAYME', 'BANK_TRANSFER']).withMessage("Noto'g'ri to'lov usuli"),
    validate,
  ],
};

const leadValidation = {
  create: [
    body('fullName').notEmpty().withMessage('Ism kiritilishi shart'),
    body('phone').notEmpty().withMessage('Telefon kiritilishi shart')
      .matches(/^\+998\d{9}$/).withMessage("Telefon formati: +998XXXXXXXXX"),
    body('source').isIn(['INSTAGRAM', 'TELEGRAM', 'REFERRAL', 'WEBSITE', 'FACEBOOK', 'OTHER']).withMessage("Noto'g'ri manba"),
    validate,
  ],
};

module.exports = {
  validate,
  authValidation,
  studentValidation,
  paymentValidation,
  leadValidation,
};
