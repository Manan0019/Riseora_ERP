// Fixed allowlist. Never audit passwords, secrets, sessions, or contact details.
export const historyFields = {
  items: ['code','name','base_unit_id','preferred_entry_unit_id','category_id','density','reorder_level','hsn_code','default_gst_rate','is_active'],
  formulas: ['code','name','version_no','batch_size','batch_unit_id','is_active'],
  formula_items: ['formula_id','ingredient_item_id','quantity','unit_id','percentage','component_role'],
  purchases: ['purchase_no','supplier_id','purchase_date','grand_total','status'],
  purchase_items: ['purchase_id','item_id','quantity','rate','gst_rate','taxable_amount','lot_no','hsn_code_snapshot','entry_quantity','entry_rate','entry_unit_id'],
  sales_invoices: ['invoice_no','customer_id','invoice_date','grand_total','amount_paid','payment_status','status'],
  sales_items: ['sales_invoice_id','item_id','quantity','rate','gst_rate','discount_amount','taxable_amount','hsn_code_snapshot'],
  production_batches: ['batch_no','formula_id','planned_batch_size','actual_output_qty','status','qc_status'],
  ingredient_substitution_requests: ['formula_id','original_item_id','proposed_item_id','reason','review_note','status','requested_by','reviewed_by'],
  item_barcodes: ['item_id','barcode'],
  formula_specifications: ['formula_id','instructions','ph_min','ph_max','viscosity','appearance','viscosity_min_cp','viscosity_max_cp'],
  production_qc_measurements: ['batch_id','measurements_json','checked_at'],
  warehouses: ['code','name'],
  tracked_inventory_items: ['method','activated_on','cutoff_id','reason'],
  lot_positions: ['item_id','warehouse_id','lot_no','expiry_date','received_on'],
  lot_movements: ['position_id','stock_transaction_id','transfer_id','quantity','kind'],
  warehouse_transfers: ['item_id','source_id','destination_id','lot_no','quantity','reason'],
  production_stock_reservations: ['batch_id','item_id','quantity','status'],
  users: ['username','full_name','role','is_active'],
  production_consumption: ['production_batch_id','item_id','planned_quantity','actual_quantity','unit_id'],
};
export function installRecordHistory(db, attributed = false) {
  // All schema changes are additive and transactional; row history rolls back with the originating business transaction.
  db.transaction ? db.transaction(() => install(db, attributed))() : install(db, attributed);
}
function install(db, attributed) {
  db.exec(`CREATE TABLE IF NOT EXISTS record_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, record_id INTEGER NOT NULL,
    operation TEXT NOT NULL, before_json TEXT, after_json TEXT, changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS ix_record_history_entity ON record_history(entity, record_id, id);`);
  if(attributed) {
    const cols=new Set(db.prepare('PRAGMA table_info(record_history)').all().map(r=>r.name));
    if(!cols.has('actor_id')) db.exec('ALTER TABLE record_history ADD COLUMN actor_id INTEGER');
    if(!cols.has('actor_name')) db.exec('ALTER TABLE record_history ADD COLUMN actor_name TEXT');
  }
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
      if(attributed) db.exec(`DROP TRIGGER IF EXISTS history_${table}_${op.toLowerCase()}`);
      db.exec(`CREATE TRIGGER IF NOT EXISTS history_${table}_${op.toLowerCase()} AFTER ${op} ON ${table} ${when}
        BEGIN INSERT INTO record_history(entity,record_id,operation,before_json,after_json${attributed?",actor_id,actor_name":""})
        VALUES('${table}',${op==='DELETE'?'OLD':'NEW'}.id,'${op}',${before},${after}${attributed?',riseora_actor_id(),riseora_actor_name()':''}); END;`);
    }
  }
}
