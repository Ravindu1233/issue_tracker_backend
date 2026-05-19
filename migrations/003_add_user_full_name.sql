-- Add full name to existing users table.
-- Run this if your database was created before full_name existed.

ALTER TABLE users
  ADD COLUMN full_name VARCHAR(255) NULL AFTER id;

UPDATE users
SET full_name = SUBSTRING_INDEX(email, '@', 1)
WHERE full_name IS NULL OR full_name = '';

ALTER TABLE users
  MODIFY COLUMN full_name VARCHAR(255) NOT NULL;
