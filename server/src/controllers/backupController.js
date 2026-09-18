import {
  createDatabaseBackup,
  getBackups,
} from "../services/backupService.js";

export async function createBackup(
  req,
  res
) {
  try {
    const backup =
      await createDatabaseBackup();

    return res.status(201).json({
      success: true,
      message:
        "Database backup created successfully",
      backup: {
        fileName:
          backup.fileName,

        sizeBytes:
          backup.sizeBytes,

        createdAt:
          backup.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Backup error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create database backup",
    });
  }
}

export function listBackups(
  req,
  res
) {
  try {
    const backups =
      getBackups();

    return res.json({
      success: true,
      backups,
    });
  } catch (error) {
    console.error(
      "List backups error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load backups",
    });
  }
}