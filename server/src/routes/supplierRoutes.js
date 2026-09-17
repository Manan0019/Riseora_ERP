import express from "express";

import {
  listSuppliers,
  addSupplier,
  editSupplier,
  removeSupplier,
  restoreSupplier,
} from "../controllers/supplierController.js";

const router = express.Router();

router.get("/", listSuppliers);
router.post("/", addSupplier);
router.put("/:id", editSupplier);

router.patch(
  "/:id/deactivate",
  removeSupplier
);

router.patch(
  "/:id/activate",
  restoreSupplier
);

export default router;