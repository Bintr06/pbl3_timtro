SET @table_exists := (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'email_verification_tokens'
);

SET @column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'email_verification_tokens'
      AND column_name = 'created_at'
);

SET @sql := IF(
    @table_exists > 0 AND @column_exists = 0,
    'ALTER TABLE email_verification_tokens ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked BIT(1) NOT NULL DEFAULT b'0',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash),
  INDEX idx_refresh_tokens_user_revoked (user_id, revoked),
  INDEX idx_refresh_tokens_expires_at (expires_at)
);

SET @rooms_table_exists := (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'rooms'
);

SET @rooms_status_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'rooms'
      AND column_name = 'status'
);

SET @rooms_status_sql := IF(
    @rooms_table_exists > 0 AND @rooms_status_exists > 0,
    "ALTER TABLE rooms MODIFY COLUMN status ENUM('PENDING','AVAILABLE','RENTED','REJECTED','HIDDEN') NOT NULL",
    'SELECT 1'
);

PREPARE stmt FROM @rooms_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @rooms_deleted_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'rooms'
    AND column_name = 'deleted'
);

SET @rooms_deleted_sql := IF(
  @rooms_table_exists > 0 AND @rooms_deleted_exists = 0,
  "ALTER TABLE rooms ADD COLUMN deleted BIT(1) NOT NULL DEFAULT b'0'",
  'SELECT 1'
);

PREPARE stmt FROM @rooms_deleted_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @rooms_boosted_until_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'rooms'
    AND column_name = 'boosted_until'
);

SET @rooms_boosted_until_drop_sql := IF(
  @rooms_table_exists > 0 AND @rooms_boosted_until_exists > 0,
  "ALTER TABLE rooms DROP COLUMN boosted_until",
  'SELECT 1'
);

PREPARE stmt FROM @rooms_boosted_until_drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @users_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
);

SET @users_post_credits_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'post_credits'
);

SET @users_post_credits_drop_sql := IF(
  @users_table_exists > 0 AND @users_post_credits_exists > 0,
  "ALTER TABLE users DROP COLUMN post_credits",
  'SELECT 1'
);

PREPARE stmt FROM @users_post_credits_drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
