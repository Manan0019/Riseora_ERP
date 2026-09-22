import { authenticateUser, changeUserPassword } from "../services/authService.js";

export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const user = await authenticateUser(
      username.trim(),
      password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while logging in",
    });
  }
}

export function getCurrentUser(req, res) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  return res.status(200).json({
    success: true,
    user: req.session.user,
  });
}

export function logout(req, res) {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to log out",
      });
    }

    res.clearCookie("riseora.sid");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  });
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password, new password and confirmation are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match.",
      });
    }

    await changeUserPassword(req.session.user.id, currentPassword, newPassword);

    return res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Password change error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to change password.",
    });
  }
}
