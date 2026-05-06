const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Neon Free uxlaganda ulanish uziladi — avtomatik qayta ulash
const MAX_RETRIES = 3;
const originalRequest = prisma.$request;

prisma.$use(async (params, next) => {
  let retries = 0;
  while (true) {
    try {
      return await next(params);
    } catch (error) {
      if (
        retries < MAX_RETRIES &&
        (error.message?.includes('kind: Closed') ||
         error.message?.includes('Connection refused') ||
         error.message?.includes('connection is not available') ||
         error.code === 'P2024')
      ) {
        retries++;
        console.log(`⚠️ DB ulanish uzildi, qayta urinish ${retries}/${MAX_RETRIES}...`);
        await new Promise(r => setTimeout(r, 1000 * retries));
        continue;
      }
      throw error;
    }
  }
});

module.exports = prisma;
