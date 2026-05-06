-- Add new achievement types
ALTER TYPE "AchievementType" ADD VALUE IF NOT EXISTS 'HOMEWORK';
ALTER TYPE "AchievementType" ADD VALUE IF NOT EXISTS 'PROJECT';
ALTER TYPE "AchievementType" ADD VALUE IF NOT EXISTS 'ACTIVITY';
ALTER TYPE "AchievementType" ADD VALUE IF NOT EXISTS 'PARENT_ACTIVITY';
ALTER TYPE "AchievementType" ADD VALUE IF NOT EXISTS 'PENALTY';

-- Migrate old data to new types
UPDATE achievements SET type = 'PROJECT' WHERE type = 'PROJECT_DONE';
UPDATE achievements SET type = 'HOMEWORK' WHERE type = 'HOMEWORK_DONE';
