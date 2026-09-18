import express from "express";

import {
  listItems,
  addItem,
  editItem,
  removeItem,
  restoreItem,
} from "../controllers/itemController.js";

const router =
  express.Router();

router.get("/", listItems);
router.post("/", addItem);
router.put("/:id", editItem);

router.patch(
  "/:id/deactivate",
  removeItem
);

router.patch(
  "/:id/activate",
  restoreItem
);

export default router;