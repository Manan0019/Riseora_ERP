import express from "express";
import { previewDatabaseRestore } from "../services/backupService.js";

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
router.post('/restore-preview', express.raw({type:'application/octet-stream',limit:'250mb'}), (req,res)=>{try {res.json({summary:previewDatabaseRestore(req.body)});}catch(e){res.status(400).json({message:e.message});}});
router.post('/restore', express.raw({ type: 'application/octet-stream', limit: '250mb' }), requestDatabaseRestore);

export default router;
