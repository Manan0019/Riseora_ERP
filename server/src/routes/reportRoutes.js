import express from "express";

import {
  listReports,
  reportData,
  reportExcel,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/", listReports);
router.get("/:reportKey/excel", reportExcel);
router.get("/:reportKey", reportData);

export default router;
