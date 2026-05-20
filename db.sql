-- ============================================================
-- Issue Tracker - Database Schema
-- Run this file to set up the database before starting the app
-- ============================================================

-- Create database
CREATE DATABASE IF NOT EXISTS issue_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE issue_tracker;

-- ============================================================
-- Users Table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          INT           NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(255)  NOT NULL,
  email       VARCHAR(255)  NOT NULL,
  password    VARCHAR(255)  NOT NULL,
  reset_otp_hash       VARCHAR(255) NULL,
  reset_otp_expires_at DATETIME     NULL,
  reset_otp_created_at DATETIME     NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_reset_otp_expires_at (reset_otp_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Issues Table
-- Status and priority are stored directly on issues as ENUM columns.
-- No separate status/priority lookup tables are required.
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
  id          INT           NOT NULL AUTO_INCREMENT,
  title       VARCHAR(255)  NOT NULL,
  description TEXT,
  status      ENUM('Open', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
  priority    ENUM('Low', 'Medium', 'High')                      NOT NULL DEFAULT 'Medium',
  user_id     INT           NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_issues_user_id  (user_id),
  KEY idx_issues_status   (status),
  KEY idx_issues_priority (priority),

  CONSTRAINT fk_issues_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- User Settings Table
-- Stores per-user UI and notification preferences.
-- All values default to false.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id                  INT          NOT NULL AUTO_INCREMENT,
  user_id             INT          NOT NULL,
  dark_mode           TINYINT(1)   NOT NULL DEFAULT 0,
  show_notifications  TINYINT(1)   NOT NULL DEFAULT 0,
  email_notifications TINYINT(1)   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_settings_user_id (user_id),

  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Notifications Table
-- Stores notifications that belong to a user.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         INT          NOT NULL AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NULL,
  type       VARCHAR(50)  NOT NULL DEFAULT 'general',
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at    DATETIME     NULL,

  PRIMARY KEY (id),
  KEY idx_notifications_user_id_created_at (user_id, created_at),
  KEY idx_notifications_user_id_is_read (user_id, is_read),

  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
