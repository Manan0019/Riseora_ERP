import bcrypt from "bcrypt";
import db from "../database.js";

export async function seedAdmin() {
  const initialUsername =
    process.env.INITIAL_ADMIN_USERNAME?.trim() || "ram";

  const initialFullName =
    process.env.INITIAL_ADMIN_FULL_NAME?.trim() || "Ram";

  const existingAdmin = db
    .prepare(`SELECT id FROM users WHERE username = ?`)
    .get(initialUsername);

  if (existingAdmin) {
    console.log(`Default admin ${initialUsername} already exists`);
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const initialPassword =
    process.env.INITIAL_ADMIN_PASSWORD ||
    (isProduction ? null : "1356");

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
    initialUsername,
    passwordHash,
    initialFullName,
    "ADMIN",
  );

  console.log(`Default admin user ${initialUsername} created`);
  if (!isProduction && !process.env.INITIAL_ADMIN_PASSWORD) {
    console.warn(
      "Development admin login is ram / 1356. Replace it with a strong password before owner deployment.",
    );
  }
}
