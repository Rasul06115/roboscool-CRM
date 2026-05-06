const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Tozalanmoqda...\n');
  await prisma.achievement.deleteMany();
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

  console.log('🌱 Demo ma\'lumotlar...\n');

  const hashedPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@roboschool.uz' },
    update: {},
    create: { email: 'admin@roboschool.uz', password: hashedPassword, fullName: 'Admin Roboschool', phone: '+998901234567', role: 'ADMIN' },
  });
  console.log('✅ Admin yaratildi');

  const courses = [];
  for (const c of [
    { name: 'Robototexnika', icon: '🤖', color: '#E63946', ageRange: '8-14', duration: '6 oy', price: 450000, discountPrice: 430000, description: 'Robot yaratish va dasturlash' },
    { name: 'Python IT', icon: '🐍', color: '#2EC4B6', ageRange: '12-17', duration: '6 oy', price: 450000, discountPrice: 430000, description: 'Python dasturlash tili' },
    { name: 'Telegram-bot', icon: '🤖', color: '#0088CC', ageRange: '14-18', duration: '4 oy', price: 650000, discountPrice: 600000, description: 'Telegram bot yaratish' },
    { name: 'AI', icon: '🧠', color: '#9B5DE5', ageRange: '15-18', duration: '6 oy', price: 1200000, discountPrice: 1100000, description: "Sun'iy intellekt asoslari" },
    { name: 'Scratch Jr', icon: '🧩', color: '#FF6B35', ageRange: '7-9', duration: '3 oy', price: 400000, discountPrice: 380000, description: "Boshlang'ich dasturlash" },
  ]) { courses.push(await prisma.course.create({ data: c })); }
  console.log(`✅ ${courses.length} ta kurs`);

  const teachers = [];
  for (const t of [
    { fullName: 'Jamshid Kamolov', phone: '+998901111111', specialization: 'Robototexnika', salary: 3000000 },
    { fullName: 'Sardor Yusupov', phone: '+998902222222', specialization: 'Python IT', salary: 3500000 },
    { fullName: 'Nilufar Ahmedova', phone: '+998903333333', specialization: 'Telegram-bot', salary: 3000000 },
    { fullName: 'Alisher Rahmatov', phone: '+998904444444', specialization: 'AI, Python', salary: 4000000 },
    { fullName: 'Madina Sobirov', phone: '+998905555555', specialization: 'Scratch Jr', salary: 3500000 },
  ]) { teachers.push(await prisma.teacher.create({ data: t })); }
  console.log(`✅ ${teachers.length} ta o'qituvchi`);

  // GURUHLAR — haftada 3 marta, 2 soatdan
  const groups = [];
  for (const g of [
    { name: 'Robo-A1', courseId: courses[0].id, teacherId: teachers[0].id, schedule: 'Du-Cho-Sha 08:00-10:00', weekDays: 'Du,Cho,Sha', timeSlot: 'MORNING', startTime: '08:00', endTime: '10:00', maxSize: 12 },
    { name: 'Python-B1', courseId: courses[1].id, teacherId: teachers[1].id, schedule: 'Se-Pay-Sha 08:00-10:00', weekDays: 'Se,Pay,Sha', timeSlot: 'MORNING', startTime: '08:00', endTime: '10:00', maxSize: 10 },
    { name: 'TgBot-C1', courseId: courses[2].id, teacherId: teachers[2].id, schedule: 'Du-Cho-Sha 15:00-17:00', weekDays: 'Du,Cho,Sha', timeSlot: 'AFTERNOON', startTime: '15:00', endTime: '17:00', maxSize: 12 },
    { name: 'AI-D1', courseId: courses[3].id, teacherId: teachers[3].id, schedule: 'Se-Pay-Sha 15:00-17:00', weekDays: 'Se,Pay,Sha', timeSlot: 'AFTERNOON', startTime: '15:00', endTime: '17:00', maxSize: 10 },
    { name: 'Scratch-E1', courseId: courses[4].id, teacherId: teachers[4].id, schedule: 'Du-Cho-Sha 08:00-10:00', weekDays: 'Du,Cho,Sha', timeSlot: 'MORNING', startTime: '08:00', endTime: '10:00', maxSize: 8 },
  ]) { groups.push(await prisma.group.create({ data: g })); }
  console.log(`✅ ${groups.length} ta guruh (haftada 3 marta, 2 soatdan)`);

  const students = [];
  for (const s of [
    { fullName: 'Aziz Karimov', age: 12, metrikaNumber: 'I-TM 1234567', fatherName: 'Karim Karimov', fatherPhone: '+998901234567', motherName: 'Nodira Karimova', motherPhone: '+998901234568', parentPhone: '+998901234567', groupId: groups[0].id, balance: 200000, progress: 78, totalPoints: 45 },
    { fullName: 'Malika Rahimova', age: 10, metrikaNumber: 'I-TM 2345678', fatherName: 'Sardor Rahimov', fatherPhone: '+998935551122', motherName: 'Gulnora Rahimova', motherPhone: '+998935551123', parentPhone: '+998935551122', groupId: groups[0].id, balance: -150000, progress: 85, totalPoints: 60 },
    { fullName: 'Jasur Toshmatov', age: 14, metrikaNumber: 'I-TM 3456789', fatherName: 'Dilshod Toshmatov', fatherPhone: '+998977778899', motherName: 'Barno Toshmatova', motherPhone: '+998977778800', parentPhone: '+998977778899', groupId: groups[1].id, balance: 400000, progress: 92, totalPoints: 85 },
    { fullName: 'Sevara Usmanova', age: 11, metrikaNumber: 'I-TM 4567890', fatherName: 'Rustam Usmanov', fatherPhone: '+998911112233', motherName: 'Gulnora Usmanova', motherPhone: '+998911112234', parentPhone: '+998911112233', groupId: groups[2].id, balance: 0, progress: 65, totalPoints: 30 },
    { fullName: 'Bobur Aliyev', age: 13, metrikaNumber: 'I-TM 5678901', fatherName: 'Anvar Aliyev', fatherPhone: '+998944445566', motherName: 'Zarina Aliyeva', motherPhone: '+998944445567', parentPhone: '+998944445566', groupId: groups[1].id, balance: 400000, progress: 88, totalPoints: 70 },
    { fullName: 'Nilufar Qodirova', age: 9, metrikaNumber: 'I-TM 6789012', fatherName: 'Akbar Qodirov', fatherPhone: '+998903334455', motherName: 'Zulfiya Qodirova', motherPhone: '+998903334456', parentPhone: '+998903334455', groupId: groups[3].id, balance: -300000, progress: 45, totalPoints: 15 },
    { fullName: 'Sherzod Mirzayev', age: 15, metrikaNumber: 'I-TM 7890123', fatherName: 'Hamid Mirzayev', fatherPhone: '+998916667788', motherName: 'Dilrabo Mirzayeva', motherPhone: '+998916667789', parentPhone: '+998916667788', groupId: groups[4].id, balance: 500000, progress: 95, totalPoints: 120 },
    { fullName: 'Kamola Nazarova', age: 12, metrikaNumber: 'I-TM 8901234', fatherName: 'Jamshid Nazarov', fatherPhone: '+998928889900', motherName: 'Barno Nazarova', motherPhone: '+998928889901', parentPhone: '+998928889900', groupId: groups[2].id, balance: 200000, progress: 72, totalPoints: 40 },
    { fullName: 'Temur Xasanov', age: 11, metrikaNumber: 'I-TM 9012345', fatherName: 'Rustam Xasanov', fatherPhone: '+998950001122', motherName: 'Shoira Xasanova', motherPhone: '+998950001123', parentPhone: '+998950001122', groupId: groups[3].id, balance: -150000, progress: 58, totalPoints: 20, status: 'INACTIVE' },
    { fullName: 'Dildora Ergasheva', age: 13, metrikaNumber: 'I-TM 0123456', fatherName: 'Saidakbar Ergashev', fatherPhone: '+998962223344', motherName: 'Shoira Ergasheva', motherPhone: '+998962223345', parentPhone: '+998962223344', groupId: groups[4].id, balance: 400000, progress: 82, totalPoints: 55 },
  ]) { students.push(await prisma.student.create({ data: s })); }
  console.log(`✅ ${students.length} ta o'quvchi`);

  // To'lovlar
  for (const p of [
    { studentId: students[0].id, amount: 450000, paymentMethod: 'CASH', paymentDate: new Date('2026-02-01'), monthFor: '2026-02' },
    { studentId: students[2].id, amount: 450000, paymentMethod: 'CLICK', paymentDate: new Date('2026-02-01'), monthFor: '2026-02' },
    { studentId: students[4].id, amount: 650000, paymentMethod: 'PAYME', paymentDate: new Date('2026-02-03'), monthFor: '2026-02' },
    { studentId: students[6].id, amount: 1200000, paymentMethod: 'CASH', paymentDate: new Date('2026-02-05'), monthFor: '2026-02' },
    { studentId: students[7].id, amount: 400000, paymentMethod: 'CLICK', paymentDate: new Date('2026-02-05'), monthFor: '2026-02' },
    { studentId: students[9].id, amount: 1200000, paymentMethod: 'PAYME', paymentDate: new Date('2026-02-07'), monthFor: '2026-02' },
    { studentId: students[0].id, amount: 430000, paymentMethod: 'CASH', paymentDate: new Date('2026-03-01'), monthFor: '2026-03' },
    { studentId: students[2].id, amount: 430000, paymentMethod: 'CLICK', paymentDate: new Date('2026-03-01'), monthFor: '2026-03' },
  ]) { await prisma.payment.create({ data: p }); }
  console.log('✅ 8 ta to\'lov');

  // Leadlar
  for (const l of [
    { fullName: 'Otabek Saidov', phone: '+998901112233', source: 'INSTAGRAM', interest: 'Arduino', status: 'NEW' },
    { fullName: 'Gulbahor Tursunova', phone: '+998934445566', source: 'TELEGRAM', interest: 'Scratch Jr', status: 'TRIAL_SCHEDULED', trialDate: new Date('2026-03-28') },
    { fullName: 'Mirzo Karimov', phone: '+998917778899', source: 'REFERRAL', interest: 'Python', status: 'TRIAL_DONE' },
    { fullName: 'Shahlo Abdullayeva', phone: '+998940001122', source: 'INSTAGRAM', interest: 'Lego Robotics', status: 'CONVERTED' },
    { fullName: 'Baxtiyor Umarov', phone: '+998952223344', source: 'TELEGRAM', interest: '3D Modeling', status: 'LOST', lossReason: 'Narx qimmat' },
    { fullName: 'Laylo Xolmatova', phone: '+998963334455', source: 'INSTAGRAM', interest: 'Scratch Jr', status: 'NEW' },
    { fullName: 'Farrux Normatov', phone: '+998905556677', source: 'REFERRAL', interest: 'Arduino', status: 'TRIAL_SCHEDULED', trialDate: new Date('2026-03-30') },
  ]) { await prisma.lead.create({ data: l }); }
  console.log('✅ 7 ta lead');

  // Xarajatlar
  for (const e of [
    { category: 'RENT', amount: 5000000, description: "Mart oyi ijara", expenseDate: new Date('2026-03-01') },
    { category: 'SALARY', amount: 17000000, description: "O'qituvchilar oyligi", expenseDate: new Date('2026-03-05') },
    { category: 'EQUIPMENT', amount: 2000000, description: "Arduino to'plamlari", expenseDate: new Date('2026-03-10') },
    { category: 'MARKETING', amount: 500000, description: "Instagram reklama", expenseDate: new Date('2026-03-15') },
  ]) { await prisma.expense.create({ data: e }); }
  console.log('✅ 4 ta xarajat');

  // Demo yutuqlar
  for (const a of [
    { studentId: students[2].id, type: 'PROJECT_DONE', title: 'Arduino — Traffic Light loyihasi', points: 20 },
    { studentId: students[6].id, type: 'CONTEST_WIN', title: "Shahar robototexnika musobaqasi — 1-o'rin", points: 50 },
    { studentId: students[4].id, type: 'PROJECT_DONE', title: 'Arduino — Smart Home loyihasi', points: 25 },
    { studentId: students[1].id, type: 'HOMEWORK_DONE', title: "Scratch — O'yin yaratish", points: 10 },
  ]) { await prisma.achievement.create({ data: a }); }
  console.log('✅ 4 ta yutuq/ball');

  console.log('\n🎉 Tayyor! Login: admin@roboschool.uz / admin123');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
