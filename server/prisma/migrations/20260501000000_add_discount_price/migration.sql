-- AlterTable
ALTER TABLE "courses" ADD COLUMN "discount_price" INTEGER;

-- Update existing courses with May pricing
UPDATE "courses" SET "price" = 450000, "discount_price" = 430000 WHERE "name" = 'Robototexnika';
UPDATE "courses" SET "price" = 450000, "discount_price" = 430000 WHERE "name" = 'Python IT';
UPDATE "courses" SET "price" = 650000, "discount_price" = 600000 WHERE "name" = 'Telegram-bot';
UPDATE "courses" SET "price" = 1200000, "discount_price" = 1100000 WHERE "name" = 'AI';
