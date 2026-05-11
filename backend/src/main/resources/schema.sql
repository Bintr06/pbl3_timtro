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

-- Add post_credits column to users table if it doesn't exist
-- Add post_credits column to users table if it doesn't exist
SET @users_post_credits_add_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'post_credits'
);

SET @users_post_credits_add_sql := IF(
  @users_table_exists > 0 AND @users_post_credits_add_exists = 0,
  "ALTER TABLE users ADD COLUMN post_credits INT NOT NULL DEFAULT 0",
  'SELECT 1'
);

PREPARE stmt FROM @users_post_credits_add_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add monthly_credits column to users table if it doesn't exist
SET @users_monthly_credits_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'monthly_credits'
);

SET @users_monthly_credits_add_sql := IF(
  @users_table_exists > 0 AND @users_monthly_credits_exists = 0,
  "ALTER TABLE users ADD COLUMN monthly_credits INT NOT NULL DEFAULT 0",
  'SELECT 1'
);

PREPARE stmt FROM @users_monthly_credits_add_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add monthly_credits_reset_month column to users table if it doesn't exist
SET @users_monthly_credits_reset_month_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'monthly_credits_reset_month'
);

SET @users_monthly_credits_reset_month_sql := IF(
  @users_table_exists > 0 AND @users_monthly_credits_reset_month_exists = 0,
  "ALTER TABLE users ADD COLUMN monthly_credits_reset_month VARCHAR(7) NULL",
  'SELECT 1'
);

PREPARE stmt FROM @users_monthly_credits_reset_month_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create turn_packages table
CREATE TABLE IF NOT EXISTS turn_packages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  turns INT NOT NULL,
  price DOUBLE NOT NULL,
  description VARCHAR(255) NOT NULL,
  active BIT(1) NOT NULL DEFAULT b'1'
);

-- Insert default turn packages if they don't exist
INSERT IGNORE INTO turn_packages (id, turns, price, description, active) VALUES
(1, 5, 50000, 'Gói 5 lượt đăng tin', b'1'),
(2, 10, 90000, 'Gói 10 lượt đăng tin (Tiết kiệm 10K)', b'1'),
(3, 50, 400000, 'Gói 50 lượt đăng tin (Tiết kiệm 100K)', b'1');

-- Create turn_purchases table
CREATE TABLE IF NOT EXISTS turn_purchases (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  package_id BIGINT NOT NULL,
  turns INT NOT NULL,
  amount DOUBLE NOT NULL,
  transfer_content VARCHAR(6) NOT NULL UNIQUE,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  approved_at DATETIME(6) NULL,
  approved_by BIGINT NULL,
  rejection_reason TEXT NULL,
  CONSTRAINT fk_turn_purchases_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_turn_purchases_package_id FOREIGN KEY (package_id) REFERENCES turn_packages(id),
  CONSTRAINT fk_turn_purchases_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_turn_purchases_user_id (user_id),
  INDEX idx_turn_purchases_status (status),
  INDEX idx_turn_purchases_created_at (created_at)
);

-- Add credit_source column to rooms table if it doesn't exist
SET @rooms_credit_source_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'rooms'
    AND column_name = 'credit_source'
);

SET @rooms_credit_source_sql := IF(
  @rooms_table_exists > 0 AND @rooms_credit_source_exists = 0,
  "ALTER TABLE rooms ADD COLUMN credit_source VARCHAR(16) NULL",
  'SELECT 1'
);

PREPARE stmt FROM @rooms_credit_source_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
