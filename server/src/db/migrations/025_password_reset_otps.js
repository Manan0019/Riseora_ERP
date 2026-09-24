import db from "../database.js";

export function runPasswordResetOtpMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      used_at TEXT,
      requested_ip TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user
      ON password_reset_otps(user_id, id DESC);

    CREATE INDEX IF NOT EXISTS idx_password_reset_otps_active
      ON password_reset_otps(user_id, used_at, expires_at);
  `);

  console.log("Password-reset OTP migration completed");
}
