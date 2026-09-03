import express from "express";
import {
  getCompanyDetails,
  saveCompanyDetails,
} from "../controllers/companyController.js";

const router = express.Router();

router.get("/", getCompanyDetails);
router.put("/", saveCompanyDetails);

export default router;