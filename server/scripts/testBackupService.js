import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "riseora-backup-test-",
    ),
  );

const dbPath =
  path.join(
    tempDir,
    "data",
    "riseora_erp.db",
  );

const backupDir =
  path.join(
    tempDir,
    "backups",
  );

fs.mkdirSync(
  path.dirname(dbPath),
  {
    recursive: true,
  },
);

process.env.NODE_ENV =
  "test";
process.env.RISEORA_DB_PATH =
  dbPath;
process.env.RISEORA_BACKUP_DIR =
  backupDir;
process.env.INITIAL_ADMIN_USERNAME =
  "ram";
process.env.INITIAL_ADMIN_FULL_NAME =
  "Ram";
process.env.INITIAL_ADMIN_PASSWORD =
  "RiseoraBackupTest2026!";

let db;

try {
  const {
    initDatabase,
  } = await import(
    "../src/db/initDatabase.js"
  );

  await initDatabase();

  db = (
    await import(
      "../src/db/database.js"
    )
  ).default;

  const {
    createDatabaseBackup,
    listDatabaseBackups,
  } = await import(
    "../src/services/backupService.js"
  );

  const backup =
    await createDatabaseBackup();

  assert.ok(
    backup.fileName.endsWith(".db"),
  );

  assert.ok(
    backup.sizeBytes > 0,
  );

  const fullPath =
    path.join(
      backupDir,
      backup.fileName,
    );

  assert.ok(
    fs.existsSync(fullPath),
  );

  const history =
    listDatabaseBackups();

  assert.equal(
    history.length,
    1,
  );

  assert.equal(
    history[0].fileName,
    backup.fileName,
  );

  console.log(
    "RESULT: PASS — manual database backup created, verified and listed.",
  );

  console.log(
    `Backup: ${fullPath}`,
  );
} finally {
  try {
    db?.close();
  } catch {
    // Ignore cleanup-only error.
  }

  try {
    fs.rmSync(
      tempDir,
      {
        recursive: true,
        force: true,
      },
    );
  } catch {
    // Harmless if Windows delays cleanup.
  }
}
