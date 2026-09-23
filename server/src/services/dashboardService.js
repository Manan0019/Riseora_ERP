import db from "../db/database.js";
import { getCustomerOutstanding } from "./customerLedgerService.js";
import { getSupplierOutstanding } from "./supplierLedgerService.js";

export function getDashboardSummary() {
  const grossSales = Number(db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM sales_invoices
    WHERE status = 'POSTED'
  `).get()?.total || 0);

  const salesCredits = Number(db.prepare(`
    SELECT COALESCE(SUM(scn.grand_total), 0) AS total
    FROM sales_credit_notes scn
    INNER JOIN sales_invoices si ON si.id = scn.sales_invoice_id
    WHERE scn.status = 'POSTED' AND si.status = 'POSTED'
  `).get()?.total || 0);

  const purchases = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status = 'POSTED' THEN grand_total ELSE 0 END), 0) AS total
    FROM purchases
  `).get();

  const customerOutstanding = getCustomerOutstanding()
    .reduce((total, row) => total + Number(row.outstanding || 0), 0);

  const supplierOutstanding = getSupplierOutstanding()
    .reduce((total, row) => total + Number(row.outstanding || 0), 0);

  const netSales = grossSales - salesCredits;

  const stockRows = db.prepare(`
    SELECT
      i.id, i.code, i.name, i.reorder_level,
      u.code AS unit_code,
      COALESCE(SUM(st.quantity_in - st.quantity_out), 0) AS current_stock
    FROM items i
    INNER JOIN units u ON u.id = i.base_unit_id
    LEFT JOIN stock_transactions st ON st.item_id = i.id
    WHERE i.is_active = 1
    GROUP BY i.id, i.code, i.name, i.reorder_level, u.code
    ORDER BY i.name
  `).all();

  const lowStockItems = stockRows.filter(
    (item) => Number(item.reorder_level || 0) > 0 &&
      Number(item.current_stock || 0) <= Number(item.reorder_level || 0),
  );

  const workInProgress = db.prepare(`
    SELECT
      COUNT(*) AS batch_count,
      COALESCE(SUM(wip_material_cost), 0) AS material_value
    FROM production_batches
    WHERE status = 'IN_PRODUCTION'
  `).get();

  const draftProduction = db.prepare(`
    SELECT COUNT(*) AS batch_count
    FROM production_batches
    WHERE status = 'DRAFT'
  `).get();

  const recentProduction = db.prepare(`
    SELECT
      pb.id, pb.batch_no, pb.production_date,
      COALESCE(NULLIF(pb.good_output_qty, 0), pb.actual_output_qty) AS actual_output_qty,
      pb.status,
      i.name AS finished_item_name, u.code AS unit_code
    FROM production_batches pb
    INNER JOIN items i ON i.id = pb.finished_item_id
    INNER JOIN units u ON u.id = pb.batch_unit_id
    WHERE pb.status IN ('COMPLETED', 'CLOSED')
    ORDER BY pb.production_date DESC, pb.id DESC
    LIMIT 5
  `).all();

  return {
    totalSales: netSales,
    totalPurchases: Number(purchases?.total || 0),
    customerOutstanding,
    supplierOutstanding,
    stockItemCount: stockRows.length,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    wipBatchCount: Number(workInProgress?.batch_count || 0),
    wipMaterialValue: Number(workInProgress?.material_value || 0),
    draftProductionCount: Number(draftProduction?.batch_count || 0),
    recentProduction,
  };
}
