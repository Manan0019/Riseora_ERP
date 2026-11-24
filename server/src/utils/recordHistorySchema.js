// Fixed allowlist. Never audit users, secrets, sessions, or contact details.
export const historyFields = {
  items: ['code','name','base_unit_id','category_id','density','reorder_level','hsn_code','gst_rate','is_active'],
  formulas: ['code','name','version_no','batch_size','batch_unit_id','is_active'],
  formula_items: ['formula_id','ingredient_item_id','quantity','unit_id','percentage','component_role'],
  purchases: ['purchase_no','supplier_id','purchase_date','grand_total','status'],
  purchase_items: ['purchase_id','item_id','quantity','rate','gst_rate','taxable_amount','lot_no','hsn_code_snapshot','entry_quantity','entry_rate','entry_unit_id'],
  sales_invoices: ['invoice_no','customer_id','invoice_date','grand_total','amount_paid','payment_status','status'],
  sales_items: ['sales_invoice_id','item_id','quantity','rate','gst_rate','discount_amount','taxable_amount','hsn_code_snapshot'],
  production_batches: ['batch_no','formula_id','planned_batch_size','actual_output_qty','status','qc_status'],
  production_consumption: ['production_batch_id','item_id','planned_quantity','actual_quantity','unit_id'],
};
export function installRecordHistory(db) {
  // All schema changes are additive and transactional; row history rolls back with the originating business transaction.
  db.transaction ? db.transaction(() => install(db))() : install(db);
}
function install(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS record_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, record_id INTEGER NOT NULL,
    operation TEXT NOT NULL, before_json TEXT, after_json TEXT, changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS ix_record_history_entity ON record_history(entity, record_id, id);`);
  for (const [table, requested] of Object.entries(historyFields)) {
    const present = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name));
    if (!present.has('id')) continue;
    const fields = requested.filter(x=>present.has(x));
    if (!fields.length) continue;
    const json = prefix => `json_object(${fields.map(f=>`'${f}', ${prefix}.${f}`).join(', ')})`;
    for (const op of ['INSERT','UPDATE','DELETE']) {
      const before = op === 'INSERT' ? 'NULL' : json('OLD');
      const after = op === 'DELETE' ? 'NULL' : json('NEW');
      const when = op === 'UPDATE' ? `WHEN ${fields.map(f=>`OLD.${f} IS NOT NEW.${f}`).join(' OR ')}` : '';
      db.exec(`CREATE TRIGGER IF NOT EXISTS history_${table}_${op.toLowerCase()} AFTER ${op} ON ${table} ${when}
        BEGIN INSERT INTO record_history(entity,record_id,operation,before_json,after_json)
        VALUES('${table}',${op==='DELETE'?'OLD':'NEW'}.id,'${op}',${before},${after}); END;`);
    }
  }
}
