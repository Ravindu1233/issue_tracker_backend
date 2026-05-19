-- Add OTP fields used by the forgot/reset password flow.

USE issue_tracker;

ALTER TABLE users
  ADD COLUMN reset_otp_hash VARCHAR(255) NULL AFTER password,
  ADD COLUMN reset_otp_expires_at DATETIME NULL AFTER reset_otp_hash,
  ADD COLUMN reset_otp_created_at DATETIME NULL AFTER reset_otp_expires_at,
  ADD INDEX idx_users_reset_otp_expires_at (reset_otp_expires_at);
