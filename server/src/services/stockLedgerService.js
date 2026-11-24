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
      (SELECT GROUP_CONCAT(p.lot_no || ' @ ' || w.code || ' (' || m.quantity || ')', ', ')
       FROM lot_movements m JOIN lot_positions p ON p.id=m.position_id JOIN warehouses w ON w.id=p.warehouse_id WHERE m.stock_transaction_id=st.id) AS allocated_lots,
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