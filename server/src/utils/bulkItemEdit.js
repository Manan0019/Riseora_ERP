// Only independent master-data fields are eligible. Never modify historical transaction snapshots.
export const bulkFields = Object.freeze({hsnCode:'hsn_code',defaultGstRate:'default_gst_rate',reorderLevel:'reorder_level'});
export function normalizeBulkEdit(body) {
  const {field,value,items}=body || {};
  if(!Object.hasOwn(bulkFields,field)) throw new Error('Select an allowed item field.');
  if(typeof value!=='string' && typeof value!=='number') throw new Error('Enter a value.');
  const text=String(value).trim();
  let next;
  if(field==='hsnCode') {if(!/^[0-9]{0,16}$/.test(text)) throw new Error('HSN must contain digits only (maximum 16).');next=text||null;}
  else {next=Number(text);if(!text || !Number.isFinite(next)||next<0||(field==='defaultGstRate'&&next>100))throw new Error('Enter a valid non-negative value within the allowed range.');}
  if(!Array.isArray(items)||!items.length||items.length>500)throw new Error('Select between 1 and 500 items.');
  const seen=new Set();
  for(const row of items){if(!row||!Number.isSafeInteger(row.id)||row.id<1||seen.has(row.id)||!Object.hasOwn(row,'expected'))throw new Error('Invalid or duplicate item selection.');seen.add(row.id);}
  return {column:bulkFields[field],next,items};
}
export function runBulkEdit(db,body) {
  const {column,next,items}=normalizeBulkEdit(body);
  // Column names come only from the static allowlist above.
  const read=db.prepare(`SELECT id, is_active, ${column} AS current FROM items WHERE id=?`);
  const update=db.prepare(`UPDATE items SET ${column}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
  for(const row of items){const item=read.get(row.id);if(!item || Number(item.is_active)!==1 || item.current!==row.expected)throw new Error(`Item ${row.id} changed, is inactive or is missing. Refresh and try again; no items updated.`);}
  if(column==='hsn_code') {
    const legacy=db.prepare(`SELECT 1 WHERE EXISTS(SELECT 1 FROM purchase_items WHERE item_id=? AND hsn_code_snapshot IS NULL) OR EXISTS(SELECT 1 FROM sales_items WHERE item_id=? AND hsn_code_snapshot IS NULL)`);
    for(const row of items) if(row.expected!==next && legacy.get(row.id,row.id)) throw new Error(`Item ${row.id} has older transactions without an HSN snapshot. Bulk HSN changes are blocked to preserve historical display.`);
  }
  for(const row of items)update.run(next,row.id);
  return items.length;
}
