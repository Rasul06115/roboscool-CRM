const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Neon Free uxlaganda ulanishni issiq saqlash
const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // 4 daqiqa

setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.log('⚠️ DB keep-alive xato, qayta ulanish...');
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      console.log('✅ DB qayta ulandi');
    } catch (err) {
      console.error('❌ DB qayta ulanish xatosi:', err.message);
    }
  }
}, KEEP_ALIVE_INTERVAL);

module.exports = prisma; 

