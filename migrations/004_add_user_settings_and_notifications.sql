-- Add user settings and notifications tables.
-- Run this if your database was created before these tables existed.

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

INSERT IGNORE INTO user_settings (user_id)
SELECT id FROM users;
