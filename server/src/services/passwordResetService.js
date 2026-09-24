import crypto from "node:crypto";
import bcrypt from "bcrypt";

import db from "../db/database.js";
import { sendPasswordResetOtpEmail } from "./emailService.js";

const OTP_MINUTES = Math.max(
  5,
  Number(process.env.PASSWORD_RESET_OTP_MINUTES || 10),
);

const RESEND_SECONDS = Math.max(
  30,
  Number(process.env.PASSWORD_RESET_RESEND_SECONDS || 60),
);

const MAX_ATTEMPTS = Math.max(
  3,
  Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 5),
);

function serviceError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseSqliteUtc(value) {
  if (!value) {
    return 0;
  }

  const raw = String(value).trim();

  if (raw.includes("T")) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const parsed = Date.parse(`${raw.replace(" ", "T")}Z`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function maskEmail(email) {
  const value = String(email || "").trim();
  const atIndex = value.indexOf("@");

  if (atIndex <= 0) {
    return "";
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  let maskedLocal = "*";

  if (local.length === 1) {
    maskedLocal = `${local[0]}***`;
  } else if (local.length === 2) {
    maskedLocal = `${local[0]}***${local[1]}`;
  } else {
    maskedLocal = `${local.slice(0, 2)}***${local.slice(-1)}`;
  }

  return `${maskedLocal}@${domain}`;
}

function validateNewPassword(password) {
  const value = String(password || "");

  if (value.length < 8) {
    throw serviceError(
      "New password must contain at least 8 characters.",
      "PASSWORD_POLICY",
    );
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw serviceError(
      "New password must contain at least one letter and one number.",
      "PASSWORD_POLICY",
    );
  }

  if (value.length > 128) {
    throw serviceError(
      "New password is too long.",
      "PASSWORD_POLICY",
    );
  }

  return value;
}

function getActiveUser(username) {
  const normalized = String(username || "").trim();

  if (!normalized) {
    return null;
  }

  return db
    .prepare(`
      SELECT
        id,
        username,
        password_hash,
        full_name,
        role,
        is_active
      FROM users
      WHERE LOWER(username) = LOWER(?)
        AND is_active = 1
      LIMIT 1
    `)
    .get(normalized);
}

function getCompanyEmail() {
  const company = db
    .prepare(`
      SELECT email
      FROM companies
      WHERE is_active = 1
      ORDER BY id
      LIMIT 1
    `)
    .get();

  return String(company?.email || "").trim();
}

export async function requestPasswordReset({
  username,
  requestedIp = null,
}) {
  const user = getActiveUser(username);

  /*
   * Keep the public response generic when the username does not exist.
   * This prevents the forgot-password endpoint from becoming a user lookup.
   */
  if (!user) {
    return {
      accepted: true,
      maskedEmail: null,
    };
  }

  const companyEmail = getCompanyEmail();

  if (!companyEmail) {
    throw serviceError(
      "Company email is not configured. Open Company Master and enter the email that should receive password-reset OTPs.",
      "PASSWORD_RESET_CONFIG",
    );
  }

  const latest = db
    .prepare(`
      SELECT id, created_at
      FROM password_reset_otps
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(user.id);

  if (latest) {
    const lastRequestedAt = parseSqliteUtc(latest.created_at);
    const secondsSinceLastRequest =
      (Date.now() - lastRequestedAt) / 1000;

    if (
      lastRequestedAt > 0 &&
      secondsSinceLastRequest < RESEND_SECONDS
    ) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(RESEND_SECONDS - secondsSinceLastRequest),
      );

      const error = serviceError(
        `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        "PASSWORD_RESET_RATE_LIMIT",
      );

      error.retryAfterSeconds = retryAfterSeconds;
      throw error;
    }
  }

  db.prepare(`
    UPDATE password_reset_otps
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
      AND used_at IS NULL
  `).run(user.id);

  const otp = String(
    crypto.randomInt(100000, 1000000),
  );

  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(
    Date.now() + OTP_MINUTES * 60 * 1000,
  ).toISOString();

  const result = db.prepare(`
    INSERT INTO password_reset_otps (
      user_id,
      otp_hash,
      expires_at,
      max_attempts,
      requested_ip
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    user.id,
    otpHash,
    expiresAt,
    MAX_ATTEMPTS,
    requestedIp ? String(requestedIp).slice(0, 100) : null,
  );

  try {
    await sendPasswordResetOtpEmail({
      to: companyEmail,
      otp,
      expiresMinutes: OTP_MINUTES,
    });
  } catch (error) {
    db.prepare(`
      DELETE FROM password_reset_otps
      WHERE id = ?
    `).run(result.lastInsertRowid);

    throw error;
  }

  return {
    accepted: true,
    maskedEmail: maskEmail(companyEmail),
  };
}

export async function confirmPasswordReset({
  username,
  otp,
  newPassword,
}) {
  const password = validateNewPassword(newPassword);
  const user = getActiveUser(username);

  if (!user) {
    throw serviceError(
      "The OTP is invalid or has expired.",
      "INVALID_OTP",
    );
  }

  const reset = db
    .prepare(`
      SELECT
        id,
        otp_hash,
        expires_at,
        attempts,
        max_attempts
      FROM password_reset_otps
      WHERE user_id = ?
        AND used_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(user.id);

  if (!reset) {
    throw serviceError(
      "The OTP is invalid or has expired.",
      "INVALID_OTP",
    );
  }

  const expiresAt = Date.parse(reset.expires_at);

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    db.prepare(`
      UPDATE password_reset_otps
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reset.id);

    throw serviceError(
      "The OTP is invalid or has expired.",
      "INVALID_OTP",
    );
  }

  if (
    Number(reset.attempts || 0) >=
    Number(reset.max_attempts || MAX_ATTEMPTS)
  ) {
    db.prepare(`
      UPDATE password_reset_otps
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reset.id);

    throw serviceError(
      "Too many incorrect OTP attempts. Request a new OTP.",
      "OTP_ATTEMPTS_EXCEEDED",
    );
  }

  const normalizedOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw serviceError(
      "Enter the 6-digit OTP sent to the company email.",
      "INVALID_OTP",
    );
  }

  const otpMatches = await bcrypt.compare(
    normalizedOtp,
    reset.otp_hash,
  );

  if (!otpMatches) {
    const nextAttempts =
      Number(reset.attempts || 0) + 1;

    db.prepare(`
      UPDATE password_reset_otps
      SET
        attempts = ?,
        used_at = CASE
          WHEN ? >= max_attempts THEN CURRENT_TIMESTAMP
          ELSE used_at
        END
      WHERE id = ?
    `).run(nextAttempts, nextAttempts, reset.id);

    if (
      nextAttempts >=
      Number(reset.max_attempts || MAX_ATTEMPTS)
    ) {
      throw serviceError(
        "Too many incorrect OTP attempts. Request a new OTP.",
        "OTP_ATTEMPTS_EXCEEDED",
      );
    }

    throw serviceError(
      "The OTP is invalid or has expired.",
      "INVALID_OTP",
    );
  }

  const sameAsCurrent = await bcrypt.compare(
    password,
    user.password_hash,
  );

  if (sameAsCurrent) {
    throw serviceError(
      "Choose a new password that is different from the current password.",
      "PASSWORD_POLICY",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const saveReset = db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, user.id);

    db.prepare(`
      UPDATE password_reset_otps
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND used_at IS NULL
    `).run(user.id);
  });

  saveReset();

  return {
    username: user.username,
  };
}
