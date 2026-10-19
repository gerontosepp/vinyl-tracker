-- Drop redundant salt column from app_user table (BCrypt already contains its own random salt in the password hash)
ALTER TABLE app_user DROP COLUMN IF EXISTS salt;
