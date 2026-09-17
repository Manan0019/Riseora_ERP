import express from "express";

import {
  listCustomers,
  addCustomer,
  editCustomer,
  removeCustomer,
  restoreCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

router.get("/", listCustomers);
router.post("/", addCustomer);
router.put("/:id", editCustomer);

router.patch(
  "/:id/deactivate",
  removeCustomer
);

router.patch(
  "/:id/activate",
  restoreCustomer
);

export default router;