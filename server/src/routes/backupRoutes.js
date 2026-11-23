import express from "express";

import {
  createBackup,
  listBackups,
  downloadBackup,
  requestDatabaseRestore,
} from "../controllers/backupController.js";

const router =
  express.Router();

router.get(
  "/",
  listBackups,
);

router.post(
  "/",
  createBackup,
);

// Raw SQLite upload is limited to 250 MB; JSON middleware does not parse octet-stream.
router.get('/:fileName/download', downloadBackup);
router.post('/restore', express.raw({ type: 'application/octet-stream', limit: '250mb' }), requestDatabaseRestore);

export default router;
