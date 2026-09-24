# Riseora ERP — Version 1.0 Release & Handover

**Release status:** READY FOR LIVE USE  
**Release date:** 24 September 2026  
**Project:** Riseora Herbals ERP  
**Technology:** React + Vite frontend, Node/Express backend, SQLite database

---

## 1. Project Location

```text
D:\Manan\Website\Riseora Herbals\Riseora ERP
```

### Backend

```text
D:\Manan\Website\Riseora Herbals\Riseora ERP\server
```

### Frontend

```text
D:\Manan\Website\Riseora Herbals\Riseora ERP\client
```

### Production Database

```text
D:\Manan\Website\Riseora Herbals\Riseora ERP\data\riseora_erp.db
```

---

## 2. Startup Commands

### Start Backend

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\server"
npm run dev
```

Expected API:

```text
http://localhost:5000
```

### Start Frontend

```powershell
cd "D:\Manan\Website\Riseora Herbals\Riseora ERP\client"
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## 3. Critical Production Rule

**DO NOT rerun the production-reset script on the live database.**

Do not run:

```powershell
npm run prepare:production -- --confirm
```

unless a completely new intentional database reset is required and a verified backup exists.

---

## 4. Production Backup

Before major upgrades:

1. Stop normal data entry.
2. Back up the project folder.
3. Back up `data\riseora_erp.db`.
4. If SQLite WAL/SHM files exist, either copy them together with the DB or stop the backend before copying.
5. Keep at least one known-good backup outside the project folder.

Never test destructive migrations against the live database.

---

## 5. Environment Configuration

Main server environment file:

```text
server\.env
```

Typical shape:

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

SESSION_SECRET=YOUR_RANDOM_SECRET

INITIAL_ADMIN_USERNAME=ram
INITIAL_ADMIN_FULL_NAME=Ram
INITIAL_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=riseoraherbals@gmail.com
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD_WITHOUT_SPACES
SMTP_FROM="Riseora Herbals <riseoraherbals@gmail.com>"

PASSWORD_RESET_OTP_MINUTES=10
PASSWORD_RESET_RESEND_SECONDS=60
PASSWORD_RESET_MAX_ATTEMPTS=5
```

Security:
- Never commit `.env`.
- Never share the Gmail App Password.
- Revoke any exposed App Password and create a new one.
- Keep `NODE_ENV=development` while using the current local HTTP setup.

---

## 6. Version 1.0 Functional Scope

### Authentication
- Administrator login
- Forgot Password
- 6-digit email OTP
- OTP expiry, resend cooldown and attempt limit
- Password replacement
- Gmail SMTP support

### Company / Customer / Supplier
- Company master
- Primary and alternate phone where applicable
- Address details
- PIN → City/State auto-fill
- Searchable City/State
- GST/contact/bank/payment details
- Active/inactive handling

### Item & Inventory Masters
- 210-item owner catalog
- Units
- Categories and inventory roles
- Raw materials
- Packaging
- Finished goods
- Consumables
- Lot/expiry configuration
- Selling price and margin fields

### Formula Management
- Standard formula
- Fixed quantity mode
- Percentage mode
- Formula scaling
- Process Allowance / Extra Ingredients
- Packaging outside RAW 100% composition
- Used-formula history protection
- Searchable item selectors

### Purchase
- Searchable Supplier and Item selection
- Purchase posting
- GST
- Freight/other charges
- Lot/expiry
- Inventory increase
- Supplier outstanding/payment
- Duplicate supplier invoice protection
- Cancellation safeguards

### Inventory
- Opening stock
- Stock adjustment
- Current stock
- Stock ledger
- Inventory costing
- Low-stock / reorder support
- Searchable item selectors

### Production
- Planning and formula scaling
- Material requirements
- WIP issue
- Planned vs Actual consumption
- Material variance
- Waste recording
- Unused material return
- Extra consumption beyond issue
- Process Allowance
- Good / Rejected / Rework / Scrap outcome
- Output variance and yield
- Labour, electricity and other manufacturing cost
- Finished unit cost
- Finished-stock posting
- QC and close
- Safe correction with audit trail

### Actual-Only / Unplanned Material
Production Work supports:

```text
+ Add Actual Material
```

Rules:
- Does not alter Formula Master
- Reason required
- Stock deducted
- Cost included in batch cost
- Shown in Production Register
- Correction reverses old usage before corrected usage is posted
- Repeated standard extras belong in Formula / Process Allowance

### Sales
- Searchable Customer and Product
- Invoice posting
- GST / discounts
- Stock reduction
- COGS
- Margin/profit
- Outstanding/payment
- Credit note / return
- Refund
- Cancellation safeguards

### Invoice
- Professional A4 layout
- Full-page height
- Blank space retained when few items exist
- Totals lower on page
- Footer at bottom
- Combined Company Stamp & Authorised Signatory area
- Bank/payment/GST information
- Amount in words
- Print / Save PDF

### Reports
- Sales Register
- Purchase Register
- Production Register
- Current Stock
- Stock Valuation
- Stock Ledger
- Low Stock
- Expiry / Near Expiry
- Sales Profitability
- Customer/Supplier Outstanding
- Customer/Supplier Ledger
- Excel export
- Print / PDF
- Searchable long-list filters

### UI / UX
- Riseora peach/beige design
- PNG branding
- Sidebar navigation
- Reusable confirmation dialogs
- Toast notifications
- Searchable ERP selectors
- Keyboard navigation
- Responsive transaction tables

---

## 7. Searchable Selector Behaviour

```text
Type       -> Filter
Up/Down    -> Navigate
Enter      -> Select
Esc        -> Close
Clear      -> Remove selection
```

Keep small fixed lists such as GST rate, status and payment mode as ordinary dropdowns.

---

## 8. Production Business Rule

Formula = standard recipe.  
Production Plan = intended batch.  
Actual Production = what really happened.

Example:

```text
Planned Output = 20 PCS
Good Output    = 19 PCS
```

Finished stock receives 19.

If:

```text
Good Output = 21 PCS
```

finished stock receives 21 and the ERP records positive variance.

### Packaging

```text
Planned Bottle = 20
Actual Used    = 19
```

Unused quantity returns to inventory.

```text
Planned Bottle = 20
Actual Used    = 21
```

Extra available quantity is consumed from inventory.

### Waste

```text
Actual Consumed = 20
Waste           = 1
```

means all 20 were consumed and 1 was lost/damaged.

This differs from:

```text
Actual Consumed = 19
Waste           = 0
```

where the unused issued quantity can return to stock.

---

## 9. Corrections and Audit

Do not silently rewrite posted history.

Use:
- Production Correction
- Sales Credit Note
- Refund
- Cancellation
- Stock Adjustment

Production corrections require a reason and reverse eligible prior movements before corrected values are applied.

---

## 10. Tests Completed

### Production Actual-Only Material Regression

```text
RESULT: PASS — production actual-only material completion + correction
```

The regression runs against a temporary SQLite database, not the live database.

### OTP / Password Reset
Manually tested successfully.

### Production Actuals UI
Manually tested successfully.

---

## 11. Recommended Live Workflow

```text
Masters
   ↓
Purchase
   ↓
Stock
   ↓
Formula
   ↓
Production Plan
   ↓
Start Production
   ↓
Actual Consumption / Actual Materials
   ↓
Production Output
   ↓
QC / Close
   ↓
Sales
   ↓
Payment / Ledger
   ↓
Reports
```

---

## 12. Version 1.0 Freeze Rule

Version 1.0 is the stable production baseline.

From this point:
- avoid unnecessary redesign
- do not casually alter stock/cost/accounting logic
- back up before migrations
- test on temporary/test databases first
- run regression and manual UI tests
- implement future functionality as controlled V1.1+ changes

---

## 13. Suggested V1.1 Backlog

Only add these when real usage shows a need:

- dedicated Change Password screen
- scheduled backups
- enhanced restore workflow
- stronger GST / phone / IFSC validation
- FEFO/FIFO lot allocation improvements
- customer/supplier statement enhancements
- invoice copy labels if operationally required
- additional dashboard analytics
- optional invoice sharing
- multi-user permissions
- cloud/server deployment

---

## 14. Golden Rule

**The live database is more important than any new feature.**

```text
BACKUP
   ↓
TEST DATABASE
   ↓
RUN REGRESSION
   ↓
MANUAL UI TEST
   ↓
ONLY THEN APPLY TO LIVE
```

---

# V1.0 Status

```text
RISEORA ERP
VERSION 1.0
STATUS: READY FOR LIVE USE
```

This document is the baseline handover for future Riseora ERP development.
