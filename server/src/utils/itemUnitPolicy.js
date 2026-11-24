// Formula references store their own units. Posted/operational quantities must
// never be relabelled by a master-data update.
const operational = [
  ['stock_transactions','item_id','Stock ledger'],
  ['purchase_items','item_id','Purchases'],
  ['sales_items','item_id','Sales'],
  ['sales_credit_note_items','item_id','Sales returns'],
  ['opening_stock_items','item_id','Opening stock'],
  ['stock_adjustment_items','item_id','Stock adjustments'],
  ['production_batches','finished_item_id','Production output'],
  ['production_consumption','item_id','Production materials'],
  ['tracked_inventory_items','id','Lot tracking'],
  ['lot_positions','item_id','Warehouse lots'],
  ['warehouse_transfers','item_id','Warehouse transfers'],
  ['production_stock_reservations','item_id','Production reservations'],
];
export function itemUnitPolicy(db,id) {
  const reasons = operational.filter(([table,column])=>db.prepare(`SELECT 1 FROM ${table} WHERE ${column}=? LIMIT 1`).get(id)).map(x=>x[2]);
  if(db.prepare('SELECT 1 FROM inventory_cost_state WHERE item_id=? AND (quantity<>0 OR inventory_value<>0 OR average_cost<>0)').get(id)) reasons.push('Inventory costing');
  const production = Boolean(db.prepare(`SELECT 1 FROM production_batches b WHERE b.finished_item_id=? OR EXISTS(SELECT 1 FROM production_consumption pc WHERE pc.production_batch_id=b.id AND pc.item_id=?) OR EXISTS(SELECT 1 FROM formula_items fi WHERE fi.formula_id=b.formula_id AND fi.ingredient_item_id=?) LIMIT 1`).get(id,id,id));
  if(production && !reasons.includes('Production output') && !reasons.includes('Production materials')) reasons.push('Production formula history');
  const formulaUnits=db.prepare(`SELECT DISTINCT u.code FROM units u WHERE u.id IN (SELECT unit_id FROM formula_items WHERE ingredient_item_id=? UNION SELECT batch_unit_id FROM formulas WHERE finished_item_id=?) ORDER BY u.code`).all(id,id).map(x=>x.code);
  return {base_unit_locked: reasons.length>0, category_locked: reasons.length>0||formulaUnits.length>0, density_locked: production, unit_lock_reasons: reasons, formula_unit_codes:formulaUnits};
}
export function validateUnitCorrection(policy,existing,inventory,convert) {
  if(Number(existing.base_unit_id)!==inventory.baseUnitId) {
    if(policy.base_unit_locked) throw new Error(`Stock base unit is locked (${policy.unit_lock_reasons.join(', ')}). Keep the stock unit and choose a preferred entry unit instead.`);
    for(const code of policy.formula_unit_codes) convert(1,code,inventory.baseUnitCode,inventory.density,existing.name);
  }
  if(Number(existing.category_id)!==inventory.categoryId && policy.category_locked) throw new Error('Category is locked because this item has business or formula history.');
  const oldDensity=existing.density==null?null:Number(existing.density);
  if(oldDensity!==inventory.density && policy.density_locked) throw new Error('Density is locked after production use. Use the verified existing density or contact support for a traceable conversion.');
}
export function installPreferredEntryUnit(db){
  if(!db.prepare('PRAGMA table_info(items)').all().some(c=>c.name==='preferred_entry_unit_id')) db.exec('ALTER TABLE items ADD COLUMN preferred_entry_unit_id INTEGER REFERENCES units(id)');
}
