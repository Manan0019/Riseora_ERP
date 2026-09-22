import bcrypt from "bcrypt";
import db from "../db/database.js";

export async function authenticateUser(username, password) {
  const user = db
    .prepare(`
      SELECT
        id,
        username,
        password_hash,
        full_name,
        role,
        is_active
      FROM users
      WHERE username = ?
    `)
    .get(username);

  if (!user) {
    return null;
  }

  if (!user.is_active) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
  };
}

export async function changeUserPassword(userId, currentPassword, newPassword) {
  const user = db.prepare(`
    SELECT id, password_hash, is_active
    FROM users
    WHERE id = ?
  `).get(Number(userId));

  if (!user || !user.is_active) {
    throw new Error("User account not found or inactive.");
  }

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    throw new Error("Current password is incorrect.");
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new Error("New password must contain at least 8 characters.");
  }

  if (newPassword === currentPassword) {
    throw new Error("New password must be different from the current password.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(passwordHash, Number(userId));

  return true;
}
