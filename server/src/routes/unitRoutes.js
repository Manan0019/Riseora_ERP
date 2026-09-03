import express from "express";

import {
  listUnits,
  addUnit,
  editUnit,
  removeUnit,
  restoreUnit,
} from "../controllers/unitController.js";

const router = express.Router();

router.get("/", listUnits);
router.post("/", addUnit);
router.put("/:id", editUnit);
router.patch("/:id/deactivate", removeUnit);
router.patch("/:id/activate", restoreUnit);

export default router;