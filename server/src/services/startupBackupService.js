import {
  createBackup,
  cleanupOldBackups,
} from "./backupService.js";

export async function runStartupBackup() {
  try {
    await createBackup("startup");
    cleanupOldBackups({ keep: 30, prefix: "startup_" });

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