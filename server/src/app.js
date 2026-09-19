import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import session from "express-session";
import { requireAuth, requireAdmin } from "./middleware/authMiddleware.js";
import backupRoutes from "./routes/backupRoutes.js";
import { runStartupBackup } from "./services/startupBackupService.js";
import itemRoutes from "./routes/itemRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import openingStockRoutes from "./routes/openingStockRoutes.js";
import stockAdjustmentRoutes from "./routes/stockAdjustmentRoutes.js";
import formulaRoutes from "./routes/formulaRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";

import { initDatabase } from "./db/initDatabase.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    name: "riseora.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

await initDatabase();
if (process.env.NODE_ENV !== "development") {
  await runStartupBackup();
}
///await runStartupBackup();

app.use("/api/auth", authRoutes);

app.use("/api/company", companyRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/suppliers", supplierRoutes);

app.use("/api/customers", customerRoutes);

app.use("/api/units", unitRoutes);

app.use("/api/backups", requireAuth, requireAdmin, backupRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Riseora ERP API is running",
  });
});

app.use(
  "/api/company",
  requireAuth,
  requireAdmin,
  companyRoutes
);

app.use(
  "/api/units",
  requireAuth,
  requireAdmin,
  unitRoutes
);

app.use(
  "/api/categories",
  requireAuth,
  requireAdmin,
  categoryRoutes
);

app.use(
  "/api/suppliers",
  requireAuth,
  requireAdmin,
  supplierRoutes
);

app.use(
  "/api/customers",
  requireAuth,
  requireAdmin,
  customerRoutes
);

app.use(
  "/api/items",
  requireAuth,
  requireAdmin,
  itemRoutes
);

app.use(
  "/api/purchases",
  requireAuth,
  requireAdmin,
  purchaseRoutes
);

app.use(
  "/api/stock",
  requireAuth,
  requireAdmin,
  stockRoutes
);

app.use(
  "/api/opening-stock",
  requireAuth,
  requireAdmin,
  openingStockRoutes
);

app.use(
  "/api/stock-adjustments",
  requireAuth,
  requireAdmin,
  stockAdjustmentRoutes
);

app.use(
  "/api/formulas",
  requireAuth,
  requireAdmin,
  formulaRoutes
);

app.use(
  "/api/production",
  requireAuth,
  requireAdmin,
  productionRoutes
);

app.use(
  "/api/sales",
  requireAuth,
  requireAdmin,
  salesRoutes
);

app.listen(PORT, () => {
  console.log(`Riseora ERP server running on http://localhost:${PORT}`);
});