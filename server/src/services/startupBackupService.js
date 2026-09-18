import {
  createDatabaseBackup,
  cleanupOldBackups,
} from "./backupService.js";

export async function runStartupBackup() {
  try {
    await createDatabaseBackup();
    cleanupOldBackups(30);

    console.log(
      "Startup database backup completed"
    );
  } catch (error) {
    console.error(
      "Startup backup failed:",
      error
    );
  }
}