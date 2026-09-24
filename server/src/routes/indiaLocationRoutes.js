import { Router } from "express";
import {
  getIndiaLocationInfo,
  getIndiaPincode,
  listIndiaCities,
  listIndiaStates,
} from "../controllers/indiaLocationController.js";

const router = Router();

router.get("/", getIndiaLocationInfo);
router.get("/states", listIndiaStates);
router.get("/cities", listIndiaCities);
router.get("/pincode/:pincode", getIndiaPincode);

export default router;
