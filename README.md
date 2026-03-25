# 🤖 RoboSchool CRM v2.0 — Professional Edition

O'quv markazi uchun to'liq professional CRM tizimi.

## 🛠 Texnologiyalar

| Qatlam | Texnologiya |
|--------|------------|
| **Database** | PostgreSQL + Prisma ORM |
| **Backend** | Node.js + Express.js |
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Auth** | JWT (Access + Refresh Token) |
| **Bot** | Telegram Bot API |
| **SMS** | Eskiz.uz API |
| **Files** | Multer + Sharp |
| **Cron** | node-cron (avtomatik eslatmalar) |
| **Logger** | Winston |

## 🚀 O'rnatish

### 1. PostgreSQL o'rnatish

**Lokal:**
```bash
# PostgreSQL o'rnatish (Windows — pgAdmin, Mac — brew install postgresql)
# Database yaratish:
createdb roboschool_crm
```

**Yoki bulut servislar (bepul):**
- [Neon](https://neon.tech) — eng oson
- [Supabase](https://supabase.com) — PostgreSQL + extras
- [Railway](https://railway.app) — avtomatik deploy

### 2. Loyihani sozlash

```bash
# Klonlash
git clone <repo-url>
cd roboschool-crm

# Barcha paketlarni o'rnatish
npm run install:all
```

### 3. Environment sozlash

`server/.env` faylini tahrirlang:

```env
# DATABASE — PostgreSQL ulanish
DATABASE_URL="postgresql://postgres:password@localhost:5432/roboschool_crm"

# JWT — production uchun o'zgartiring!
JWT_SECRET=sizning_maxfiy_kalitingiz

# TELEGRAM BOT (ixtiyoriy)
# 1. @BotFather da bot yarating
# 2. Token ni bu yerga qo'ying
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_CHAT_ID=123456789

# SMS — Eskiz.uz (ixtiyoriy)
# https://eskiz.uz da ro'yxatdan o'ting
SMS_EMAIL=your@email.com
SMS_PASSWORD=your_password
```

### 4. Database migrate va seed

```bash
# Jadvallarni yaratish
npm run db:migrate

# Demo ma'lumotlarni kiritish
npm run db:seed

# Database ni brauzerda ko'rish (ixtiyoriy)
npm run db:studio
```

### 5. Ishga tushirish

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Prisma Studio:** `npm run db:studio` → http://localhost:5555

### 6. Login

```
Email: admin@roboschool.uz
Parol: admin123
```

## 📁 Loyiha Strukturasi

```
roboschool-crm/
├── package.json                    # Monorepo
│
├── server/                         # 🔧 BACKEND
│   ├── .env                        # Maxfiy sozlamalar
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma           # ⭐ Database schema (barcha jadvallar)
│   │   └── seed.js                 # Demo ma'lumotlar
│   ├── uploads/                    # Yuklangan fayllar
│   │   ├── avatars/
│   │   └── documents/
│   └── src/
│       ├── app.js                  # ⭐ Express server
│       ├── config/
│       │   ├── prisma.js           # Prisma client
│       │   └── logger.js           # Winston logger
│       ├── middleware/
│       │   ├── auth.js             # 🔐 JWT authenticate + authorize
│       │   ├── upload.js           # 📁 Multer file upload
│       │   ├── validation.js       # ✅ express-validator
│       │   └── errorHandler.js     # ❌ Global error handler
│       ├── controllers/
│       │   ├── authController.js           # Login, Register, Refresh
│       │   ├── studentController.js        # CRUD + Stats + Debtors
│       │   ├── courseGroupController.js     # Courses + Groups CRUD
│       │   ├── paymentController.js        # Payments + Balance + Stats
│       │   ├── leadController.js           # Leads + Conversion
│       │   ├── dashboardAttendanceController.js  # Dashboard + Attendance
│       │   └── smsFileController.js        # SMS send + File upload
│       ├── services/
│       │   ├── telegramService.js  # 🤖 Telegram Bot
│       │   └── smsService.js       # 📱 Eskiz SMS
│       ├── jobs/
│       │   └── scheduler.js        # ⏰ Cron jobs
│       └── routes/
│           └── index.js            # Barcha API routes
│
└── client/                         # 🎨 FRONTEND
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                 # Routing + Layout + Auth Guard
        ├── context/
        │   └── AuthContext.jsx     # 🔐 Auth state management
        ├── utils/
        │   ├── api.js              # Axios + JWT interceptors
        │   └── helpers.js
        └── components/
            ├── Auth/Login.jsx      # 🔑 Login sahifasi
            ├── Dashboard/          # 📊 Boshqaruv paneli
            ├── Students/           # 👨‍🎓 O'quvchilar CRUD
            ├── Courses/            # 📚 Kurslar va guruhlar
            ├── Finance/            # 💰 To'lovlar
            ├── Leads/              # 📞 Leadlar
            └── Reports/            # 📈 Hisobotlar
```

## 🔌 API Endpoints

### Auth (ochiq)
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| POST | `/api/auth/login` | Tizimga kirish |
| POST | `/api/auth/refresh` | Token yangilash |

### Himoyalangan (JWT talab qilinadi)
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/api/dashboard/overview` | Umumiy statistika |
| GET/POST | `/api/students` | O'quvchilar |
| GET/PUT/DELETE | `/api/students/:id` | O'quvchi boshqaruv |
| GET | `/api/students/debtors` | Qarzdorlar |
| GET/POST | `/api/courses` | Kurslar |
| GET/POST | `/api/groups` | Guruhlar |
| GET/POST | `/api/payments` | To'lovlar |
| GET | `/api/payments/stats` | Moliyaviy statistika |
| GET/POST | `/api/leads` | Leadlar |
| GET | `/api/leads/stats` | Konversiya statistikasi |
| POST | `/api/attendance` | Davomat belgilash |
| POST | `/api/sms/send` | SMS yuborish |
| POST | `/api/sms/reminders` | Qarz eslatmalari |
| POST | `/api/files/upload` | Fayl yuklash |

## 🤖 Telegram Bot buyruqlari

Bot ishga tushgandan keyin:
- `/start` — Boshlash va chat ID olish
- `/stats` — Statistika
- `/debtors` — Qarzdorlar ro'yxati

**Avtomatik bildirishnomalar:**
- Yangi to'lov qabul qilinganda
- Yangi lead kelganda
- Har kuni soat 20:00 da kunlik hisobot

## 📱 SMS integratsiya

Eskiz.uz orqali:
- To'lov eslatmalari (har oyning 1-sanasi)
- Qarz eslatmalari (har kuni soat 10:00)
- Sinov darsi eslatmasi (lead statusini o'zgartirganda)
- Xush kelibsiz xabar (yangi o'quvchi)

## 🔐 Rollar

| Rol | Huquqlar |
|-----|----------|
| **ADMIN** | Barcha amallar, foydalanuvchi qo'shish, o'chirish |
| **MANAGER** | O'quvchi, to'lov, lead boshqaruvi |
| **TEACHER** | Davomat belgilash, guruh ko'rish |

## 📝 Litsenziya

MIT © 2026 RoboSchool
