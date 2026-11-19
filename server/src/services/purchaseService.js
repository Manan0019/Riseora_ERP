import db from "../db/database.js";
import { addStockTransaction } from "./stockService.js";
import { addInventoryValue, reverseInventoryReceipt } from "./costService.js";
import { convertQuantityByUnitIds } from "./unitConversionService.js";

function addDaysToDate(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("A valid invoice date is required.");
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function generatePurchaseNumber() {
  const year = new Date().getFullYear();
  const lastPurchase = db.prepare(`SELECT id FROM purchases ORDER BY id DESC LIMIT 1`).get();
  return `PUR-${year}-${String((lastPurchase?.id || 0) + 1).padStart(5, "0")}`;
}

function savePurchaseWithinTransaction(data, previous = null) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("At least one purchase item is required.");
    }

    const invoiceDate = String(data.purchaseDate || "").trim();
    if (!invoiceDate) throw new Error("Invoice date is required.");

    const supplier = db.prepare(`
      SELECT id, code, name, is_active, payment_terms_days
      FROM suppliers WHERE id = ?
    `).get(Number(data.supplierId));

    if (!supplier) throw new Error("Please select a valid supplier.");
    if (Number(supplier.is_active) !== 1) throw new Error("Inactive suppliers cannot be used on a new purchase.");

    const supplierInvoiceNo = String(data.supplierInvoiceNo || "").trim();
    if (supplierInvoiceNo) {
      const duplicateInvoice = db.prepare(`
        SELECT purchase_no
        FROM purchases
        WHERE supplier_id = ?
          AND status = 'POSTED'
          AND id <> ?
          AND UPPER(TRIM(COALESCE(supplier_invoice_no, ''))) = UPPER(?)
        LIMIT 1
      `).get(Number(data.supplierId), previous?.id || -1, supplierInvoiceNo);

      if (duplicateInvoice) {
        throw new Error(`Supplier invoice ${supplierInvoiceNo} is already recorded as ${duplicateInvoice.purchase_no}.`);
      }
    }

    const purchaseNo = previous?.purchase_no || generatePurchaseNumber();
    let subtotal = 0;
    let gstAmount = 0;

    const calculatedItems = data.items.map((item, index) => {
      const entryQuantity = Number(item.quantity);
      const entryRate = Number(item.rate);
      const gstRate = Number(item.gstRate || 0);
      const itemId = Number(item.itemId);

      if (!Number.isInteger(itemId) || itemId <= 0) throw new Error(`Please select a valid item in row ${index + 1}.`);
      if (!Number.isFinite(entryQuantity) || entryQuantity <= 0) throw new Error(`Purchase quantity must be greater than zero in row ${index + 1}.`);
      if (!Number.isFinite(entryRate) || entryRate < 0) throw new Error(`Purchase rate cannot be negative in row ${index + 1}.`);
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) throw new Error(`GST rate must be between 0 and 100 percent in row ${index + 1}.`);

      const masterItem = db.prepare(`
        SELECT id, code, name, is_active, track_lot, track_expiry, base_unit_id, hsn_code
        FROM items WHERE id = ?
      `).get(itemId);

      if (!masterItem) throw new Error(`Item not found in row ${index + 1}.`);
      if (Number(masterItem.is_active) !== 1) throw new Error(`${masterItem.name}: inactive items cannot be purchased.`);

      const lotNo = String(item.lotNo || "").trim();
      const expiryDate = String(item.expiryDate || "").trim();
      const mfgDate = String(item.mfgDate || "").trim();
      if (Number(masterItem.track_lot) === 1 && !lotNo) throw new Error(`${masterItem.name}: lot/batch number is required.`);
      if (Number(masterItem.track_expiry) === 1 && !expiryDate) throw new Error(`${masterItem.name}: expiry date is required.`);
      if (mfgDate && expiryDate && expiryDate < mfgDate) throw new Error(`${masterItem.name}: expiry date cannot be earlier than manufacturing date.`);

      const entryUnitId = Number(item.unitId || masterItem.base_unit_id);
      const quantity = convertQuantityByUnitIds(entryQuantity, entryUnitId, masterItem.base_unit_id);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid converted quantity in row ${index + 1}.`);
      const taxableAmount = item.taxableAmount == null ? entryQuantity * entryRate : Number(item.taxableAmount);
      if (!Number.isFinite(taxableAmount) || taxableAmount < 0 || Math.abs(entryQuantity * entryRate - taxableAmount) > 0.01) {
        throw new Error(`Rate and taxable amount do not match in row ${index + 1}.`);
      }
      const rate = taxableAmount / quantity; // base-unit cost; stock always uses the item's base unit
      const lineGst = taxableAmount * (gstRate / 100);
      const lineTotal = taxableAmount + lineGst;
      subtotal += taxableAmount;
      gstAmount += lineGst;

      return {
        itemId,
        quantity,
        rate,
        entryQuantity,
        entryRate,
        entryUnitId,
        hsnCode: String(masterItem.hsn_code || "").trim().toUpperCase() || null,
        gstRate,
        taxableAmount,
        gstAmount: lineGst,
        lineTotal,
        lotNo: lotNo || null,
        mfgDate: mfgDate || null,
        expiryDate: expiryDate || null,
      };
    });

    const freightAmount = Number(data.freightAmount || 0);
    const otherCharges = Number(data.otherCharges || 0);
    if (!Number.isFinite(freightAmount) || !Number.isFinite(otherCharges) || freightAmount < 0 || otherCharges < 0) {
      throw new Error("Freight and other charges must be valid non-negative amounts.");
    }

    const landedCharges = freightAmount + otherCharges;
    for (const item of calculatedItems) {
      const share = subtotal > 0 ? landedCharges * (item.taxableAmount / subtotal) : 0;
      item.inventoryUnitCost = item.quantity > 0
        ? (item.taxableAmount + share) / item.quantity
        : item.rate;
    }

    const grandTotal = subtotal + gstAmount + freightAmount + otherCharges;
    const paymentDate = String(data.paymentDate || "").trim() || null;
    const paymentAccount = String(data.paymentAccount || "").trim() || null;

    const purchaseResult = previous ? null : db.prepare(`
      INSERT INTO purchases (
        purchase_no, purchase_date, supplier_id, supplier_invoice_no,
        supplier_invoice_date, payment_date, payment_account,
        subtotal, gst_amount, freight_amount, other_charges, grand_total, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseNo,
      invoiceDate,
      Number(data.supplierId),
      supplierInvoiceNo || null,
      // Kept only for backward schema compatibility. V1.1 no longer uses this field in new UI.
      String(data.supplierInvoiceDate || "").trim() || null,
      paymentDate,
      paymentAccount,
      subtotal,
      gstAmount,
      freightAmount,
      otherCharges,
      grandTotal,
      String(data.notes || "").trim() || null,
    );

    const purchaseId = previous ? previous.id : Number(purchaseResult.lastInsertRowid);
    if (previous) {
      db.prepare(`
        UPDATE purchases SET purchase_date = ?, supplier_id = ?, supplier_invoice_no = ?,
          payment_date = ?, payment_account = ?, subtotal = ?, gst_amount = ?, freight_amount = ?,
          other_charges = ?, grand_total = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(invoiceDate, Number(data.supplierId), supplierInvoiceNo || null,
        paymentDate, paymentAccount, subtotal, gstAmount, freightAmount, otherCharges,
        grandTotal, String(data.notes || "").trim() || null, purchaseId);
    }
    const paymentTermsDaysSnapshot = Number(supplier.payment_terms_days || 0);
    const dueDate = addDaysToDate(invoiceDate, paymentTermsDaysSnapshot);

    db.prepare(`
      UPDATE purchases SET payment_terms_days_snapshot = ?, due_date = ? WHERE id = ?
    `).run(paymentTermsDaysSnapshot, dueDate, purchaseId);

    const insertItem = db.prepare(`
      INSERT INTO purchase_items (
        purchase_id, item_id, quantity, rate, taxable_amount, gst_rate,
        gst_amount, line_total, lot_no, mfg_date, expiry_date,
        entry_quantity, entry_unit_id, entry_rate, hsn_code_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of calculatedItems) {
      insertItem.run(
        purchaseId,
        item.itemId,
        item.quantity,
        item.rate,
        item.taxableAmount,
        item.gstRate,
        item.gstAmount,
        item.lineTotal,
        item.lotNo,
        item.mfgDate,
        item.expiryDate,
        item.entryQuantity,
        item.entryUnitId,
        item.entryRate,
        item.hsnCode,
      );

      addInventoryValue(item.itemId, item.quantity, item.inventoryUnitCost);
      addStockTransaction({
        transactionDate: invoiceDate,
        itemId: item.itemId,
        transactionType: "PURCHASE",
        referenceType: "PURCHASE",
        referenceId: purchaseId,
        referenceNo: purchaseNo,
        quantityIn: item.quantity,
        quantityOut: 0,
        unitCost: item.inventoryUnitCost,
        lotNo: item.lotNo,
        expiryDate: item.expiryDate,
        notes: `Purchase ${purchaseNo}`,
      });
    }

    return {
      purchaseId,
      purchaseNo,
      subtotal,
      gstAmount,
      freightAmount,
      otherCharges,
      grandTotal,
      paymentTermsDaysSnapshot,
      dueDate,
      paymentDate,
      paymentAccount,
    };
}

export function createPurchase(data) {
  return db.transaction(() => savePurchaseWithinTransaction(data))();
}

// Corrections are atomic. Keep original number/id; reject any purchase whose receipts
// have subsequent stock movements, or a payment, rather than silently changing COGS.
export function updatePurchase(id, data) {
  return db.transaction(() => {
    const previous = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(Number(id));
    if (!previous) throw new Error("Purchase not found.");
    if (previous.status !== "POSTED") throw new Error("Cancelled purchases cannot be edited.");
    if (Number(previous.amount_paid || 0) > 0 || Number(db.prepare(`SELECT COUNT(*) AS n FROM supplier_payments WHERE purchase_id = ?`).get(previous.id)?.n || 0) > 0) {
      throw new Error("This purchase has recorded supplier payments. Reverse them before correcting the purchase.");
    }
    const receipts = db.prepare(`
      SELECT * FROM stock_transactions
      WHERE reference_type = 'PURCHASE' AND reference_id = ? AND transaction_type = 'PURCHASE'
      ORDER BY id
    `).all(previous.id);
    const oldItems = db.prepare(`SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id`).all(previous.id);
    if (receipts.length !== oldItems.length || receipts.length === 0) {
      throw new Error("Original purchase receipt records do not match invoice lines. Editing is blocked for safety.");
    }
    const used = new Set();
    for (const row of oldItems) {
      const receipt = receipts.find((r) => !used.has(r.id) && r.item_id === row.item_id && Math.abs(r.quantity_in - row.quantity) < 0.0000001 && (r.lot_no || "") === (row.lot_no || ""));
      if (!receipt) throw new Error("Original stock receipt differs from invoice; editing is blocked.");
      used.add(receipt.id);
      // Even a later receipt can alter moving-average costing. Require latest movement
      // for every affected item to belong to this purchase, including duplicate lines.
      const laterMovement = db.prepare(`
        SELECT id FROM stock_transactions WHERE item_id = ? AND id > ?
          AND NOT (reference_type = 'PURCHASE' AND reference_id = ? AND transaction_type = 'PURCHASE')
        LIMIT 1
      `).get(row.item_id, receipt.id, previous.id);
      if (laterMovement) throw new Error("This item has stock activity after the purchase. Use a stock adjustment/return instead of editing historical costing.");
    }
    const oldestReceiptId = receipts[0].id;
    const previousItemIds = new Set(oldItems.map((row) => row.item_id));
    for (const row of data.items || []) {
      const newId = Number(row.itemId);
      if (previousItemIds.has(newId)) continue;
      const newerMovement = db.prepare(`SELECT id FROM stock_transactions WHERE item_id = ? AND id > ? LIMIT 1`).get(newId, oldestReceiptId);
      if (newerMovement) throw new Error("Cannot introduce an item with later stock history into this purchase. Use a new stock adjustment/return entry.");
    }
    // Reversal cost is exact because no intervening stock movements exist.
    for (const receipt of receipts) reverseInventoryReceipt(receipt.item_id, receipt.quantity_in, receipt.unit_cost);
    db.prepare(`DELETE FROM stock_transactions WHERE reference_type = 'PURCHASE' AND reference_id = ? AND transaction_type = 'PURCHASE'`).run(previous.id);
    db.prepare(`DELETE FROM purchase_items WHERE purchase_id = ?`).run(previous.id);
    return savePurchaseWithinTransaction(data, previous);
  })();
}

export function getPurchases() {
  return db.prepare(`
    SELECT
      p.id, p.purchase_no, p.purchase_date, p.due_date,
      p.payment_terms_days_snapshot, p.supplier_invoice_no,
      p.supplier_invoice_date, p.payment_date, p.payment_account,
      p.subtotal, p.gst_amount, p.freight_amount, p.other_charges,
      p.grand_total, p.amount_paid, p.payment_status, p.status,
      s.code AS supplier_code, s.name AS supplier_name
    FROM purchases p
    INNER JOIN suppliers s ON s.id = p.supplier_id
    ORDER BY p.purchase_date DESC, p.id DESC
  `).all();
}

export function getPurchaseById(id) {
  const purchase = db.prepare(`
    SELECT p.*, s.code AS supplier_code, s.name AS supplier_name
    FROM purchases p
    INNER JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ?
  `).get(Number(id));

  if (!purchase) return null;

  const items = db.prepare(`
    SELECT pi.*, i.code AS item_code, i.name AS item_name, u.code AS unit_code,
      eu.code AS entry_unit_code, COALESCE(pi.hsn_code_snapshot, i.hsn_code) AS hsn_code
    FROM purchase_items pi
    INNER JOIN items i ON i.id = pi.item_id
    INNER JOIN units u ON u.id = i.base_unit_id
    LEFT JOIN units eu ON eu.id = pi.entry_unit_id
    WHERE pi.purchase_id = ?
    ORDER BY pi.id
  `).all(Number(id));

  return { ...purchase, items };
}

export function cancelPurchase(id) {
  const transaction = db.transaction(() => {
    const purchase = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(Number(id));
    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.status === "CANCELLED") throw new Error("Purchase is already cancelled.");
    if (Number(purchase.amount_paid || 0) > 0) {
      throw new Error("This purchase has supplier payment recorded. Reverse/refund the payment before cancelling the purchase.");
    }

    const items = db.prepare(`SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id`).all(purchase.id);
    const receipts = db.prepare(`
      SELECT * FROM stock_transactions
      WHERE reference_type = 'PURCHASE' AND reference_id = ? AND transaction_type = 'PURCHASE'
      ORDER BY id
    `).all(purchase.id);
    if (items.length !== receipts.length) throw new Error("Purchase receipt count is inconsistent; cancellation is blocked.");
    const consumedReceipts = new Set();
    for (const item of items) {
      const originalReceipt = receipts.find((receipt) => !consumedReceipts.has(receipt.id)
        && receipt.item_id === item.item_id
        && Math.abs(Number(receipt.quantity_in) - Number(item.quantity)) < 0.0000001
        && (receipt.lot_no || "") === (item.lot_no || ""));
      if (!originalReceipt) throw new Error(`Original inventory receipt was not found for ${purchase.purchase_no}.`);
      consumedReceipts.add(originalReceipt.id);
      const laterOutgoing = db.prepare(`
        SELECT id FROM stock_transactions
        WHERE item_id = ? AND id > ? AND quantity_out > 0
        LIMIT 1
      `).get(item.item_id, originalReceipt.id);
      if (laterOutgoing) throw new Error(`${purchase.purchase_no} cannot be cancelled because this item has later stock usage.`);
      const costResult = reverseInventoryReceipt(item.item_id, item.quantity, Number(originalReceipt.unit_cost || 0));
      addStockTransaction({
        transactionDate: new Date().toISOString().slice(0, 10),
        itemId: item.item_id,
        transactionType: "PURCHASE_CANCEL",
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        referenceNo: purchase.purchase_no,
        quantityIn: 0,
        quantityOut: item.quantity,
        unitCost: costResult.unitCost,
        lotNo: item.lot_no || null,
        expiryDate: item.expiry_date || null,
        notes: `Cancellation of ${purchase.purchase_no}`,
      });
    }

    db.prepare(`
      UPDATE purchases SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(purchase.id);

    return { id: purchase.id, purchaseNo: purchase.purchase_no, status: "CANCELLED" };
  });

  return transaction();
}
