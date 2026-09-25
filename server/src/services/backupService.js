import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import db from "../db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

function getDatabasePath() {
  const configured = String(
    process.env.RISEORA_DB_PATH || "",
  ).trim();

  if (configured) {
    return path.resolve(configured);
  }

  if (db?.name) {
    return path.resolve(db.name);
  }

  return path.resolve(
    __dirname,
    "../../../data/riseora_erp.db",
  );
}

export function getBackupDirectory() {
  const configured = String(
    process.env.RISEORA_BACKUP_DIR || "",
  ).trim();

  const backupDir = configured
    ? path.resolve(configured)
    : path.join(
        path.dirname(getDatabasePath()),
        "backups",
      );

  fs.mkdirSync(
    backupDir,
    { recursive: true },
  );

  return backupDir;
}

function verifyBackupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      "The backup file was not created.",
    );
  }

  const stat = fs.statSync(filePath);

  if (!stat.isFile() || stat.size <= 0) {
    throw new Error(
      "The backup file is empty.",
    );
  }

  let backupDb;

  try {
    backupDb = new Database(
      filePath,
      {
        readonly: true,
        fileMustExist: true,
        timeout: 5000,
      },
    );

    const quickCheck = String(
      backupDb.pragma(
        "quick_check",
        { simple: true },
      ),
    ).toLowerCase();

    if (quickCheck !== "ok") {
      throw new Error(
        `SQLite quick_check returned "${quickCheck}".`,
      );
    }

    const foreignKeyIssues =
      backupDb.pragma("foreign_key_check");

    if (
      Array.isArray(foreignKeyIssues) &&
      foreignKeyIssues.length > 0
    ) {
      throw new Error(
        `Backup contains ${foreignKeyIssues.length} foreign-key issue(s).`,
      );
    }
  } finally {
    try {
      backupDb?.close();
    } catch {
      // Ignore close-only errors.
    }
  }

  return stat;
}

function toBackupInfo(fileName, fullPath) {
  const stat = fs.statSync(fullPath);

  return {
    fileName,
    modifiedAt: stat.mtime.toISOString(),
    sizeBytes: Number(stat.size || 0),
    kind: fileName.startsWith("startup_")
      ? "STARTUP"
      : "MANUAL",
  };
}

export function listDatabaseBackups() {
  const backupDir =
    getBackupDirectory();

  return fs
    .readdirSync(
      backupDir,
      { withFileTypes: true },
    )
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".db"),
    )
    .map((entry) => {
      const fullPath =
        path.join(
          backupDir,
          entry.name,
        );

      return toBackupInfo(
        entry.name,
        fullPath,
      );
    })
    .sort(
      (a, b) =>
        new Date(b.modifiedAt) -
        new Date(a.modifiedAt),
    );
}

/*
 * Backward-compatible alias for older callers.
 */
export function listBackups() {
  return listDatabaseBackups();
}

async function createNamedBackup(prefix) {
  const backupDir =
    getBackupDirectory();

  const safePrefix =
    String(prefix || "riseora_erp_backup")
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "_") ||
    "riseora_erp_backup";

  const fileName =
    `${safePrefix}_${safeTimestamp()}.db`;

  const destination =
    path.join(
      backupDir,
      fileName,
    );

  try {
    await db.backup(destination);

    verifyBackupFile(destination);

    return toBackupInfo(
      fileName,
      destination,
    );
  } catch (error) {
    try {
      fs.rmSync(
        destination,
        { force: true },
      );
    } catch {
      // Preserve original error.
    }

    throw new Error(
      `Unable to create database backup: ${
        error?.message || error
      }`,
    );
  }
}

export async function createDatabaseBackup() {
  return createNamedBackup(
    "riseora_erp_backup",
  );
}

/*
 * Backward-compatible export used by startupBackupService.
 * Examples:
 *   createBackup()
 *   createBackup("startup")
 */
export async function createBackup(
  prefix = "riseora_erp_backup",
) {
  return createNamedBackup(prefix);
}

/*
 * Backward-compatible retention helper used by startupBackupService.
 *
 * Supports:
 *   cleanupOldBackups()
 *   cleanupOldBackups(30)
 *   cleanupOldBackups(30, "startup_")
 *   cleanupOldBackups({ keep: 30, prefix: "startup_" })
 */
export function cleanupOldBackups(
  keepOrOptions = 30,
  prefixArg = null,
) {
  const backupDir =
    getBackupDirectory();

  let keep = 30;
  let prefix = prefixArg;

  if (
    keepOrOptions &&
    typeof keepOrOptions === "object"
  ) {
    keep = Number(
      keepOrOptions.keep ??
      keepOrOptions.maxBackups ??
      keepOrOptions.limit ??
      30,
    );

    prefix =
      keepOrOptions.prefix ??
      prefixArg;
  } else {
    keep = Number(
      keepOrOptions ?? 30,
    );
  }

  if (
    !Number.isFinite(keep) ||
    keep < 0
  ) {
    keep = 30;
  }

  const normalizedPrefix =
    prefix == null
      ? null
      : String(prefix);

  const candidates = fs
    .readdirSync(
      backupDir,
      { withFileTypes: true },
    )
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".db") &&
        (
          !normalizedPrefix ||
          entry.name.startsWith(
            normalizedPrefix,
          )
        ),
    )
    .map((entry) => {
      const fullPath =
        path.join(
          backupDir,
          entry.name,
        );

      return {
        name: entry.name,
        fullPath,
        modifiedMs:
          fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort(
      (a, b) =>
        b.modifiedMs - a.modifiedMs,
    );

  const removed = [];

  for (
    const oldBackup
    of candidates.slice(
      Math.floor(keep),
    )
  ) {
    fs.rmSync(
      oldBackup.fullPath,
      { force: true },
    );

    removed.push(
      oldBackup.name,
    );
  }

  return removed;
}
