import db from "../db/database.js";

export function getDashboardSummary() {
  const sales = db.prepare(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status = 'POSTED'
            THEN grand_total
            ELSE 0
          END
        ),
        0
      ) AS total_sales
    FROM sales_invoices
  `).get();

  const purchases = db.prepare(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status = 'POSTED'
            THEN grand_total
            ELSE 0
          END
        ),
        0
      ) AS total_purchases
    FROM purchases
  `).get();

  const customerOutstanding = db.prepare(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status = 'POSTED'
            THEN grand_total - amount_paid
            ELSE 0
          END
        ),
        0
      ) AS outstanding
    FROM sales_invoices
  `).get();

  const supplierOutstanding = db.prepare(`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status = 'POSTED'
            THEN grand_total - amount_paid
            ELSE 0
          END
        ),
        0
      ) AS outstanding
    FROM purchases
  `).get();

  const stockRows = db.prepare(`
    SELECT
      i.id,
      i.code,
      i.name,
      i.reorder_level,

      u.code AS unit_code,

      COALESCE(
        SUM(
          st.quantity_in -
          st.quantity_out
        ),
        0
      ) AS current_stock

    FROM items i

    INNER JOIN units u
      ON u.id = i.base_unit_id

    LEFT JOIN stock_transactions st
      ON st.item_id = i.id

    WHERE i.is_active = 1

    GROUP BY
      i.id,
      i.code,
      i.name,
      i.reorder_level,
      u.code

    ORDER BY i.name
  `).all();

  const lowStockItems =
    stockRows.filter(
      (item) =>
        Number(item.reorder_level || 0) > 0 &&
        Number(item.current_stock || 0) <=
          Number(item.reorder_level || 0)
    );

  const recentProduction = db.prepare(`
    SELECT
      pb.id,
      pb.batch_no,
      pb.production_date,
      pb.actual_output_qty,
      pb.status,

      i.name AS finished_item_name,

      u.code AS unit_code

    FROM production_batches pb

    INNER JOIN items i
      ON i.id = pb.finished_item_id

    INNER JOIN units u
      ON u.id = pb.batch_unit_id

    ORDER BY
      pb.production_date DESC,
      pb.id DESC

    LIMIT 5
  `).all();

  return {
    totalSales:
      Number(
        sales?.total_sales || 0
      ),

    totalPurchases:
      Number(
        purchases?.total_purchases || 0
      ),

    customerOutstanding:
      Number(
        customerOutstanding?.outstanding || 0
      ),

    supplierOutstanding:
      Number(
        supplierOutstanding?.outstanding || 0
      ),

    stockItemCount:
      stockRows.length,

    lowStockCount:
      lowStockItems.length,

    lowStockItems,

    recentProduction,
  };
}