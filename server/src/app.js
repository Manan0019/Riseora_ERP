import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";

import { initDatabase } from "./db/initDatabase.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

await initDatabase();

app.use("/api/auth", authRoutes);

app.use("/api/company", companyRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/suppliers", supplierRoutes);

app.use("/api/customers", customerRoutes);

app.use("/api/units", unitRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Riseora ERP API is running",
  });
});

app.listen(PORT, () => {
  console.log(`Riseora ERP server running on http://localhost:${PORT}`);
});