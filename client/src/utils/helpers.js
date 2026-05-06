export const formatMoney = (n) => { if (!n && n !== 0) return '0'; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
export const formatDate = (d) => { if (!d) return '—'; return new Date(d).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' }); };
export const getLeadStatusInfo = (s) => { const m = { NEW: { l: 'Yangi', c: 'bg-blue-50 text-blue-700' }, CONTACTED: { l: 'Bog\'lanildi', c: 'bg-cyan-50 text-cyan-700' }, TRIAL_SCHEDULED: { l: 'Sinov belgilangan', c: 'bg-yellow-50 text-yellow-700' }, TRIAL_DONE: { l: "Sinov o'tdi", c: 'bg-purple-50 text-purple-700' }, CONVERTED: { l: "O'quvchi bo'ldi", c: 'bg-green-50 text-green-700' }, LOST: { l: "Yo'qolgan", c: 'bg-red-50 text-red-700' } }; return m[s] || m.NEW; };
export const getPaymentMethodLabel = (m) => ({ CASH: 'Naqd', CLICK: 'Click', PAYME: 'Payme', BANK_TRANSFER: "Bank o'tkazmasi" }[m] || m);
export const getSourceColor = (s) => ({ INSTAGRAM: 'bg-pink-50 text-pink-700', TELEGRAM: 'bg-blue-50 text-blue-700', REFERRAL: 'bg-green-50 text-green-700', WEBSITE: 'bg-purple-50 text-purple-700', OTHER: 'bg-gray-50 text-gray-700' }[s] || 'bg-gray-50 text-gray-700');

// ==================== BALL TIZIMI ====================

// Yutuq turlari va standart ballari
export const ACHIEVEMENT_TYPES = [
  { value: 'HOMEWORK', label: '📝 Uy vazifa', icon: '📝', defaultPoints: 2, color: 'blue' },
  { value: 'PROJECT', label: '🏆 Loyiha ishi', icon: '🏆', defaultPoints: 3, color: 'purple', minPoints: 2, maxPoints: 5 },
  { value: 'ACTIVITY', label: '🙋 Darsda faollik', icon: '🙋', defaultPoints: 2, color: 'green' },
  { value: 'PARENT_ACTIVITY', label: '👨‍👩‍👦 Ota-ona aktivligi', icon: '👨‍👩‍👦', defaultPoints: 3, color: 'cyan' },
  { value: 'CONTEST_WIN', label: '🥇 Musobaqa g\'alabasi', icon: '🥇', defaultPoints: 10, color: 'yellow' },
  { value: 'GOOD_BEHAVIOR', label: '⭐ Yaxshi xulq', icon: '⭐', defaultPoints: 2, color: 'amber' },
  { value: 'ATTENDANCE_STREAK', label: '📅 Muntazam davomat', icon: '📅', defaultPoints: 5, color: 'teal' },
  { value: 'PENALTY', label: '⛔ Jazo', icon: '⛔', defaultPoints: -3, color: 'red' },
  { value: 'OTHER', label: '🎯 Boshqa', icon: '🎯', defaultPoints: 1, color: 'gray' },
];

// O'quvchi darajasi
export const STUDENT_LEVELS = [
  { name: 'Beginner', emoji: '🟢', min: 0, max: 50, color: '#22C55E', bg: 'bg-green-50 text-green-700', description: 'Yangi kelgan' },
  { name: 'Junior', emoji: '🔵', min: 51, max: 150, color: '#3B82F6', bg: 'bg-blue-50 text-blue-700', description: "Asoslarni o'zlashtiryapti" },
  { name: 'Middle', emoji: '🟡', min: 151, max: 300, color: '#EAB308', bg: 'bg-yellow-50 text-yellow-700', description: 'Mustaqil ishlaydi' },
  { name: 'Senior', emoji: '🟠', min: 301, max: 500, color: '#F97316', bg: 'bg-orange-50 text-orange-700', description: "Boshqalarni yo'naltiradi" },
  { name: 'Master', emoji: '🔴', min: 501, max: Infinity, color: '#EF4444', bg: 'bg-red-50 text-red-700', description: "Namuna o'quvchi" },
];

// Ball bo'yicha darajani aniqlash
export const getStudentLevel = (totalPoints) => {
  const points = totalPoints || 0;
  return STUDENT_LEVELS.find(l => points >= l.min && points <= l.max) || STUDENT_LEVELS[0];
};

// Keyingi darajagacha qolgan ball
export const getPointsToNextLevel = (totalPoints) => {
  const points = totalPoints || 0;
  const currentLevel = getStudentLevel(points);
  const currentIndex = STUDENT_LEVELS.indexOf(currentLevel);
  if (currentIndex >= STUDENT_LEVELS.length - 1) return { next: null, remaining: 0, progress: 100 };
  const nextLevel = STUDENT_LEVELS[currentIndex + 1];
  const remaining = nextLevel.min - points;
  const rangeTotal = currentLevel.max - currentLevel.min + 1;
  const rangeProgress = points - currentLevel.min;
  const progress = Math.round((rangeProgress / rangeTotal) * 100);
  return { next: nextLevel, remaining, progress };
};

// Daraja badge komponenti uchun ma'lumot
export const getLevelBadge = (totalPoints) => {
  const level = getStudentLevel(totalPoints);
  return `${level.emoji} ${level.name}`;
};
