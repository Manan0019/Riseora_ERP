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

  const passwordHash = await bcrypt.hash("admin123", 10);

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
    "ADMIN"
  );

  console.log("Default admin user created");
}