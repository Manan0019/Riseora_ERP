import db from "../db/database.js";
import { getFormulaById } from "./formulaService.js";
import { convertToItemBaseUnit } from "./unitConversionService.js";

export function recordHistory(entity, recordId) {
  const where = [], args = [];
  if (entity) { where.push('entity = ?'); args.push(String(entity)); }
  if (recordId) { where.push('record_id = ?'); args.push(Number(recordId)); }
  return db.prepare(`SELECT * FROM record_history ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`).all(...args);
}
export function databaseHealth() {
  const quick = db.pragma('quick_check', { simple:true });
  const foreignKeyIssues = db.pragma('foreign_key_check').length;
  const differences = db.prepare(`SELECT i.id,i.code,i.name,COALESCE(s.physical,0) physical,COALESCE(c.quantity,0) costing
    FROM items i LEFT JOIN (SELECT item_id,SUM(quantity_in-quantity_out) physical FROM stock_transactions GROUP BY item_id) s ON s.item_id=i.id
    LEFT JOIN inventory_cost_state c ON c.item_id=i.id
    WHERE ABS(COALESCE(s.physical,0)-COALESCE(c.quantity,0))>0.00001 ORDER BY i.name LIMIT 100`).all();
  return { quick, foreignKeyIssues, differences };
}
export function formulaPlan(id, target) {
  const f = getFormulaById(id), size = Number(target);
  if (!f || !Number.isFinite(size) || size <= 0 || size > 1e9 || !(Number(f.batch_size)>0)) throw new Error('Select a valid formula and positive batch size.');
  const factor = size / f.batch_size;
  const stock = db.prepare(`SELECT COALESCE(SUM(quantity_in-quantity_out),0) qty FROM stock_transactions WHERE item_id=?`);
  const cost = db.prepare('SELECT quantity, average_cost FROM inventory_cost_state WHERE item_id=?');
  const grouped = new Map();
  for (const line of f.ingredients) {
    const required = Number(line.quantity) * factor;
    const converted = convertToItemBaseUnit(line.ingredient_item_id, required, line.unit_id);
    const key = line.ingredient_item_id;
    const existing = grouped.get(key) || {item_id:key, name:line.ingredient_name, unit:converted.unitCode, required:0};
    existing.required += converted.quantity; grouped.set(key,existing);
  }
  const rows = [...grouped.values()].map(row=>{
    const available=Number(stock.get(row.item_id).qty), state=cost.get(row.item_id);
    const unitCost=state && state.quantity>0 && Number.isFinite(Number(state.average_cost)) ? Number(state.average_cost) : null;
    return {...row, available, shortage:Math.max(0,row.required-available), unitCost, estimatedCost:unitCost===null?null:row.required*unitCost};
  });
  return { name:f.name, version:f.version_no, size, unit:f.batch_unit_code, rows, total:rows.every(r=>r.estimatedCost!==null)?rows.reduce((a,r)=>a+r.estimatedCost,0):null };
}
export function monthlyActivity() {
  return db.prepare(`WITH RECURSIVE months(m,n) AS (SELECT date('now','localtime','start of month','-5 months'),1 UNION ALL SELECT date(m,'+1 month'),n+1 FROM months WHERE n<6),
    sales AS (SELECT substr(invoice_date,1,7) m,SUM(grand_total) amount FROM sales_invoices WHERE status='POSTED' GROUP BY m),
    credits AS (SELECT substr(c.credit_note_date,1,7) m,SUM(c.grand_total) amount FROM sales_credit_notes c JOIN sales_invoices s ON s.id=c.sales_invoice_id WHERE c.status='POSTED' AND s.status='POSTED' GROUP BY m),
    purchases_month AS (SELECT substr(purchase_date,1,7) m,SUM(grand_total) amount FROM purchases WHERE status='POSTED' GROUP BY m)
    SELECT substr(months.m,1,7) month, COALESCE(sales.amount,0)-COALESCE(credits.amount,0) sales, COALESCE(purchases_month.amount,0) purchases FROM months LEFT JOIN sales ON sales.m=substr(months.m,1,7) LEFT JOIN credits ON credits.m=substr(months.m,1,7) LEFT JOIN purchases_month ON purchases_month.m=substr(months.m,1,7) ORDER BY months.m`).all();
}

// Recorded lot balances are advisory only: legacy unallocated issues can make them overstate availability.
export function recordedLots(itemId) {
  const id=Number(itemId); if(!Number.isSafeInteger(id)||id<=0)throw new Error('Select an item.');
  const item=db.prepare('SELECT i.name,u.code unit FROM items i JOIN units u ON u.id=i.base_unit_id WHERE i.id=?').get(id);
  if(!item)throw new Error('Item not found.');
  const lots=db.prepare(`SELECT lot_no,expiry_date,SUM(quantity_in-quantity_out) recorded_balance FROM stock_transactions WHERE item_id=? AND lot_no IS NOT NULL AND trim(lot_no)<>'' GROUP BY lot_no,expiry_date ORDER BY CASE WHEN expiry_date IS NULL OR trim(expiry_date)='' THEN 1 ELSE 0 END,expiry_date,lot_no`).all(id);
  const totals=db.prepare(`SELECT COALESCE(SUM(quantity_in-quantity_out),0) physical, COALESCE(SUM(CASE WHEN lot_no IS NULL OR trim(lot_no)='' THEN quantity_out ELSE 0 END),0) unallocatedIssues FROM stock_transactions WHERE item_id=?`).get(id);
  return {item,lots,...totals};
}
export function batchTrace(id) {
  const batch=db.prepare(`SELECT p.id,p.batch_no,p.production_date,p.finished_lot_no,p.status,i.name finished_item FROM production_batches p JOIN items i ON i.id=p.finished_item_id WHERE p.id=?`).get(Number(id));
  if(!batch)throw new Error('Batch not found.');
  const rows=db.prepare(`SELECT pc.id,i.name,pc.planned_quantity,pc.actual_quantity,u.code unit,pc.lot_no FROM production_consumption pc JOIN items i ON i.id=pc.item_id JOIN units u ON u.id=pc.unit_id WHERE pc.production_batch_id=? ORDER BY pc.id`).all(batch.id);
  return {batch,rows};
}
