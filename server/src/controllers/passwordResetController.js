import {
  requestPasswordReset,
  confirmPasswordReset,
} from "../services/passwordResetService.js";

function statusForError(error) {
  switch (error?.code) {
    case "PASSWORD_RESET_CONFIG":
      return 503;

    case "PASSWORD_RESET_RATE_LIMIT":
      return 429;

    case "PASSWORD_POLICY":
    case "INVALID_OTP":
    case "OTP_ATTEMPTS_EXCEEDED":
      return 400;

    default:
      return 500;
  }
}

export async function requestResetOtp(req, res) {
  try {
    const username = String(
      req.body?.username || "",
    ).trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    const result = await requestPasswordReset({
      username,
      requestedIp: req.ip,
    });

    return res.status(200).json({
      success: true,
      message:
        "If the username is valid, a password-reset OTP has been sent to the company email.",
      maskedEmail: result.maskedEmail,
    });
  } catch (error) {
    console.error("Password-reset OTP request error:", error);

    const status = statusForError(error);

    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Unable to send the password-reset OTP."
          : error.message,
      ...(error.retryAfterSeconds
        ? {
            retryAfterSeconds:
              error.retryAfterSeconds,
          }
        : {}),
    });
  }
}

export async function confirmResetOtp(req, res) {
  try {
    const username = String(
      req.body?.username || "",
    ).trim();

    const otp = String(
      req.body?.otp || "",
    ).trim();

    const newPassword = String(
      req.body?.newPassword || "",
    );

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required.",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required.",
      });
    }

    const result = await confirmPasswordReset({
      username,
      otp,
      newPassword,
    });

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now sign in with the new password.",
      username: result.username,
    });
  } catch (error) {
    console.error("Password-reset confirmation error:", error);

    const status = statusForError(error);

    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Unable to reset the password."
          : error.message,
    });
  }
}
