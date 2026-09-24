import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";

import authRoutes from "./routes/authRoutes.js";
import passwordResetRoutes from "./routes/passwordResetRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import openingStockRoutes from "./routes/openingStockRoutes.js";
import stockAdjustmentRoutes from "./routes/stockAdjustmentRoutes.js";
import formulaRoutes from "./routes/formulaRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import customerLedgerRoutes from "./routes/customerLedgerRoutes.js";
import supplierLedgerRoutes from "./routes/supplierLedgerRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import openingBalanceRoutes from "./routes/openingBalanceRoutes.js";
import indiaLocationRoutes from "./routes/indiaLocationRoutes.js";

import {
  requireAuth,
  requireAdmin,
} from "./middleware/authMiddleware.js";

import {
  runStartupBackup,
} from "./services/startupBackupService.js";

import {
  initDatabase,
} from "./db/initDatabase.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const isProduction =
  process.env.NODE_ENV === "production";

const sessionSecret =
  process.env.SESSION_SECRET ||
  (isProduction
    ? null
    : "riseora-development-secret-change-before-production");

if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET is required when NODE_ENV=production.",
  );
}

app.use(
  cors({
    origin:
      process.env.CLIENT_ORIGIN ||
      "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  session({
    name: "riseora.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

await initDatabase();

if (isProduction) {
  await runStartupBackup();
}

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Riseora ERP API is running",
    });
  },
);

/*
 * Authentication remains handled by the existing
 * authRoutes. Password reset is intentionally a
 * separate public router under the same /api/auth
 * prefix so the working login/logout flow stays
 * untouched.
 */
app.use("/api/auth", authRoutes);
app.use(
  "/api/auth",
  passwordResetRoutes,
);

const adminOnly = [
  requireAuth,
  requireAdmin,
];

app.use(
  "/api/company",
  ...adminOnly,
  companyRoutes,
);

app.use(
  "/api/units",
  ...adminOnly,
  unitRoutes,
);

app.use(
  "/api/categories",
  ...adminOnly,
  categoryRoutes,
);

app.use(
  "/api/suppliers",
  ...adminOnly,
  supplierRoutes,
);

app.use(
  "/api/customers",
  ...adminOnly,
  customerRoutes,
);

app.use(
  "/api/items",
  ...adminOnly,
  itemRoutes,
);

app.use(
  "/api/purchases",
  ...adminOnly,
  purchaseRoutes,
);

app.use(
  "/api/stock",
  ...adminOnly,
  stockRoutes,
);

app.use(
  "/api/opening-stock",
  ...adminOnly,
  openingStockRoutes,
);

app.use(
  "/api/stock-adjustments",
  ...adminOnly,
  stockAdjustmentRoutes,
);

app.use(
  "/api/formulas",
  ...adminOnly,
  formulaRoutes,
);

app.use(
  "/api/production",
  ...adminOnly,
  productionRoutes,
);

app.use(
  "/api/sales",
  ...adminOnly,
  salesRoutes,
);

app.use(
  "/api/customer-ledger",
  ...adminOnly,
  customerLedgerRoutes,
);

app.use(
  "/api/supplier-ledger",
  ...adminOnly,
  supplierLedgerRoutes,
);

app.use(
  "/api/dashboard",
  ...adminOnly,
  dashboardRoutes,
);

app.use(
  "/api/reports",
  ...adminOnly,
  reportRoutes,
);

app.use(
  "/api/locations",
  ...adminOnly,
  indiaLocationRoutes,
);

app.use(
  "/api/opening-balances",
  ...adminOnly,
  openingBalanceRoutes,
);

app.use(
  "/api/backups",
  ...adminOnly,
  backupRoutes,
);

app.use(
  (err, req, res, next) => {
    console.error(
      "Unhandled API error:",
      err,
    );

    if (res.headersSent) {
      return next(err);
    }

    return res.status(500).json({
      success: false,
      message: "Unexpected server error.",
    });
  },
);

app.listen(
  PORT,
  () => {
    console.log(
      `Riseora ERP server running on http://localhost:${PORT}`,
    );
  },
);
