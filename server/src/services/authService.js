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