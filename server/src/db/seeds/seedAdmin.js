import bcrypt from "bcrypt";
import db from "../database.js";

export async function seedAdmin() {
  const existingAdmin = db
    .prepare(`SELECT id FROM users WHERE username = ?`)
    .get("admin");

  if (existingAdmin) {
    console.log("Default admin already exists");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const initialPassword =
    process.env.INITIAL_ADMIN_PASSWORD ||
    (isProduction ? null : "admin123");

  if (!initialPassword) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD is required before the first production startup.",
    );
  }

  const passwordHash = await bcrypt.hash(initialPassword, 10);

  db.prepare(`
    INSERT INTO users (
      username,
      password_hash,
      full_name,
      role
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "admin",
    passwordHash,
    "Administrator",
    "ADMIN",
  );

  console.log("Default admin user created");
  if (!isProduction && !process.env.INITIAL_ADMIN_PASSWORD) {
    console.warn("Development admin password is admin123. Change it from Settings.");
  }
}
