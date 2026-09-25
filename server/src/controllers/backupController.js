import {
  createDatabaseBackup,
  getBackupDirectory,
  listDatabaseBackups,
} from "../services/backupService.js";

export function listBackups(
  req,
  res,
) {
  try {
    return res.json({
      success: true,
      backups:
        listDatabaseBackups(),
      backupDirectory:
        getBackupDirectory(),
    });
  } catch (error) {
    console.error(
      "Backup history error:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          error?.message ||
          "Unable to load database backup history.",
      });
  }
}

export async function createBackup(
  req,
  res,
) {
  try {
    const backup =
      await createDatabaseBackup();

    return res
      .status(201)
      .json({
        success: true,
        message:
          "Database backup created and verified successfully.",
        backup,
        backupDirectory:
          getBackupDirectory(),
      });
  } catch (error) {
    console.error(
      "Database backup error:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          error?.message ||
          "Unable to create database backup.",
      });
  }
}
