import bcrypt from "bcrypt";
import db from "../database.js";

const MIGRATION_KEY = "021_default_admin_credentials_ram";

export function runDefaultAdminCredentialsMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_migration_markers (
      migration_key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const alreadyApplied = db
    .prepare(`
      SELECT migration_key
      FROM app_migration_markers
      WHERE migration_key = ?
    `)
    .get(MIGRATION_KEY);

  if (alreadyApplied) {
    return;
  }

  const ramUser = db
    .prepare(`SELECT id FROM users WHERE username = 'ram'`)
    .get();

  const legacyAdmin = db
    .prepare(`SELECT id FROM users WHERE username = 'admin'`)
    .get();

  const passwordHash = bcrypt.hashSync("1356", 10);

  if (ramUser) {
    db.prepare(`
      UPDATE users
      SET
        password_hash = ?,
        full_name = 'Ram',
        role = 'ADMIN',
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, ramUser.id);

    if (legacyAdmin && legacyAdmin.id !== ramUser.id) {
      db.prepare(`
        UPDATE users
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(legacyAdmin.id);
    }
  } else if (legacyAdmin) {
    db.prepare(`
      UPDATE users
      SET
        username = 'ram',
        password_hash = ?,
        full_name = 'Ram',
        role = 'ADMIN',
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, legacyAdmin.id);
  }

  db.prepare(`
    INSERT INTO app_migration_markers (migration_key)
    VALUES (?)
  `).run(MIGRATION_KEY);

  console.log("Default administrator credentials migration completed");
}
