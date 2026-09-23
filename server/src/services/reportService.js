import db from "../db/database.js";

import { getCompany } from "./companyService.js";
import { getCustomerLedger, getCustomerOutstanding } from "./customerLedgerService.js";
import { getSupplierLedger, getSupplierOutstanding } from "./supplierLedgerService.js";

const EPSILON = 0.000001;

function num(value) {
  return Number(value || 0);
}

function cleanDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getDateRange(filters) {
  return {
    fromDate: cleanDate(filters.fromDate),
    toDate: cleanDate(filters.toDate),
  };
}

function addDateFilter(conditions, params, column, filters) {
  const { fromDate, toDate } = getDateRange(filters);
  if (fromDate) {
    conditions.push(`${column} >= ?`);
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push(`${column} <= ?`);
    params.push(toDate);
  }
}

function reportBase(key, title, description, columns, rows, summary = [], notes = []) {
  return {
    key,
    title,
    description,
    generatedAt: new Date().toISOString(),
    company: getCompany() || null,
    columns,
    rows,
    summary,
    notes,
  };
}

const columns = {
  salesRegister: [
    { key: "invoice_no", label: "Invoice", format: "text" },
    { key: "invoice_date", label: "Date", format: "date" },
    { key: "due_date", label: "Due Date", format: "date" },
    { key: "customer_name", label: "Customer", format: "text" },
    { key: "grand_total", label: "Invoice Total", format: "currency" },
    { key: "credited_amount", label: "Credit Notes", format: "currency" },
    { key: "effective_total", label: "Net Invoice", format: "currency" },
    { key: "net_paid", label: "Net Paid", format: "currency" },
    { key: "balance_amount", label: "Balance", format: "currency" },
    { key: "payment_status", label: "Payment Status", format: "text" },
    { key: "status", label: "Invoice Status", format: "text" },
  ],
  salesProfitability: [
    { key: "invoice_no", label: "Invoice", format: "text" },
    { key: "invoice_date", label: "Date", format: "date" },
    { key: "customer_name", label: "Customer", format: "text" },
    { key: "net_sales", label: "Net Sales", format: "currency" },
    { key: "net_cogs", label: "COGS", format: "currency" },
    { key: "gross_profit", label: "Gross Profit", format: "currency" },
    { key: "gross_margin_percent", label: "Margin %", format: "percent" },
  ],
  purchaseRegister: [
    { key: "purchase_no", label: "Purchase", format: "text" },
    { key: "purchase_date", label: "Date", format: "date" },
    { key: "due_date", label: "Due Date", format: "date" },
    { key: "supplier_name", label: "Supplier", format: "text" },
    { key: "supplier_invoice_no", label: "Supplier Invoice", format: "text" },
    { key: "subtotal", label: "Taxable", format: "currency" },
    { key: "gst_amount", label: "GST", format: "currency" },
    { key: "freight_amount", label: "Freight", format: "currency" },
    { key: "other_charges", label: "Other Charges", format: "currency" },
    { key: "grand_total", label: "Grand Total", format: "currency" },
    { key: "amount_paid", label: "Paid", format: "currency" },
    { key: "balance_amount", label: "Balance", format: "currency" },
    { key: "status", label: "Status", format: "text" },
  ],
  currentStock: [
    { key: "code", label: "Code", format: "text" },
    { key: "name", label: "Item", format: "text" },
    { key: "category_name", label: "Category", format: "text" },
    { key: "current_stock", label: "Physical Qty", format: "quantity" },
    { key: "costing_quantity", label: "Costing Qty", format: "quantity" },
    { key: "unit_code", label: "Unit", format: "text" },
    { key: "average_cost", label: "Average Cost", format: "currency" },
    { key: "inventory_value", label: "Inventory Value", format: "currency" },
    { key: "costing_status", label: "Costing", format: "text" },
  ],
  stockLedger: [
    { key: "transaction_date", label: "Date", format: "date" },
    { key: "transaction_type", label: "Type", format: "text" },
    { key: "reference_no", label: "Reference", format: "text" },
    { key: "lot_no", label: "Lot", format: "text" },
    { key: "quantity_in", label: "In", format: "quantity" },
    { key: "quantity_out", label: "Out", format: "quantity" },
    { key: "unit_cost", label: "Unit Cost", format: "currency" },
    { key: "running_balance", label: "Balance", format: "quantity" },
  ],
  productionRegister: [
    { key: "batch_no", label: "Batch", format: "text" },
    { key: "production_date", label: "Date", format: "date" },
    { key: "product_name", label: "Product", format: "text" },
    { key: "formula_label", label: "Formula", format: "text" },
    { key: "planned_batch_size", label: "Planned", format: "quantity" },
    { key: "good_output_qty", label: "Good Output", format: "quantity" },
    { key: "rejected_qty", label: "Rejected", format: "quantity" },
    { key: "rework_qty", label: "Rework", format: "quantity" },
    { key: "scrap_qty", label: "Scrap", format: "quantity" },
    { key: "yield_percent", label: "Yield %", format: "percent" },
    { key: "status", label: "Status", format: "text" },
    { key: "qc_status", label: "QC", format: "text" },
  ],
  productionCosting: [
    { key: "batch_no", label: "Batch", format: "text" },
    { key: "production_date", label: "Date", format: "date" },
    { key: "product_name", label: "Product", format: "text" },
    { key: "good_output_qty", label: "Good Output", format: "quantity" },
    { key: "material_cost", label: "Material", format: "currency" },
    { key: "labour_cost", label: "Labour", format: "currency" },
    { key: "electricity_cost", label: "Electricity", format: "currency" },
    { key: "other_overhead_cost", label: "Other OH", format: "currency" },
    { key: "total_production_cost", label: "Total Cost", format: "currency" },
    { key: "finished_unit_cost", label: "Unit Cost", format: "currency" },
    { key: "selling_price_snapshot", label: "Selling Price", format: "currency" },
    { key: "actual_margin_percent", label: "Margin %", format: "percent" },
  ],
  customerOutstanding: [
    { key: "customer_code", label: "Code", format: "text" },
    { key: "customer_name", label: "Customer", format: "text" },
    { key: "customer_type", label: "Type", format: "text" },
    { key: "opening_balance", label: "Opening Balance", format: "currency" },
    { key: "total_sales", label: "Net Sales", format: "currency" },
    { key: "total_paid", label: "Net Paid", format: "currency" },
    { key: "total_credits", label: "Credit Notes", format: "currency" },
    { key: "total_refunds", label: "Refunds", format: "currency" },
    { key: "outstanding", label: "Outstanding", format: "currency" },
  ],
  customerLedger: [
    { key: "transactionDate", label: "Date", format: "date" },
    { key: "transactionType", label: "Type", format: "text" },
    { key: "referenceNo", label: "Reference", format: "text" },
    { key: "debit", label: "Debit", format: "currency" },
    { key: "credit", label: "Credit", format: "currency" },
    { key: "balance", label: "Balance", format: "currency" },
    { key: "notes", label: "Notes", format: "text" },
  ],
  supplierOutstanding: [
    { key: "supplier_code", label: "Code", format: "text" },
    { key: "supplier_name", label: "Supplier", format: "text" },
    { key: "opening_balance", label: "Opening Balance", format: "currency" },
    { key: "total_purchases", label: "Purchases", format: "currency" },
    { key: "total_paid", label: "Paid", format: "currency" },
    { key: "outstanding", label: "Outstanding", format: "currency" },
  ],
  supplierLedger: [
    { key: "transactionDate", label: "Date", format: "date" },
    { key: "transactionType", label: "Type", format: "text" },
    { key: "referenceNo", label: "Reference", format: "text" },
    { key: "debit", label: "Debit", format: "currency" },
    { key: "credit", label: "Credit", format: "currency" },
    { key: "balance", label: "Balance", format: "currency" },
    { key: "notes", label: "Notes", format: "text" },
  ],
  creditNotes: [
    { key: "credit_note_no", label: "Credit Note", format: "text" },
    { key: "credit_note_date", label: "Date", format: "date" },
    { key: "invoice_no", label: "Invoice", format: "text" },
    { key: "customer_name", label: "Customer", format: "text" },
    { key: "reason", label: "Reason", format: "text" },
    { key: "subtotal", label: "Taxable", format: "currency" },
    { key: "gst_amount", label: "GST", format: "currency" },
    { key: "grand_total", label: "Credit Total", format: "currency" },
    { key: "status", label: "Status", format: "text" },
  ],
  refunds: [
    { key: "refund_no", label: "Refund", format: "text" },
    { key: "refund_date", label: "Date", format: "date" },
    { key: "invoice_no", label: "Invoice", format: "text" },
    { key: "customer_name", label: "Customer", format: "text" },
    { key: "amount", label: "Amount", format: "currency" },
    { key: "refund_mode", label: "Mode", format: "text" },
    { key: "reference_no", label: "Reference", format: "text" },
    { key: "status", label: "Status", format: "text" },
  ],
  lowStock: [
    { key: "code", label: "Code", format: "text" },
    { key: "name", label: "Item", format: "text" },
    { key: "category_name", label: "Category", format: "text" },
    { key: "current_stock", label: "Current Stock", format: "quantity" },
    { key: "reorder_level", label: "Reorder Level", format: "quantity" },
    { key: "shortage", label: "Shortage", format: "quantity" },
    { key: "unit_code", label: "Unit", format: "text" },
    { key: "inventory_value", label: "Inventory Value", format: "currency" },
  ],
  expiry: [
    { key: "code", label: "Code", format: "text" },
    { key: "name", label: "Item", format: "text" },
    { key: "lot_no", label: "Lot / Batch", format: "text" },
    { key: "expiry_date", label: "Expiry", format: "date" },
    { key: "balance_quantity", label: "Recorded Lot Qty", format: "quantity" },
    { key: "unit_code", label: "Unit", format: "text" },
    { key: "days_remaining", label: "Days Remaining", format: "integer" },
    { key: "expiry_status", label: "Status", format: "text" },
  ],
};

function salesRegister(filters) {
  const conditions = ["1 = 1"];
  const params = [];
  addDateFilter(conditions, params, "si.invoice_date", filters);

  const customerId = positiveId(filters.customerId);
  if (customerId) {
    conditions.push("si.customer_id = ?");
    params.push(customerId);
  }

  if (filters.status && ["POSTED", "CANCELLED"].includes(filters.status)) {
    conditions.push("si.status = ?");
    params.push(filters.status);
  }

  const rows = db.prepare(`
    SELECT
      si.id,
      si.invoice_no,
      si.invoice_date,
      si.due_date,
      COALESCE(si.buyer_name, c.name) AS customer_name,
      si.grand_total,
      COALESCE((
        SELECT SUM(scn.grand_total)
        FROM sales_credit_notes scn
        WHERE scn.sales_invoice_id = si.id AND scn.status = 'POSTED'
      ), 0) AS credited_amount,
      COALESCE((
        SELECT SUM(sr.amount)
        FROM sales_refunds sr
        WHERE sr.sales_invoice_id = si.id AND sr.status = 'POSTED'
      ), 0) AS refunded_amount,
      si.amount_paid,
      si.payment_status,
      si.status
    FROM sales_invoices si
    INNER JOIN customers c ON c.id = si.customer_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY si.invoice_date, si.id
  `).all(...params).map((row) => {
    const effectiveTotal = row.status === "POSTED"
      ? Math.max(0, num(row.grand_total) - num(row.credited_amount))
      : 0;
    const netPaid = row.status === "POSTED"
      ? Math.max(0, num(row.amount_paid) - num(row.refunded_amount))
      : 0;
    return {
      ...row,
      effective_total: effectiveTotal,
      net_paid: netPaid,
      balance_amount: effectiveTotal - netPaid,
    };
  });

  const posted = rows.filter((row) => row.status === "POSTED");
  return reportBase(
    "sales-register",
    "Sales Register",
    "Invoice, collection, credit-note and outstanding summary.",
    columns.salesRegister,
    rows,
    [
      { label: "Net Invoice Value", value: posted.reduce((t, r) => t + num(r.effective_total), 0), format: "currency" },
      { label: "Net Paid", value: posted.reduce((t, r) => t + num(r.net_paid), 0), format: "currency" },
      { label: "Outstanding", value: posted.reduce((t, r) => t + num(r.balance_amount), 0), format: "currency" },
    ],
  );
}

function salesProfitability(filters) {
  const conditions = ["si.status = 'POSTED'"];
  const params = [];
  addDateFilter(conditions, params, "si.invoice_date", filters);
  const customerId = positiveId(filters.customerId);
  if (customerId) {
    conditions.push("si.customer_id = ?");
    params.push(customerId);
  }

  const rows = db.prepare(`
    SELECT
      si.id,
      si.invoice_no,
      si.invoice_date,
      COALESCE(si.buyer_name, c.name) AS customer_name,
      (si.subtotal - si.discount_amount) AS original_net_sales,
      COALESCE((
        SELECT SUM(scni.taxable_amount)
        FROM sales_credit_note_items scni
        INNER JOIN sales_credit_notes scn ON scn.id = scni.sales_credit_note_id
        WHERE scn.sales_invoice_id = si.id AND scn.status = 'POSTED'
      ), 0) AS returned_taxable,
      COALESCE((
        SELECT SUM(scn.discount_amount)
        FROM sales_credit_notes scn
        WHERE scn.sales_invoice_id = si.id AND scn.status = 'POSTED'
      ), 0) AS returned_invoice_discount,
      COALESCE((
        SELECT SUM(
          sitem.quantity * COALESCE((
            SELECT st.unit_cost
            FROM stock_transactions st
            WHERE st.reference_type = 'SALE'
              AND st.reference_id = si.id
              AND st.item_id = sitem.item_id
              AND st.transaction_type = 'SALE'
            ORDER BY st.id
            LIMIT 1
          ), 0)
        )
        FROM sales_items sitem
        WHERE sitem.sales_invoice_id = si.id
      ), 0) AS original_cogs,
      COALESCE((
        SELECT SUM(scni.quantity * scni.unit_cost)
        FROM sales_credit_note_items scni
        INNER JOIN sales_credit_notes scn ON scn.id = scni.sales_credit_note_id
        WHERE scn.sales_invoice_id = si.id AND scn.status = 'POSTED'
      ), 0) AS returned_cogs
    FROM sales_invoices si
    INNER JOIN customers c ON c.id = si.customer_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY si.invoice_date, si.id
  `).all(...params).map((row) => {
    const returnedNetSales = num(row.returned_taxable) - num(row.returned_invoice_discount);
    const netSales = Math.max(0, num(row.original_net_sales) - returnedNetSales);
    const netCogs = Math.max(0, num(row.original_cogs) - num(row.returned_cogs));
    const grossProfit = netSales - netCogs;
    return {
      ...row,
      net_sales: netSales,
      net_cogs: netCogs,
      gross_profit: grossProfit,
      gross_margin_percent: netSales > EPSILON ? (grossProfit / netSales) * 100 : 0,
    };
  });

  const totalSales = rows.reduce((t, r) => t + num(r.net_sales), 0);
  const totalCogs = rows.reduce((t, r) => t + num(r.net_cogs), 0);
  const grossProfit = totalSales - totalCogs;
  return reportBase(
    "sales-profitability",
    "Sales Profitability",
    "Net sales, COGS, gross profit and gross margin after posted returns.",
    columns.salesProfitability,
    rows,
    [
      { label: "Net Sales", value: totalSales, format: "currency" },
      { label: "COGS", value: totalCogs, format: "currency" },
      { label: "Gross Profit", value: grossProfit, format: "currency" },
      { label: "Gross Margin", value: totalSales > EPSILON ? (grossProfit / totalSales) * 100 : 0, format: "percent" },
    ],
  );
}

function purchaseRegister(filters) {
  const conditions = ["1 = 1"];
  const params = [];
  addDateFilter(conditions, params, "p.purchase_date", filters);
  const supplierId = positiveId(filters.supplierId);
  if (supplierId) {
    conditions.push("p.supplier_id = ?");
    params.push(supplierId);
  }
  if (filters.status && ["POSTED", "CANCELLED"].includes(filters.status)) {
    conditions.push("p.status = ?");
    params.push(filters.status);
  }

  const rows = db.prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      CASE WHEN p.status = 'POSTED'
        THEN p.grand_total - p.amount_paid
        ELSE 0
      END AS balance_amount
    FROM purchases p
    INNER JOIN suppliers s ON s.id = p.supplier_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.purchase_date, p.id
  `).all(...params);

  const posted = rows.filter((row) => row.status === "POSTED");
  return reportBase(
    "purchase-register",
    "Purchase Register",
    "Purchase value, GST, charges, payments and supplier balances.",
    columns.purchaseRegister,
    rows,
    [
      { label: "Purchase Value", value: posted.reduce((t, r) => t + num(r.grand_total), 0), format: "currency" },
      { label: "Paid", value: posted.reduce((t, r) => t + num(r.amount_paid), 0), format: "currency" },
      { label: "Outstanding", value: posted.reduce((t, r) => t + num(r.balance_amount), 0), format: "currency" },
    ],
  );
}

function currentStock(filters, valuationOnly = false) {
  const conditions = ["i.is_active = 1"];
  const params = [];
  const categoryId = positiveId(filters.categoryId);
  if (categoryId) {
    conditions.push("i.category_id = ?");
    params.push(categoryId);
  }

  const rows = db.prepare(`
    SELECT
      i.id,
      i.code,
      i.name,
      c.name AS category_name,
      c.code AS category_code,
      c.inventory_role AS category_role,
      u.code AS unit_code,
      COALESCE(SUM(st.quantity_in - st.quantity_out), 0) AS current_stock,
      COALESCE(ics.quantity, 0) AS costing_quantity,
      COALESCE(ics.average_cost, 0) AS average_cost,
      COALESCE(ics.inventory_value, 0) AS inventory_value
    FROM items i
    INNER JOIN item_categories c ON c.id = i.category_id
    INNER JOIN units u ON u.id = i.base_unit_id
    LEFT JOIN stock_transactions st ON st.item_id = i.id
    LEFT JOIN inventory_cost_state ics ON ics.item_id = i.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY i.id, i.code, i.name, c.name, c.code, c.inventory_role, u.code,
             ics.quantity, ics.average_cost, ics.inventory_value
    ORDER BY c.name, i.name
  `).all(...params).map((row) => ({
    ...row,
    costing_status: Math.abs(num(row.current_stock) - num(row.costing_quantity)) < EPSILON ? "OK" : "MISMATCH",
  }));

  return reportBase(
    valuationOnly ? "stock-valuation" : "current-stock",
    valuationOnly ? "Stock Valuation" : "Current Stock",
    valuationOnly
      ? "Current inventory quantity, weighted-average cost and inventory value."
      : "Physical stock compared with inventory costing state.",
    columns.currentStock,
    rows,
    [
      { label: "Inventory Value", value: rows.reduce((t, r) => t + num(r.inventory_value), 0), format: "currency" },
      { label: "Costing Mismatches", value: rows.filter((r) => r.costing_status === "MISMATCH").length, format: "integer" },
    ],
  );
}

function stockLedger(filters) {
  const itemId = positiveId(filters.itemId);
  if (!itemId) throw new Error("Select an item for the Stock Ledger report.");

  const item = db.prepare(`
    SELECT i.id, i.code, i.name, u.code AS unit_code
    FROM items i
    INNER JOIN units u ON u.id = i.base_unit_id
    WHERE i.id = ?
  `).get(itemId);
  if (!item) throw new Error("Item not found.");

  const conditions = ["st.item_id = ?"];
  const params = [itemId];
  addDateFilter(conditions, params, "st.transaction_date", filters);

  const rows = db.prepare(`
    SELECT
      st.id, st.transaction_date, st.transaction_type, st.reference_no,
      st.lot_no, st.quantity_in, st.quantity_out, st.unit_cost, st.notes
    FROM stock_transactions st
    WHERE ${conditions.join(" AND ")}
    ORDER BY st.transaction_date, st.id
  `).all(...params);

  const { fromDate } = getDateRange(filters);
  const openingBalance = fromDate
    ? num(db.prepare(`
        SELECT COALESCE(SUM(quantity_in - quantity_out), 0) AS balance
        FROM stock_transactions
        WHERE item_id = ? AND transaction_date < ?
      `).get(itemId, fromDate)?.balance)
    : 0;

  let balance = openingBalance;
  const mapped = rows.map((row) => {
    balance += num(row.quantity_in) - num(row.quantity_out);
    return { ...row, running_balance: balance };
  });

  return reportBase(
    "stock-ledger",
    `Stock Ledger — ${item.code} - ${item.name}`,
    `Movement history in ${item.unit_code}.`,
    columns.stockLedger,
    mapped,
    [
      { label: "Opening Balance", value: openingBalance, format: "quantity" },
      { label: "Total In", value: mapped.reduce((t, r) => t + num(r.quantity_in), 0), format: "quantity" },
      { label: "Total Out", value: mapped.reduce((t, r) => t + num(r.quantity_out), 0), format: "quantity" },
      { label: "Closing Balance", value: balance, format: "quantity" },
    ],
  );
}

function productionRows(filters) {
  const conditions = ["1 = 1"];
  const params = [];
  addDateFilter(conditions, params, "pb.production_date", filters);
  const itemId = positiveId(filters.itemId);
  if (itemId) {
    conditions.push("pb.finished_item_id = ?");
    params.push(itemId);
  }
  if (filters.status && ["DRAFT", "IN_PRODUCTION", "COMPLETED", "CLOSED", "CANCELLED"].includes(filters.status)) {
    conditions.push("pb.status = ?");
    params.push(filters.status);
  }

  return db.prepare(`
    SELECT
      pb.*,
      i.code AS product_code,
      i.name AS product_name,
      u.code AS unit_code,
      f.code AS formula_code,
      f.name AS formula_name,
      f.version_no,
      (f.code || ' V' || f.version_no) AS formula_label
    FROM production_batches pb
    INNER JOIN items i ON i.id = pb.finished_item_id
    INNER JOIN units u ON u.id = pb.batch_unit_id
    INNER JOIN formulas f ON f.id = pb.formula_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY pb.production_date, pb.id
  `).all(...params);
}

function productionRegister(filters) {
  const rows = productionRows(filters);
  return reportBase(
    "production-register",
    "Production Register",
    "Planned versus actual output, yield, rejection/rework/scrap and batch status.",
    columns.productionRegister,
    rows,
    [
      { label: "Planned Output", value: rows.reduce((t, r) => t + num(r.planned_batch_size), 0), format: "quantity" },
      { label: "Good Output", value: rows.reduce((t, r) => t + num(r.good_output_qty || r.actual_output_qty), 0), format: "quantity" },
      { label: "Rejected", value: rows.reduce((t, r) => t + num(r.rejected_qty), 0), format: "quantity" },
      { label: "Scrap", value: rows.reduce((t, r) => t + num(r.scrap_qty), 0), format: "quantity" },
    ],
  );
}

function productionCosting(filters) {
  const rows = productionRows(filters).map((row) => {
    const sellingPrice = num(row.selling_price_snapshot);
    const unitCost = num(row.finished_unit_cost);
    const margin = sellingPrice > EPSILON ? ((sellingPrice - unitCost) / sellingPrice) * 100 : 0;
    return { ...row, actual_margin_percent: margin };
  });
  const completed = rows.filter((r) => ["COMPLETED", "CLOSED"].includes(r.status));
  const totalCost = completed.reduce((t, r) => t + num(r.total_production_cost), 0);
  const goodQty = completed.reduce((t, r) => t + num(r.good_output_qty || r.actual_output_qty), 0);
  return reportBase(
    "production-costing",
    "Production Costing",
    "Actual material, overhead, output and finished-unit cost by batch.",
    columns.productionCosting,
    rows,
    [
      { label: "Total Production Cost", value: totalCost, format: "currency" },
      { label: "Good Output", value: goodQty, format: "quantity" },
      { label: "Average Cost / Good Unit", value: goodQty > EPSILON ? totalCost / goodQty : 0, format: "currency" },
    ],
  );
}

function customerOutstandingReport() {
  const rows = getCustomerOutstanding();
  return reportBase(
    "customer-outstanding",
    "Customer Outstanding",
    "Net sales, collections, credit notes, refunds and receivables by customer.",
    columns.customerOutstanding,
    rows,
    [
      { label: "Opening Balance", value: rows.reduce((t, r) => t + num(r.opening_balance), 0), format: "currency" },
      { label: "Net Sales", value: rows.reduce((t, r) => t + num(r.total_sales), 0), format: "currency" },
      { label: "Net Paid", value: rows.reduce((t, r) => t + num(r.total_paid), 0), format: "currency" },
      { label: "Outstanding", value: rows.reduce((t, r) => t + num(r.outstanding), 0), format: "currency" },
    ],
  );
}

function customerLedgerReport(filters) {
  const customerId = positiveId(filters.customerId);
  if (!customerId) throw new Error("Select a customer for the Customer Ledger report.");
  const data = getCustomerLedger(customerId);
  if (!data) throw new Error("Customer not found.");
  const { fromDate, toDate } = getDateRange(filters);
  const rows = data.ledger.filter((row) => {
    if (fromDate && row.transactionDate < fromDate) return false;
    if (toDate && row.transactionDate > toDate) return false;
    return true;
  });
  const priorRows = fromDate
    ? data.ledger.filter((row) => row.transactionDate < fromDate)
    : [];
  const openingAtFromDate = priorRows.length
    ? num(priorRows[priorRows.length - 1].balance)
    : 0;
  const closingBalance = rows.length
    ? num(rows[rows.length - 1].balance)
    : openingAtFromDate;
  return reportBase(
    "customer-ledger",
    `Customer Ledger — ${data.customer.code} - ${data.customer.name}`,
    "Opening balance, invoices, payments, credit notes and refunds.",
    columns.customerLedger,
    rows,
    [
      { label: "Opening at From Date", value: openingAtFromDate, format: "currency" },
      { label: "Period Debit", value: rows.reduce((t, r) => t + num(r.debit), 0), format: "currency" },
      { label: "Period Credit", value: rows.reduce((t, r) => t + num(r.credit), 0), format: "currency" },
      { label: "Closing Balance", value: closingBalance, format: "currency" },
    ],
  );
}

function supplierOutstandingReport() {
  const rows = getSupplierOutstanding();
  return reportBase(
    "supplier-outstanding",
    "Supplier Outstanding",
    "Posted purchases, payments and payable balances by supplier.",
    columns.supplierOutstanding,
    rows,
    [
      { label: "Opening Balance", value: rows.reduce((t, r) => t + num(r.opening_balance), 0), format: "currency" },
      { label: "Purchases", value: rows.reduce((t, r) => t + num(r.total_purchases), 0), format: "currency" },
      { label: "Paid", value: rows.reduce((t, r) => t + num(r.total_paid), 0), format: "currency" },
      { label: "Outstanding", value: rows.reduce((t, r) => t + num(r.outstanding), 0), format: "currency" },
    ],
  );
}

function supplierLedgerReport(filters) {
  const supplierId = positiveId(filters.supplierId);
  if (!supplierId) throw new Error("Select a supplier for the Supplier Ledger report.");
  const data = getSupplierLedger(supplierId);
  if (!data) throw new Error("Supplier not found.");
  const { fromDate, toDate } = getDateRange(filters);
  const rows = data.ledger.filter((row) => {
    if (fromDate && row.transactionDate < fromDate) return false;
    if (toDate && row.transactionDate > toDate) return false;
    return true;
  });
  const priorRows = fromDate
    ? data.ledger.filter((row) => row.transactionDate < fromDate)
    : [];
  const openingAtFromDate = priorRows.length
    ? num(priorRows[priorRows.length - 1].balance)
    : 0;
  const closingBalance = rows.length
    ? num(rows[rows.length - 1].balance)
    : openingAtFromDate;
  return reportBase(
    "supplier-ledger",
    `Supplier Ledger — ${data.supplier.code} - ${data.supplier.name}`,
    "Opening balance, purchases and supplier payments.",
    columns.supplierLedger,
    rows,
    [
      { label: "Opening at From Date", value: openingAtFromDate, format: "currency" },
      { label: "Period Debit", value: rows.reduce((t, r) => t + num(r.debit), 0), format: "currency" },
      { label: "Period Credit", value: rows.reduce((t, r) => t + num(r.credit), 0), format: "currency" },
      { label: "Closing Balance", value: closingBalance, format: "currency" },
    ],
  );
}

function creditNotes(filters) {
  const conditions = ["1 = 1"];
  const params = [];
  addDateFilter(conditions, params, "scn.credit_note_date", filters);
  const customerId = positiveId(filters.customerId);
  if (customerId) {
    conditions.push("scn.customer_id = ?");
    params.push(customerId);
  }
  const rows = db.prepare(`
    SELECT
      scn.*,
      si.invoice_no,
      c.name AS customer_name
    FROM sales_credit_notes scn
    INNER JOIN sales_invoices si ON si.id = scn.sales_invoice_id
    INNER JOIN customers c ON c.id = scn.customer_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY scn.credit_note_date, scn.id
  `).all(...params);
  return reportBase(
    "credit-notes",
    "Sales Return / Credit Note Register",
    "Posted and historical sales credit notes.",
    columns.creditNotes,
    rows,
    [{ label: "Credit Note Value", value: rows.filter((r) => r.status === "POSTED").reduce((t, r) => t + num(r.grand_total), 0), format: "currency" }],
  );
}

function refunds(filters) {
  const conditions = ["1 = 1"];
  const params = [];
  addDateFilter(conditions, params, "sr.refund_date", filters);
  const customerId = positiveId(filters.customerId);
  if (customerId) {
    conditions.push("sr.customer_id = ?");
    params.push(customerId);
  }
  const rows = db.prepare(`
    SELECT
      sr.*,
      si.invoice_no,
      c.name AS customer_name
    FROM sales_refunds sr
    INNER JOIN sales_invoices si ON si.id = sr.sales_invoice_id
    INNER JOIN customers c ON c.id = sr.customer_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY sr.refund_date, sr.id
  `).all(...params);
  return reportBase(
    "refunds",
    "Customer Refund Register",
    "Customer refunds raised after sales credits/returns.",
    columns.refunds,
    rows,
    [{ label: "Refund Value", value: rows.filter((r) => r.status === "POSTED").reduce((t, r) => t + num(r.amount), 0), format: "currency" }],
  );
}

function lowStock(filters) {
  const conditions = ["i.is_active = 1", "i.reorder_level > 0"];
  const params = [];
  const categoryId = positiveId(filters.categoryId);
  if (categoryId) {
    conditions.push("i.category_id = ?");
    params.push(categoryId);
  }
  const rows = db.prepare(`
    SELECT
      i.id, i.code, i.name, i.reorder_level,
      c.name AS category_name,
      u.code AS unit_code,
      COALESCE(SUM(st.quantity_in - st.quantity_out), 0) AS current_stock,
      COALESCE(ics.inventory_value, 0) AS inventory_value
    FROM items i
    INNER JOIN item_categories c ON c.id = i.category_id
    INNER JOIN units u ON u.id = i.base_unit_id
    LEFT JOIN stock_transactions st ON st.item_id = i.id
    LEFT JOIN inventory_cost_state ics ON ics.item_id = i.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY i.id, i.code, i.name, i.reorder_level, c.name, u.code, ics.inventory_value
    HAVING COALESCE(SUM(st.quantity_in - st.quantity_out), 0) <= i.reorder_level
    ORDER BY (i.reorder_level - COALESCE(SUM(st.quantity_in - st.quantity_out), 0)) DESC, i.name
  `).all(...params).map((row) => ({
    ...row,
    shortage: Math.max(0, num(row.reorder_level) - num(row.current_stock)),
  }));
  return reportBase(
    "low-stock",
    "Low Stock Report",
    "Active items at or below their reorder level.",
    columns.lowStock,
    rows,
    [{ label: "Items Requiring Attention", value: rows.length, format: "integer" }],
  );
}

function expiryReport(filters) {
  const horizon = Number(filters.days || 90);
  const days = Number.isFinite(horizon) && horizon >= 0 ? Math.min(horizon, 3650) : 90;
  const categoryId = positiveId(filters.categoryId);
  const conditions = ["i.is_active = 1", "st.expiry_date IS NOT NULL", "TRIM(st.expiry_date) <> ''"];
  const params = [];
  if (categoryId) {
    conditions.push("i.category_id = ?");
    params.push(categoryId);
  }

  const rows = db.prepare(`
    SELECT
      i.code,
      i.name,
      c.name AS category_name,
      u.code AS unit_code,
      COALESCE(st.lot_no, '-') AS lot_no,
      st.expiry_date,
      SUM(st.quantity_in - st.quantity_out) AS balance_quantity,
      CAST(julianday(st.expiry_date) - julianday(date('now', 'localtime')) AS INTEGER) AS days_remaining
    FROM stock_transactions st
    INNER JOIN items i ON i.id = st.item_id
    INNER JOIN item_categories c ON c.id = i.category_id
    INNER JOIN units u ON u.id = i.base_unit_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY i.id, i.code, i.name, c.name, u.code, COALESCE(st.lot_no, '-'), st.expiry_date
    HAVING SUM(st.quantity_in - st.quantity_out) > 0.000001
      AND (julianday(st.expiry_date) - julianday(date('now', 'localtime'))) <= ?
    ORDER BY st.expiry_date, i.name
  `).all(...params, days).map((row) => ({
    ...row,
    expiry_status: num(row.days_remaining) < 0
      ? "EXPIRED"
      : num(row.days_remaining) <= 30
        ? "URGENT"
        : "EXPIRING",
  }));

  return reportBase(
    "expiry",
    "Expiry / Near-Expiry Report",
    `Recorded lot/expiry balances expiring within ${days} days, including already expired stock.`,
    columns.expiry,
    rows,
    [
      { label: "Lots Listed", value: rows.length, format: "integer" },
      { label: "Expired Lots", value: rows.filter((r) => num(r.days_remaining) < 0).length, format: "integer" },
      { label: "Within 30 Days", value: rows.filter((r) => num(r.days_remaining) >= 0 && num(r.days_remaining) <= 30).length, format: "integer" },
    ],
    [
      "This report is based on lot/expiry values recorded on stock movements. Full FEFO/FIFO lot allocation is a separate inventory-control enhancement.",
    ],
  );
}

export const reportCatalog = [
  { key: "sales-register", title: "Sales Register", group: "Sales", filters: ["date", "customer", "status"] },
  { key: "sales-profitability", title: "Sales Profitability", group: "Sales", filters: ["date", "customer"] },
  { key: "credit-notes", title: "Sales Return / Credit Notes", group: "Sales", filters: ["date", "customer"] },
  { key: "refunds", title: "Customer Refunds", group: "Sales", filters: ["date", "customer"] },
  { key: "purchase-register", title: "Purchase Register", group: "Purchase", filters: ["date", "supplier", "status"] },
  { key: "current-stock", title: "Current Stock", group: "Inventory", filters: ["category"] },
  { key: "stock-valuation", title: "Stock Valuation", group: "Inventory", filters: ["category"] },
  { key: "stock-ledger", title: "Stock Ledger", group: "Inventory", filters: ["date", "item"] },
  { key: "low-stock", title: "Low Stock", group: "Inventory", filters: ["category"] },
  { key: "expiry", title: "Expiry / Near Expiry", group: "Inventory", filters: ["category", "days"] },
  { key: "production-register", title: "Production Register", group: "Manufacturing", filters: ["date", "item", "productionStatus"] },
  { key: "production-costing", title: "Production Costing", group: "Manufacturing", filters: ["date", "item", "productionStatus"] },
  { key: "customer-outstanding", title: "Customer Outstanding", group: "Receivables", filters: [] },
  { key: "customer-ledger", title: "Customer Ledger", group: "Receivables", filters: ["date", "customer"] },
  { key: "supplier-outstanding", title: "Supplier Outstanding", group: "Payables", filters: [] },
  { key: "supplier-ledger", title: "Supplier Ledger", group: "Payables", filters: ["date", "supplier"] },
];

export function getReport(reportKey, filters = {}) {
  switch (reportKey) {
    case "sales-register": return salesRegister(filters);
    case "sales-profitability": return salesProfitability(filters);
    case "purchase-register": return purchaseRegister(filters);
    case "current-stock": return currentStock(filters, false);
    case "stock-valuation": return currentStock(filters, true);
    case "stock-ledger": return stockLedger(filters);
    case "production-register": return productionRegister(filters);
    case "production-costing": return productionCosting(filters);
    case "customer-outstanding": return customerOutstandingReport();
    case "customer-ledger": return customerLedgerReport(filters);
    case "supplier-outstanding": return supplierOutstandingReport();
    case "supplier-ledger": return supplierLedgerReport(filters);
    case "credit-notes": return creditNotes(filters);
    case "refunds": return refunds(filters);
    case "low-stock": return lowStock(filters);
    case "expiry": return expiryReport(filters);
    default: throw new Error("Unknown report.");
  }
}
