import express from "express";

import {
  listCategories,
  addCategory,
  editCategory,
  removeCategory,
  restoreCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", listCategories);
router.post("/", addCategory);
router.put("/:id", editCategory);
router.patch("/:id/deactivate", removeCategory);
router.patch("/:id/activate", restoreCategory);

export default router;