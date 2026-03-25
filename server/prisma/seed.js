const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Eski ma\'lumotlar tozalanmoqda...\n');

  // Eski ma'lumotlarni o'chirish (duplikat bo'lmasligi uchun)
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.student.deleteMany();
  await prisma.group.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.course.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.notificationLog.deleteMany();

  console.log('🌱 Demo ma\'lumotlar kiritilmoqda...\n');

  // ==================== ADMIN USER ====================
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@roboschool.uz' },
    update: {},
    create: {
      email: 'admin@roboschool.uz',
      password: hashedPassword,
      fullName: 'Admin Roboschool',
      phone: '+998901234567',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin yaratildi:', admin.email);

  // ==================== KURSLAR ====================
  const coursesData = [
    { name: 'Scratch Jr', icon: '🧩', color: '#FF6B35', ageRange: '7-9', duration: '3 oy', price: 400000, description: "Boshlang'ich dasturlash" },
    { name: 'Arduino', icon: '⚡', color: '#00A6A6', ageRange: '12-16', duration: '6 oy', price: 500000, description: 'Elektronika va robotika' },
    { name: 'Lego Robotics', icon: '🤖', color: '#E63946', ageRange: '8-12', duration: '4 oy', price: 450000, description: 'LEGO robot yaratish' },
    { name: 'Python', icon: '🐍', color: '#2EC4B6', ageRange: '13-17', duration: '6 oy', price: 500000, description: 'Python dasturlash tili' },
    { name: '3D Modeling', icon: '🎨', color: '#9B5DE5', ageRange: '10-15', duration: '4 oy', price: 450000, description: '3D dizayn va print' },
  ];

  const courses = [];
  for (const c of coursesData) {
    const course = await prisma.course.create({ data: c });
    courses.push(course);
  }
  console.log(`✅ ${courses.length} ta kurs kiritildi`);

  // ==================== O'QITUVCHILAR ====================
  const teachersData = [
    { fullName: 'Jamshid Kamolov', phone: '+998901111111', specialization: 'Scratch, Blockly', salary: 3000000 },
    { fullName: 'Sardor Yusupov', phone: '+998902222222', specialization: 'Arduino, Elektronika', salary: 3500000 },
    { fullName: 'Nilufar Ahmedova', phone: '+998903333333', specialization: 'Lego Robotics', salary: 3000000 },
    { fullName: 'Alisher Rahmatov', phone: '+998904444444', specialization: 'Python, AI', salary: 4000000 },
    { fullName: 'Madina Sobirov', phone: '+998905555555', specialization: '3D Modeling, CAD', salary: 3500000 },
  ];

  const teachers = [];
  for (const t of teachersData) {
    const teacher = await prisma.teacher.create({ data: t });
    teachers.push(teacher);
  }
  console.log(`✅ ${teachers.length} ta o'qituvchi kiritildi`);

  // ==================== GURUHLAR ====================
  const groupsData = [
    { name: 'Scratch-A1', courseId: courses[0].id, teacherId: teachers[0].id, schedule: 'Du-Cho 14:00', maxSize: 12 },
    { name: 'Arduino-B1', courseId: courses[1].id, teacherId: teachers[1].id, schedule: 'Se-Pay 15:00', maxSize: 10 },
    { name: 'Lego-C1', courseId: courses[2].id, teacherId: teachers[2].id, schedule: 'Du-Cho 16:00', maxSize: 12 },
    { name: 'Python-D1', courseId: courses[3].id, teacherId: teachers[3].id, schedule: 'Se-Pay 14:00', maxSize: 10 },
    { name: '3D-E1', courseId: courses[4].id, teacherId: teachers[4].id, schedule: 'Du-Cho 10:00', maxSize: 8 },
  ];

  const groups = [];
  for (const g of groupsData) {
    const group = await prisma.group.create({ data: g });
    groups.push(group);
  }
  console.log(`✅ ${groups.length} ta guruh kiritildi`);

  // ==================== O'QUVCHILAR (yangilangan) ====================
  const studentsData = [
    { fullName: 'Aziz Karimov', age: 12, metrikaNumber: 'I-TM 1234567', fatherName: 'Karim Karimov', fatherPhone: '+998901234567', motherName: 'Nodira Karimova', motherPhone: '+998901234568', parentPhone: '+998901234567', groupId: groups[0].id, balance: 200000, progress: 78 },
    { fullName: 'Malika Rahimova', age: 10, metrikaNumber: 'I-TM 2345678', fatherName: 'Sardor Rahimov', fatherPhone: '+998935551122', motherName: 'Gulnora Rahimova', motherPhone: '+998935551123', parentPhone: '+998935551122', groupId: groups[0].id, balance: -150000, progress: 85 },
    { fullName: 'Jasur Toshmatov', age: 14, metrikaNumber: 'I-TM 3456789', fatherName: 'Dilshod Toshmatov', fatherPhone: '+998977778899', motherName: 'Barno Toshmatova', motherPhone: '+998977778800', parentPhone: '+998977778899', groupId: groups[1].id, balance: 400000, progress: 92 },
    { fullName: 'Sevara Usmanova', age: 11, metrikaNumber: 'I-TM 4567890', fatherName: 'Rustam Usmanov', fatherPhone: '+998911112233', motherName: 'Gulnora Usmanova', motherPhone: '+998911112234', parentPhone: '+998911112233', groupId: groups[2].id, balance: 0, progress: 65 },
    { fullName: 'Bobur Aliyev', age: 13, metrikaNumber: 'I-TM 5678901', fatherName: 'Anvar Aliyev', fatherPhone: '+998944445566', motherName: 'Zarina Aliyeva', motherPhone: '+998944445567', parentPhone: '+998944445566', groupId: groups[1].id, balance: 400000, progress: 88 },
    { fullName: 'Nilufar Qodirova', age: 9, metrikaNumber: 'I-TM 6789012', fatherName: 'Akbar Qodirov', fatherPhone: '+998903334455', motherName: 'Zulfiya Qodirova', motherPhone: '+998903334456', parentPhone: '+998903334455', groupId: groups[3].id, balance: -300000, progress: 45 },
    { fullName: 'Sherzod Mirzayev', age: 15, metrikaNumber: 'I-TM 7890123', fatherName: 'Hamid Mirzayev', fatherPhone: '+998916667788', motherName: 'Dilrabo Mirzayeva', motherPhone: '+998916667789', parentPhone: '+998916667788', groupId: groups[4].id, balance: 500000, progress: 95 },
    { fullName: 'Kamola Nazarova', age: 12, metrikaNumber: 'I-TM 8901234', fatherName: 'Jamshid Nazarov', fatherPhone: '+998928889900', motherName: 'Barno Nazarova', motherPhone: '+998928889901', parentPhone: '+998928889900', groupId: groups[2].id, balance: 200000, progress: 72 },
    { fullName: 'Temur Xasanov', age: 11, metrikaNumber: 'I-TM 9012345', fatherName: 'Rustam Xasanov', fatherPhone: '+998950001122', motherName: 'Shoira Xasanova', motherPhone: '+998950001123', parentPhone: '+998950001122', groupId: groups[3].id, balance: -150000, progress: 58, status: 'INACTIVE' },
    { fullName: 'Dildora Ergasheva', age: 13, metrikaNumber: 'I-TM 0123456', fatherName: 'Saidakbar Ergashev', fatherPhone: '+998962223344', motherName: 'Shoira Ergasheva', motherPhone: '+998962223345', parentPhone: '+998962223344', groupId: groups[4].id, balance: 400000, progress: 82 },
  ];

  const students = [];
  for (const s of studentsData) {
    const student = await prisma.student.create({ data: s });
    students.push(student);
  }
  console.log(`✅ ${students.length} ta o'quvchi kiritildi`);

  // ==================== TO'LOVLAR ====================
  const paymentsData = [
    { studentId: students[0].id, amount: 400000, paymentMethod: 'CASH', paymentDate: new Date('2026-02-01'), monthFor: '2026-02', note: 'Fevral oyi' },
    { studentId: students[2].id, amount: 500000, paymentMethod: 'CLICK', paymentDate: new Date('2026-02-01'), monthFor: '2026-02', note: 'Fevral oyi' },
    { studentId: students[4].id, amount: 500000, paymentMethod: 'PAYME', paymentDate: new Date('2026-02-03'), monthFor: '2026-02', note: 'Fevral oyi' },
    { studentId: students[6].id, amount: 450000, paymentMethod: 'CASH', paymentDate: new Date('2026-02-05'), monthFor: '2026-02', note: 'Fevral oyi' },
    { studentId: students[7].id, amount: 450000, paymentMethod: 'CLICK', paymentDate: new Date('2026-02-05'), monthFor: '2026-02', note: 'Fevral oyi' },
    { studentId: students[9].id, amount: 450000, paymentMethod: 'PAYME', paymentDate: new Date('2026-02-07'), monthFor: '2026-02', note: 'Fevral oyi' },
    { studentId: students[0].id, amount: 400000, paymentMethod: 'CASH', paymentDate: new Date('2026-01-02'), monthFor: '2026-01', note: 'Yanvar oyi' },
    { studentId: students[2].id, amount: 500000, paymentMethod: 'CLICK', paymentDate: new Date('2026-01-03'), monthFor: '2026-01', note: 'Yanvar oyi' },
  ];

  for (const p of paymentsData) await prisma.payment.create({ data: p });
  console.log(`✅ ${paymentsData.length} ta to'lov kiritildi`);

  // ==================== LEADLAR ====================
  const leadsData = [
    { fullName: 'Otabek Saidov', phone: '+998901112233', source: 'INSTAGRAM', interest: 'Arduino', status: 'NEW' },
    { fullName: 'Gulbahor Tursunova', phone: '+998934445566', source: 'TELEGRAM', interest: 'Scratch Jr', status: 'TRIAL_SCHEDULED', trialDate: new Date('2026-03-05'), notes: "9 yoshli o'g'li uchun" },
    { fullName: 'Mirzo Karimov', phone: '+998917778899', source: 'REFERRAL', interest: 'Python', status: 'TRIAL_DONE', trialDate: new Date('2026-02-20'), notes: 'Juda qiziqdi' },
    { fullName: 'Shahlo Abdullayeva', phone: '+998940001122', source: 'INSTAGRAM', interest: 'Lego Robotics', status: 'CONVERTED', trialDate: new Date('2026-02-15') },
    { fullName: 'Baxtiyor Umarov', phone: '+998952223344', source: 'TELEGRAM', interest: '3D Modeling', status: 'LOST', lossReason: 'Narx qimmat' },
    { fullName: 'Laylo Xolmatova', phone: '+998963334455', source: 'INSTAGRAM', interest: 'Scratch Jr', status: 'NEW' },
    { fullName: 'Farrux Normatov', phone: '+998905556677', source: 'REFERRAL', interest: 'Arduino', status: 'TRIAL_SCHEDULED', trialDate: new Date('2026-03-07') },
  ];

  for (const l of leadsData) await prisma.lead.create({ data: l });
  console.log(`✅ ${leadsData.length} ta lead kiritildi`);

  // ==================== XARAJATLAR ====================
  const expensesData = [
    { category: 'RENT', amount: 5000000, description: "Fevral oyi ijara", expenseDate: new Date('2026-02-01') },
    { category: 'SALARY', amount: 17000000, description: "O'qituvchilar oyligi", expenseDate: new Date('2026-02-05') },
    { category: 'EQUIPMENT', amount: 2000000, description: "Arduino to'plamlari", expenseDate: new Date('2026-02-10') },
    { category: 'MARKETING', amount: 500000, description: "Instagram reklama", expenseDate: new Date('2026-02-15') },
  ];

  for (const e of expensesData) await prisma.expense.create({ data: e });
  console.log(`✅ ${expensesData.length} ta xarajat kiritildi`);

  console.log('\n🎉 Barcha demo ma\'lumotlar muvaffaqiyatli kiritildi!');
  console.log('\n📌 Admin login:');
  console.log('   Email: admin@roboschool.uz');
  console.log('   Parol: admin123');
}

main()
  .catch((e) => { console.error('❌ Xatolik:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
