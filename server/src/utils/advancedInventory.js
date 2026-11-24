// Physical allocation is an opt-in detail of the existing stock ledger, not a second costing system.
const EPS=1e-7;
const sum=(rows,key='quantity')=>rows.reduce((n,r)=>n+Number(r[key]),0);
const id=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw new Error('Select a valid record.');return n;};
const qty=v=>{const n=Number(v);if(!Number.isFinite(n)||n<=EPS||n>1e12)throw new Error('Enter a positive base-unit quantity.');return n;};
const txt=(v,max=100)=>{const s=String(v??'').trim();if(!s||s.length>max)throw new Error('Enter a valid non-empty value.');return s;};
export const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const dateOrNull=v=>{if(v==null||v==='')return null;if(!validDate(v))throw new Error('Enter a valid date.');return v;};
export function installAdvancedInventory(db){
 db.exec(`CREATE TABLE IF NOT EXISTS warehouses(id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL);
 INSERT OR IGNORE INTO warehouses(id,code,name) VALUES(1,'MAIN','Main stock');
 CREATE TABLE IF NOT EXISTS tracked_inventory_items(id INTEGER PRIMARY KEY REFERENCES items(id), method TEXT NOT NULL CHECK(method IN ('FIFO','FEFO')), activated_on TEXT NOT NULL, cutoff_id INTEGER NOT NULL, reason TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS warehouse_transfers(id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id), source_id INTEGER NOT NULL REFERENCES warehouses(id), destination_id INTEGER NOT NULL REFERENCES warehouses(id), lot_no TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity>0), reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS lot_positions(id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id), warehouse_id INTEGER NOT NULL REFERENCES warehouses(id), lot_no TEXT NOT NULL, expiry_date TEXT, received_on TEXT NOT NULL, UNIQUE(item_id,warehouse_id,lot_no));
 CREATE TABLE IF NOT EXISTS lot_movements(id INTEGER PRIMARY KEY, position_id INTEGER NOT NULL REFERENCES lot_positions(id), stock_transaction_id INTEGER REFERENCES stock_transactions(id) ON DELETE RESTRICT, transfer_id INTEGER REFERENCES warehouse_transfers(id), quantity REAL NOT NULL CHECK(quantity<>0), kind TEXT NOT NULL CHECK(kind IN ('OPENING','STOCK','TRANSFER')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((kind='OPENING' AND stock_transaction_id IS NULL AND transfer_id IS NULL) OR (kind='STOCK' AND stock_transaction_id IS NOT NULL AND transfer_id IS NULL) OR (kind='TRANSFER' AND stock_transaction_id IS NULL AND transfer_id IS NOT NULL)));
 CREATE INDEX IF NOT EXISTS idx_lot_movements_position ON lot_movements(position_id);
 CREATE INDEX IF NOT EXISTS idx_lot_movements_stock ON lot_movements(stock_transaction_id);
 CREATE TABLE IF NOT EXISTS production_stock_reservations(id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES production_batches(id), item_id INTEGER NOT NULL REFERENCES items(id), quantity REAL NOT NULL CHECK(quantity>0), status TEXT NOT NULL CHECK(status IN ('ACTIVE','CONSUMED','RELEASED')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_active ON production_stock_reservations(batch_id,item_id) WHERE status='ACTIVE';
 CREATE TRIGGER IF NOT EXISTS tracked_stock_delete_guard BEFORE DELETE ON stock_transactions WHEN EXISTS(SELECT 1 FROM tracked_inventory_items t WHERE t.id=OLD.item_id AND (OLD.id<=t.cutoff_id OR EXISTS(SELECT 1 FROM lot_movements m WHERE m.stock_transaction_id=OLD.id))) BEGIN SELECT RAISE(ABORT,'Tracked stock history cannot be deleted. Use a traceable correction.'); END;
 CREATE TRIGGER IF NOT EXISTS tracked_stock_update_guard BEFORE UPDATE ON stock_transactions WHEN EXISTS(SELECT 1 FROM tracked_inventory_items t WHERE t.id=OLD.item_id OR t.id=NEW.item_id) BEGIN SELECT RAISE(ABORT,'Tracked stock history cannot be rewritten.'); END;`);
}
export function createInventoryOperations(db){
 const today=()=>db.prepare("SELECT date('now','localtime') day").get().day;
 const tracked=item=>db.prepare('SELECT * FROM tracked_inventory_items WHERE id=?').get(item);
 const itemRow=item=>{const r=db.prepare('SELECT id,name,track_expiry,is_active FROM items WHERE id=?').get(id(item));if(!r)throw new Error('Item not found.');return r;};
 const warehouse=w=>{const r=db.prepare('SELECT * FROM warehouses WHERE id=?').get(id(w));if(!r)throw new Error('Warehouse not found.');return r;};
 const physical=item=>Number(db.prepare('SELECT COALESCE(SUM(quantity_in-quantity_out),0) n FROM stock_transactions WHERE item_id=?').get(item).n);
 const positions=item=>db.prepare(`SELECT p.*,w.code warehouse_code,w.name warehouse_name,COALESCE(SUM(m.quantity),0) quantity FROM lot_positions p JOIN warehouses w ON w.id=p.warehouse_id LEFT JOIN lot_movements m ON m.position_id=p.id WHERE p.item_id=? GROUP BY p.id ORDER BY p.received_on,p.id`).all(item);
 const reservationRows=item=>db.prepare(`SELECT r.*,b.batch_no FROM production_stock_reservations r JOIN production_batches b ON b.id=r.batch_id WHERE r.item_id=? AND r.status='ACTIVE' AND b.status='DRAFT' ORDER BY r.id`).all(item);
 const eligible=(rows,date,item)=>rows.filter(r=>r.quantity>EPS&&(!r.expiry_date?!item.track_expiry:r.expiry_date>=date));
 const order=(rows,method)=>[...rows].sort((a,b)=>(method==='FEFO'?(a.expiry_date||'9999-12-31').localeCompare(b.expiry_date||'9999-12-31'):0)||a.received_on.localeCompare(b.received_on)||a.id-b.id);
 function ensureReconciled(item,expected=physical(item)){
  const rows=positions(item);if(rows.some(r=>r.quantity < -EPS)||Math.abs(sum(rows)-expected)>EPS)throw new Error('Lot/location balances do not match stock ledger. Posting stopped; reconcile before proceeding.');return rows;
 }
 function ensurePosition(item,warehouseId,lot,expiry,received){
  const other=db.prepare('SELECT expiry_date,received_on FROM lot_positions WHERE item_id=? AND lot_no=? LIMIT 1').get(item,lot);
  if(other&&other.expiry_date!==expiry)throw new Error('This lot already has a different expiry date. Check the lot number.');
  const current=db.prepare('SELECT * FROM lot_positions WHERE item_id=? AND warehouse_id=? AND lot_no=?').get(item,warehouseId,lot);
  if(current)return current.id;
  return Number(db.prepare('INSERT INTO lot_positions(item_id,warehouse_id,lot_no,expiry_date,received_on) VALUES(?,?,?,?,?)').run(item,warehouseId,lot,expiry,other?.received_on||received).lastInsertRowid);
 }
 function addMove(position,delta,kind,stockId=null,transferId=null){db.prepare('INSERT INTO lot_movements(position_id,quantity,kind,stock_transaction_id,transfer_id) VALUES(?,?,?,?,?)').run(position,delta,kind,stockId,transferId);}
 function distribute(rows,amount){let remaining=amount;const allocation=[];for(const r of rows){const n=Math.min(remaining,r.quantity);if(n>EPS){allocation.push({...r,allocated:n});remaining-=n;}if(remaining<=EPS)break;}if(remaining>EPS)throw new Error('Insufficient eligible stock in the selected lots/warehouses.');return allocation;}
 function reserveCheck(item,rows,allocations,ownBatch,remainingOwn=0){
  const active=reservationRows(item.id);const others=sum(active.filter(r=>r.batch_id!==ownBatch));const reserved=others+remainingOwn;
  const good=new Set(eligible(rows,today(),item).map(r=>r.id));const consumed=sum(allocations.filter(r=>good.has(r.id)),'allocated');
  if(sum(eligible(rows,today(),item))-consumed+EPS<reserved)throw new Error('Stock is reserved for another production batch. Release the reservation or receive more stock.');
 }
 function relatedNet(item,refType,refId){
  // Include returns against the original sale, not unrelated receipts of the same item.
  return db.prepare(`SELECT p.*, -SUM(m.quantity) quantity FROM lot_movements m JOIN lot_positions p ON p.id=m.position_id JOIN stock_transactions s ON s.id=m.stock_transaction_id WHERE p.item_id=? AND ((s.reference_type=? AND s.reference_id=?) OR (?='SALE' AND s.reference_type='SALES_CREDIT_NOTE' AND s.reference_id IN (SELECT id FROM sales_credit_notes WHERE sales_invoice_id=?))) GROUP BY p.id`).all(item,refType,refId,refType,refId);
 }
 function receiptReversal(data,amount,rows){
  const t=data.transactionType;let refType=data.referenceType,refId=data.referenceId;
  if(t==='SALE_RETURN'){const credit=db.prepare('SELECT sales_invoice_id FROM sales_credit_notes WHERE id=?').get(refId);if(!credit)throw new Error('Original sales invoice not found.');refType='SALE';refId=credit.sales_invoice_id;}
  const net=relatedNet(data.itemId,refType,refId).filter(r=>r.quantity>EPS);
  const selected=data.lotNo?net.filter(r=>r.lot_no===String(data.lotNo).trim()):net;
  // Partial returns require an unambiguous original location/lot; never fabricate traceability.
  if(selected.length>1&&Math.abs(sum(selected)-amount)>EPS)throw new Error('Partial return spans multiple lots or warehouses. Select the exact original lot; ambiguous returns are blocked.');
  return distribute(order(selected,'FIFO'),amount);
 }
 const reversalIn=t=>t==='SALE_RETURN'||t==='SALE_CANCEL'||/PRODUCTION_(?:CORRECTION_)?(?:MATERIAL_RETURN|REVERSAL_WIP|REVERSAL_CONSUMPTION|CANCEL_WIP_RETURN|CANCEL_CONSUMPTION)$/.test(t);
 const reversalOut=t=>t==='PURCHASE_CANCEL'||t==='PRODUCTION_CANCEL_OUTPUT'||t==='PRODUCTION_CORRECTION_REVERSAL_OUTPUT';
 function postStock(data,stockId){
  const itemId=Number(data.itemId),setting=tracked(itemId);if(!setting)return;
  const item=itemRow(itemId),incoming=Number(data.quantityIn||0),outgoing=Number(data.quantityOut||0),day=dateOrNull(data.transactionDate),t=data.transactionType;
  if(!day||day<setting.activated_on||day>today())throw new Error('Tracked stock movements require a date from activation through today.');
  if((incoming>EPS)===(outgoing>EPS)||incoming<0||outgoing<0||!Number.isFinite(incoming+outgoing))throw new Error('Invalid tracked stock movement.');
  // The caller has already inserted the canonical stock transaction in the same transaction.
  const rows=ensureReconciled(itemId,physical(itemId)-incoming+outgoing);
  const d={...data,itemId};
  if(incoming>EPS){
   if(reversalIn(t)){for(const a of receiptReversal(d,incoming,rows))addMove(a.id,a.allocated,'STOCK',stockId);}
   else {
    if(!['PURCHASE','OPENING_STOCK','ADJUSTMENT_IN','PRODUCTION_OUTPUT','PRODUCTION_CORRECTION_OUTPUT'].includes(t))throw new Error('This receipt type has no verified lot allocation path.');
    const lot=txt(data.lotNo),expiry=dateOrNull(data.expiryDate);if(item.track_expiry&&!expiry)throw new Error('Expiry date required for tracked stock.');
    addMove(ensurePosition(itemId,1,lot,expiry,day),incoming,'STOCK',stockId);
   }
  }else{
   const ownBatch=data.referenceType==='PRODUCTION'&&['PRODUCTION_MATERIAL_ISSUE','PRODUCTION_CORRECTION_MATERIAL_ISSUE'].includes(t)?Number(data.referenceId):null;
   const own=reservationRows(itemId).filter(r=>r.batch_id===ownBatch);const ownQty=sum(own);
   let candidates;
   if(reversalOut(t)){
    const original=relatedNet(itemId,data.referenceType,data.referenceId).filter(r=>r.quantity < -EPS);
    candidates=original.map(r=>({...r,quantity:Math.min(-r.quantity,rows.find(p=>p.id===r.id)?.quantity||0)}));
   }else if(t==='ADJUSTMENT_OUT'&&data.lotNo){candidates=rows;}
   else if(['SALE','ADJUSTMENT_OUT','PRODUCTION_MATERIAL_ISSUE','PRODUCTION_CORRECTION_MATERIAL_ISSUE','PRODUCTION_EXTRA_CONSUMPTION','PRODUCTION_CORRECTION_EXTRA_CONSUMPTION'].includes(t))candidates=eligible(rows,today(),item);
   else throw new Error('This issue type has no verified lot allocation path.');
   if(data.lotNo)candidates=candidates.filter(r=>r.lot_no===String(data.lotNo).trim());
   const alloc=distribute(order(candidates,setting.method),outgoing);
   if(ownQty>EPS&&outgoing+EPS<ownQty)throw new Error('Reserved quantity exceeds this issue. Release and reserve the corrected batch again.');
   reserveCheck(item,rows,alloc,ownBatch);
   for(const a of alloc)addMove(a.id,-a.allocated,'STOCK',stockId);
   if(ownQty>EPS)db.prepare("UPDATE production_stock_reservations SET status='CONSUMED' WHERE batch_id=? AND item_id=? AND status='ACTIVE'").run(ownBatch,itemId);
  }
  ensureReconciled(itemId);
 }
 function enable(itemId,body){return db.transaction(()=>{
  const item=itemRow(itemId);if(!item.is_active||tracked(item.id))throw new Error('Item must be active and not already tracked.');
  if(!['FIFO','FEFO'].includes(body.method)||body.confirm!==true)throw new Error('Choose allocation method and confirm physical verification.');
  if(db.prepare(`SELECT 1 FROM production_consumption c JOIN production_batches b ON b.id=c.production_batch_id WHERE c.item_id=? AND b.status='IN_PRODUCTION' LIMIT 1`).get(item.id))throw new Error('Complete active production before enabling tracking.');
  const total=physical(item.id),cost=Number(db.prepare('SELECT quantity FROM inventory_cost_state WHERE item_id=?').get(item.id)?.quantity||0);
  if(total< -EPS||Math.abs(total-cost)>EPS)throw new Error('Physical and costing stock must reconcile before enabling tracking.');
  if(!Array.isArray(body.positions)||body.positions.length>500)throw new Error('Enter verified opening lot counts.');
  const day=today(),rows=body.positions.map(r=>({warehouse:warehouse(r.warehouseId).id,lot:txt(r.lot),quantity:qty(r.quantity),expiry:dateOrNull(r.expiry),received:dateOrNull(r.received)}));
  if(rows.some(r=>!r.received||r.received>day||item.track_expiry&&!r.expiry))throw new Error('Receipt dates and required expiry dates must be valid.');
  if(Math.abs(sum(rows)-total)>EPS)throw new Error(`Verified lot counts must equal existing stock (${total}). No stock is created.`);
  const keys=new Set();for(const r of rows){const k=JSON.stringify([r.warehouse,r.lot]);if(keys.has(k))throw new Error('Duplicate warehouse/lot.');keys.add(k);}
  const cutoff=Number(db.prepare('SELECT COALESCE(MAX(id),0) n FROM stock_transactions').get().n);
  db.prepare('INSERT INTO tracked_inventory_items(id,method,activated_on,cutoff_id,reason) VALUES(?,?,?,?,?)').run(item.id,body.method,day,cutoff,txt(body.reason,500));
  for(const r of rows)addMove(ensurePosition(item.id,r.warehouse,r.lot,r.expiry,r.received),r.quantity,'OPENING');
  ensureReconciled(item.id);return inspect(item.id);
 })();}
 function suggest(itemId,amount,method){
  amount=qty(amount);if(!['FIFO','FEFO'].includes(method))throw new Error('Unknown allocation method.');
  const item=itemRow(itemId),rows=ensureReconciled(item.id),good=order(eligible(rows,today(),item),method),reserved=sum(reservationRows(item.id));
  let remaining=Math.min(amount,Math.max(0,sum(good)-reserved));const allocations=[];
  for(const r of good){const n=Math.min(remaining,r.quantity);if(n>EPS)allocations.push({lot:`${r.lot_no} · ${r.warehouse_code}`,firstReceipt:r.received_on,expiry:r.expiry_date,quantity:r.quantity,allocated:n});remaining-=n;if(remaining<=EPS)break;}
  return {verified:true,issues:[],allocations,excluded:rows.filter(r=>r.quantity>EPS&&!good.some(g=>g.id===r.id)).map(r=>({lot:`${r.lot_no} · ${r.warehouse_code}`})),shortage:Math.max(0,amount-sum(allocations,'allocated')),reserved};
 }
 function inspect(itemId){const item=itemRow(itemId),setting=tracked(item.id),rows=positions(item.id),reserved=reservationRows(item.id);return {item,setting,physical:physical(item.id),positions:rows,reservations:reserved,eligible:sum(eligible(rows,today(),item)),reconciled:!setting||Math.abs(sum(rows)-physical(item.id))<=EPS&&!rows.some(r=>r.quantity< -EPS),movements:db.prepare(`SELECT m.id,m.quantity,m.kind,m.created_at,p.lot_no,w.code warehouse_code,s.reference_no,s.transaction_type,m.transfer_id FROM lot_movements m JOIN lot_positions p ON p.id=m.position_id JOIN warehouses w ON w.id=p.warehouse_id LEFT JOIN stock_transactions s ON s.id=m.stock_transaction_id WHERE p.item_id=? ORDER BY m.id DESC LIMIT 200`).all(item.id)};}
 function createWarehouse(body){return Number(db.prepare('INSERT INTO warehouses(code,name) VALUES(?,?)').run(txt(body.code,30).toUpperCase(),txt(body.name,100)).lastInsertRowid);}
 function transfer(body){return db.transaction(()=>{
  const item=itemRow(body.itemId);if(!tracked(item.id))throw new Error('Enable lot tracking first.');const rows=ensureReconciled(item.id),source=rows.find(r=>r.id===id(body.positionId)),dest=warehouse(body.warehouseId),amount=qty(body.quantity);
  if(!source||source.warehouse_id===dest.id||amount>source.quantity+EPS)throw new Error('Choose another warehouse and sufficient source quantity.');
  const transferId=Number(db.prepare('INSERT INTO warehouse_transfers(item_id,source_id,destination_id,lot_no,quantity,reason) VALUES(?,?,?,?,?,?)').run(item.id,source.warehouse_id,dest.id,source.lot_no,amount,txt(body.reason,500)).lastInsertRowid);
  const target=ensurePosition(item.id,dest.id,source.lot_no,source.expiry_date,source.received_on);
  addMove(source.id,-amount,'TRANSFER',null,transferId);addMove(target,amount,'TRANSFER',null,transferId);ensureReconciled(item.id);return {id:transferId};
 })();}
 function reserveBatch(batchId){return db.transaction(()=>{
  const batch=db.prepare('SELECT * FROM production_batches WHERE id=?').get(id(batchId));if(!batch||batch.status!=='DRAFT')throw new Error('Only draft batches can reserve stock.');
  const rows=db.prepare('SELECT item_id,SUM(planned_base_quantity) quantity FROM production_consumption WHERE production_batch_id=? GROUP BY item_id').all(batch.id);
  if(!rows.length)throw new Error('Batch has no requirements.');
  for(const r of rows){const item=itemRow(r.item_id);if(!tracked(item.id))throw new Error(`${item.name}: enable verified lot tracking before reserving.`);const amount=qty(r.quantity);const available=sum(eligible(ensureReconciled(item.id),today(),item))-sum(reservationRows(item.id).filter(x=>x.batch_id!==batch.id));if(amount>available+EPS)throw new Error(`${item.name}: insufficient unreserved eligible stock.`);}
  db.prepare("UPDATE production_stock_reservations SET status='RELEASED' WHERE batch_id=? AND status='ACTIVE'").run(batch.id);
  for(const r of rows)db.prepare("INSERT INTO production_stock_reservations(batch_id,item_id,quantity,status) VALUES(?,?,?,'ACTIVE')").run(batch.id,r.item_id,r.quantity);
  return {reserved:rows.length};
 })();}
 function releaseBatch(batchId){const batch=db.prepare('SELECT status FROM production_batches WHERE id=?').get(id(batchId));if(!batch||batch.status!=='DRAFT')throw new Error('Only draft reservations can be released.');return {released:db.prepare("UPDATE production_stock_reservations SET status='RELEASED' WHERE batch_id=? AND status='ACTIVE'").run(batchId).changes};}
 function removePurchaseReceipt(receipt){const setting=tracked(receipt.item_id);if(!setting)return;
  if(receipt.id<=setting.cutoff_id)throw new Error('Purchase predates verified lot tracking; use an audited stock correction instead.');
  const item=itemRow(receipt.item_id),rows=ensureReconciled(item.id),moves=db.prepare('SELECT position_id id,quantity FROM lot_movements WHERE stock_transaction_id=?').all(receipt.id);
  if(moves.length!==1||Math.abs(moves[0].quantity-receipt.quantity_in)>EPS)throw new Error('Purchase lot receipt cannot be verified.');
  const p=rows.find(r=>r.id===moves[0].id);if(!p||p.quantity+EPS<receipt.quantity_in)throw new Error('Original receipt has been moved or consumed.');
  if(db.prepare('SELECT 1 FROM lot_movements WHERE position_id=? AND transfer_id IS NOT NULL AND id>(SELECT MIN(id) FROM lot_movements WHERE stock_transaction_id=?) LIMIT 1').get(p.id,receipt.id))throw new Error('Original receipt has later warehouse transfers.');
  reserveCheck(item,rows,[{...p,allocated:receipt.quantity_in}],null);db.prepare('DELETE FROM lot_movements WHERE stock_transaction_id=?').run(receipt.id);
 }
 return {tracked,inspect,suggest,enable,postStock,createWarehouse,transfer,reserveBatch,releaseBatch,removePurchaseReceipt,warehouses:()=>db.prepare('SELECT * FROM warehouses ORDER BY code').all(),drafts:()=>db.prepare("SELECT id,batch_no,production_date FROM production_batches WHERE status='DRAFT' ORDER BY id DESC").all()};
}
