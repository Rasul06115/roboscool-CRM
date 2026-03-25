const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

// Storage konfiguratsiyasi
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.uploadType || 'documents';
    cb(null, path.join(UPLOAD_DIR, type));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

// Fayl turi filtri
const fileFilter = (req, file, cb) => {
  const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedDocs = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const allowed = [...allowedImages, ...allowedDocs];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Ruxsat berilmagan fayl turi: ${file.mimetype}`), false);
  }
};

// Avatar yuklash
const uploadAvatar = (req, res, next) => {
  req.uploadType = 'avatars';
  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Faqat rasm fayllari ruxsat etilgan'), false);
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }).single('avatar');

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Yuklash xatosi: ${err.message}` });
    }
    if (err) return res.status(400).json({ success: false, error: err.message });
    next();
  });
};

// Hujjat yuklash
const uploadDocument = (req, res, next) => {
  req.uploadType = 'documents';
  const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } }).single('document');

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Yuklash xatosi: ${err.message}` });
    }
    if (err) return res.status(400).json({ success: false, error: err.message });
    next();
  });
};

// Ko'p fayllarni yuklash
const uploadMultiple = (req, res, next) => {
  req.uploadType = 'documents';
  const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } }).array('files', 5);

  upload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    next();
  });
};

module.exports = { uploadAvatar, uploadDocument, uploadMultiple };
