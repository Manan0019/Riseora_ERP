# Riseora ERP — Herbal & Cosmetic Manufacturing & Inventory System

> *"The Modern Ayurveda"*

An offline-first, lightweight Manufacturing Resource Planning (MRP) and inventory management web app tailored specifically for **Riseora** (Riseora Herbals). Designed to run reliably on a single local workstation with an atomic, ledger-backed architecture that easily scales to local network (LAN) or cloud hosting as production expands.

---

## Key Features

### 1. Dynamic Formulation & Recipe Scaling
- **Proportional Auto-Scaling:** Enter base recipes (e.g., 5 L of herbal hair oil) by percentage, grams, or milliliters, and automatically scale requirements up or down to any target volume (e.g., 10 L, 15 L, 50 L).
- **Formula Versioning:** Edit and improve formulations over time (e.g., `Bhringraj Hair Oil V1` vs. `V2`) while preserving immutable records for past batches.
- **Specific Gravity & Density Conversions:** Accurately interconverts between mass ($g$/$kg$) and liquid volume ($ml$/$L$) so dense extracts and oils don't cause inventory drift.

### 2. Batch Production & Yield Control
- **Atomic Stock Deductions:** Deducts raw herbs, base oils, bottles, caps, and labels in a single transaction while crediting finished bottles to warehouse stock.
- **Wastage & Yield Calculation:** Compares theoretical vs. actual yield to monitor physical losses incurred during boiling, herbal extraction, filtering, and bottling.
- **Traceability & Regulatory Fields:** Records batch numbers, manufacturing dates (Mfg), expiry dates (Exp), and raw ingredient lot numbers for quality audits.

### 3. Inventory & Stock Ledger Engine
- **Transaction-Based Accounting:** Eliminates manual stock overwrites; every movement is recorded as an immutable ledger entry (`PURCHASE_IN`, `PRODUCTION_OUT`, `SALE_OUT`, `ADJUSTMENT`).
- **Unified Item Master:** Manages raw materials, packaging components (bottles, caps, stickers, boxes), and finished goods in a single catalog.
- **Weighted Moving Average (WMA) Costing:** Automatically handles fluctuating ingredient purchase prices to maintain accurate real-time inventory valuations.

### 4. Costing, Pricing & Commercial Margins
- **Layered Cost Tracking:** Separates base manufacturing cost (raw materials + packaging + direct batch labor) from total commercial cost (marketing, shipping, and distribution overhead).
- **Interactive Margin Slider:** Dynamically test markup vs. net profit margins to set profitable retail, wholesale, and distributor prices before tax.

### 5. Invoicing & Customer Receivables
- **Multi-Tier Price Levels:** Supports distinct price points per SKU (MRP, Retail, Wholesale, Distributor).
- **Tax & GST Invoicing:** Supports HSN codes, taxable values, and split tax rates (CGST/SGST/IGST).
- **Customer Payment Ledger:** Manages partial payments, outstanding balances, and credit tracking across Cash, UPI, and Bank Transfers.
- **One-Click Export:** Generates clean, printable PDF tax invoices and detailed Excel (`.xlsx`) ledgers.

### 6. Local Reliability & Data Protection
- **Zero-Cloud Dependency:** Runs completely offline on local hardware with zero subscription overhead.
- **Automated Rolling Backups:** One-click and automated database snapshots with Write-Ahead Logging (WAL) safe exports to external drives or synced cloud folders.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React, Vite, Bootstrap | Responsive, low-latency UI designed for rapid daily operations |
| **Backend** | Node.js (LTS), Express | Lightweight API server handling core business logic |
| **Database** | SQLite via `better-sqlite3` | Zero-configuration, serverless, transactional SQL database |
| **Data Layer** | Drizzle ORM, Zod | Type-safe schema definitions and strict API data validation |
| **Precision Math** | `decimal.js` | Arbitrary-precision math to avoid floating-point errors with rupees, grams, and percentages |
| **Document Export**| `pdfmake`, `exceljs` | Native PDF invoice printing and spreadsheet exports |

---

## Workflow Architecture

[ Purchase Entry ] ────► [ Raw Materials & Packaging Stock IN ] ────► [ Weighted Moving Avg Cost ]
│
[ Riseora Formulas ] ──► [ Batch Production Run ] ◄────────────────────────────────┘
│
┌─────────────┴─────────────┐
▼                           ▼
[ Ingredients Consumed ]      [ Actual Yield / Loss ]
[ Packaging Consumed   ]      [ Finished Goods Stock IN ]
│
[ Price Tiers & GST ] ──► [ Sales Invoice Generation ] ◄─────┘
│
┌─────────────┴─────────────┐
▼                           ▼
[ Finished Stock OUT ]       [ Customer Ledger / Receivables ]

---

## Quick Start (Local Setup)

### Prerequisites
- Node.js (v20+ LTS recommended)
- npm or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/riseora-erp.git
   cd riseora-erp


2. Install backend dependencies:

Bash

cd server
npm install


3. Initialize the SQLite database:

Bash

npm run db:push
npm run db:seed  # Seeds standard units (ml, L, g, kg, pcs) and default categories


4. Install frontend dependencies:

Bash

cd ../client
npm install


5. Start the local server:

Bash

# From the project root
npm run dev

Open your browser and navigate to http://localhost:3000.

Core Database Models
items & item_categories: Unified registry for raw botanicals, packaging materials, and packaged finished goods.

stock_transactions: Immutable double-entry inventory ledger for all receipts, issues, and adjustments.

formulas, formula_versions, & formula_ingredients: Version-locked recipes with density parameters and unit definitions.

production_batches & production_consumption: Tracks planned vs. actual material usage, batch numbers, and yields.

sales_invoices, sales_invoice_items, & payments: Order-level tax breakdowns, balance tracking, and customer credit ledger.

Future Growth & Expansion
When Riseora expands operations beyond the primary workstation:

Local Area Network (LAN): Bind the Node.js server to the host PC's local IP address (0.0.0.0:3000) so warehouse and packing tablets or secondary office PCs on the same Wi-Fi network can access the system via their web browsers.

PostgreSQL Migration: Migrate from better-sqlite3 to PostgreSQL simply by changing the Drizzle ORM dialect, allowing seamless deployment to a secure cloud server or VPS when opening additional facilities.

License
Proprietary software built for Riseora Herbals. All rights reserved.