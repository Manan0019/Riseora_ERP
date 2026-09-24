import nodemailer from "nodemailer";

let transporter = null;

function boolFromEnv(value, fallback = false) {
  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
}

function getMailConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = boolFromEnv(
    process.env.SMTP_SECURE,
    port === 465,
  );

  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");
  const from = String(
    process.env.SMTP_FROM || user || "",
  ).trim();

  if (!host) {
    const error = new Error(
      "SMTP_HOST is not configured. Add the outgoing mail server in server/.env.",
    );
    error.code = "PASSWORD_RESET_CONFIG";
    throw error;
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    const error = new Error(
      "SMTP_PORT is invalid in server/.env.",
    );
    error.code = "PASSWORD_RESET_CONFIG";
    throw error;
  }

  if ((user && !pass) || (!user && pass)) {
    const error = new Error(
      "SMTP_USER and SMTP_PASS must either both be configured or both be empty.",
    );
    error.code = "PASSWORD_RESET_CONFIG";
    throw error;
  }

  if (!from) {
    const error = new Error(
      "SMTP_FROM is not configured. Add a verified sender email in server/.env.",
    );
    error.code = "PASSWORD_RESET_CONFIG";
    throw error;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const config = getMailConfig();

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user
      ? {
          auth: {
            user: config.user,
            pass: config.pass,
          },
        }
      : {}),
  });

  return transporter;
}

export async function sendPasswordResetOtpEmail({
  to,
  otp,
  expiresMinutes,
}) {
  const recipient = String(to || "").trim();

  if (!recipient) {
    const error = new Error(
      "Company email is not configured. Enter the company email in Company Master first.",
    );
    error.code = "PASSWORD_RESET_CONFIG";
    throw error;
  }

  const config = getMailConfig();
  const mailer = getTransporter();

  const subject = "Riseora ERP password reset OTP";

  const text = [
    "Riseora ERP password reset",
    "",
    `Your OTP is: ${otp}`,
    "",
    `This OTP expires in ${expiresMinutes} minutes.`,
    "If you did not request this password reset, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#352d29">
      <h2 style="margin-bottom:8px">Riseora ERP password reset</h2>
      <p>Use the following one-time password to reset the ERP login password:</p>
      <div style="
        display:inline-block;
        padding:14px 22px;
        margin:8px 0 14px;
        border-radius:10px;
        background:#f3ece5;
        font-size:28px;
        font-weight:700;
        letter-spacing:6px;
      ">${otp}</div>
      <p>This OTP expires in <strong>${expiresMinutes} minutes</strong>.</p>
      <p style="color:#6d625d;font-size:13px">
        If you did not request this password reset, you can ignore this email.
      </p>
    </div>
  `;

  await mailer.sendMail({
    from: config.from,
    to: recipient,
    subject,
    text,
    html,
  });
}
