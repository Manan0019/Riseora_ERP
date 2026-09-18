import db from "../db/database.js";

export function getStockLedger(itemId) {
  return db.prepare(`
    SELECT
      st.id,
      st.transaction_date,
      st.transaction_type,
      st.reference_type,
      st.reference_id,
      st.reference_no,
      st.quantity_in,
      st.quantity_out,
      st.unit_cost,
      st.lot_no,
      st.expiry_date,
      st.notes,
      st.created_at,

      i.code AS item_code,
      i.name AS item_name,

      u.code AS unit_code

    FROM stock_transactions st

    INNER JOIN items i
      ON i.id = st.item_id

    INNER JOIN units u
      ON u.id = i.base_unit_id

    WHERE st.item_id = ?

    ORDER BY
      st.transaction_date,
      st.id
  `).all(itemId);
}