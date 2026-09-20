import db from "../db/database.js";

export function addStockTransaction(data) {
  return db.prepare(`
    INSERT INTO stock_transactions (
      transaction_date,
      item_id,
      transaction_type,
      reference_type,
      reference_id,
      reference_no,
      quantity_in,
      quantity_out,
      unit_cost,
      lot_no,
      expiry_date,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.transactionDate,
    data.itemId,
    data.transactionType,
    data.referenceType,
    data.referenceId || null,
    data.referenceNo || null,
    Number(data.quantityIn || 0),
    Number(data.quantityOut || 0),
    Number(data.unitCost || 0),
    data.lotNo || null,
    data.expiryDate || null,
    data.notes || null
  );
}

export function getCurrentStock() {
  return db.prepare(`
    SELECT
      i.id,
      i.code,
      i.name,

      c.code AS category_code,
      c.name AS category_name,

      u.code AS unit_code,

      COALESCE(
        SUM(
          st.quantity_in -
          st.quantity_out
        ),
        0
      ) AS current_stock,

      COALESCE(
        ics.average_cost,
        0
      ) AS average_cost,

      COALESCE(
        ics.inventory_value,
        0
      ) AS inventory_value

    FROM items i

    INNER JOIN item_categories c
      ON c.id = i.category_id

    INNER JOIN units u
      ON u.id = i.base_unit_id

    LEFT JOIN stock_transactions st
      ON st.item_id = i.id

    LEFT JOIN inventory_cost_state ics
      ON ics.item_id = i.id

    WHERE
      i.is_active = 1

    GROUP BY
      i.id,
      i.code,
      i.name,
      c.code,
      c.name,
      u.code,
      ics.average_cost,
      ics.inventory_value

    ORDER BY
      i.name
  `).all();
}

export function getItemStock(itemId) {
  const result = db.prepare(`
    SELECT
      COALESCE(
        SUM(
          quantity_in -
          quantity_out
        ),
        0
      ) AS current_stock
    FROM stock_transactions
    WHERE item_id = ?
  `).get(itemId);

  return result?.current_stock || 0;
}