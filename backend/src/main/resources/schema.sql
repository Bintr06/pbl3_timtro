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
