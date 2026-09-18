import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import db from "../db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.resolve(
  __dirname,
  "../../../backups"
);

function ensureBackupDirectory() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, {
      recursive: true,
    });
  }
}

function createBackupFileName() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  const hours = String(
    now.getHours()
  ).padStart(2, "0");

  const minutes = String(
    now.getMinutes()
  ).padStart(2, "0");

  const seconds = String(
    now.getSeconds()
  ).padStart(2, "0");

  return `riseora_backup_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.db`;
}

export async function createDatabaseBackup() {
  ensureBackupDirectory();

  const fileName =
    createBackupFileName();

  const backupPath =
    path.join(
      backupDir,
      fileName
    );

  await db.backup(backupPath);

  const stats =
    fs.statSync(backupPath);

  return {
    fileName,
    backupPath,
    sizeBytes: stats.size,
    createdAt:
      new Date().toISOString(),
  };
}

export function getBackups() {
  ensureBackupDirectory();

  return fs
    .readdirSync(backupDir)
    .filter((file) =>
      file.endsWith(".db")
    )
    .map((file) => {
      const fullPath =
        path.join(
          backupDir,
          file
        );

      const stats =
        fs.statSync(fullPath);

      return {
        fileName: file,
        sizeBytes: stats.size,
        createdAt:
          stats.birthtime.toISOString(),
        modifiedAt:
          stats.mtime.toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.modifiedAt) -
        new Date(a.modifiedAt)
    );
}

export function cleanupOldBackups(maxBackups = 30) {
  ensureBackupDirectory();

  const files = fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      const stats = fs.statSync(fullPath);

      return {
        file,
        fullPath,
        modifiedAt: stats.mtime,
      };
    })
    .sort(
      (a, b) =>
        b.modifiedAt.getTime() -
        a.modifiedAt.getTime()
    );

  const oldFiles = files.slice(maxBackups);

  for (const backup of oldFiles) {
    fs.unlinkSync(backup.fullPath);
  }
}