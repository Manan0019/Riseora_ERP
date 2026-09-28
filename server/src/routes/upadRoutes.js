import express from "express";
import {
  listUpad,
  addUpad,
  editUpad,
  removeUpad,
  restoreUpad,
} from "../controllers/upadController.js";

const router = express.Router();
router.get("/", listUpad);
router.post("/", addUpad);
router.put("/:id", editUpad);
router.patch("/:id/deactivate", removeUpad);
router.patch("/:id/activate", restoreUpad);
export default router;
