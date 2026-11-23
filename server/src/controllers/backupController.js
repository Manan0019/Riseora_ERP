import { backupFileForDownload, stageDatabaseRestore,
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


export function downloadBackup(req, res) {
  try {
    const full = backupFileForDownload(req.params.fileName);
    res.download(full, req.params.fileName);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function requestDatabaseRestore(req, res) {
  try {
    const result = await stageDatabaseRestore(req.body);
    return res.status(202).json({
      success: true,
      message: 'Backup validated and restore scheduled. Close and reopen Riseora ERP to apply it. Do not enter new transactions until restart.',
      ...result,
    });
  } catch (error) {
    console.error('Database restore staging:', error);
    return res.status(400).json({ success: false, message: error?.message || 'Unable to stage database restore.' });
  }
}
