import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installRecordHistory} from '../server/src/utils/recordHistorySchema.js';
import {registerAuditFunctions,withAuditActor} from '../server/src/utils/auditContext.js';
import {planRecordedLots} from '../server/src/utils/lotPlanning.js';
test('attributed audit upgrades history in place, isolates request context and rolls back',async()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO items VALUES(1,'A');");
 installRecordHistory(db);db.exec("UPDATE items SET name='B'");registerAuditFunctions(db);installRecordHistory(db,true);installRecordHistory(db,true);
 assert.equal(db.prepare('SELECT actor_id FROM record_history').get().actor_id,null);
 await Promise.all([withAuditActor({id:5,username:'owner'},async()=>{await Promise.resolve();db.exec("UPDATE items SET name='C'");}),withAuditActor({id:7,username:'staff'},async()=>{await Promise.resolve();db.exec("UPDATE items SET name='D'");})]);
 const rows=db.prepare('SELECT actor_id,actor_name FROM record_history ORDER BY id').all();assert.deepEqual(rows.map(r=>r.actor_id),[null,5,7]);assert.deepEqual(rows.map(r=>r.actor_name),[null,'owner','staff']);
 withAuditActor({id:5},()=>db.exec("BEGIN;UPDATE items SET name='X';ROLLBACK;"));assert.equal(db.prepare('SELECT COUNT(*) n FROM record_history').get().n,3);db.exec("UPDATE items SET name='system'");assert.equal(db.prepare('SELECT actor_id FROM record_history ORDER BY id DESC').get().actor_id,null);
 }finally{db.close();}
});
const row=(id,lot_no,transaction_date,expiry_date,quantity_in,quantity_out=0)=>({id,lot_no,transaction_date,expiry_date,quantity_in,quantity_out});
const rows=[row(1,'A','2026-01-01','2027-01-01',5),row(2,'B','2026-02-01','2026-12-01',3),row(3,'B','2026-02-02',null,0,1),row(4,'OLD','2026-01-01','2026-02-01',20)];
test('FEFO and FIFO suggestions differ; expiry excluded and shortage reported',()=>{
 const fefo=planRecordedLots(rows,4,'2026-11-24','FEFO');assert.equal(fefo.verified,true);assert.deepEqual(fefo.allocations.map(x=>[x.lot,x.allocated]),[['B',2],['A',2]]);assert.equal(fefo.excluded[0].lot,'OLD');
 const fifo=planRecordedLots(rows,4,'2026-11-24','FIFO');assert.deepEqual(fifo.allocations.map(x=>[x.lot,x.allocated]),[['A',4]]);assert.equal(planRecordedLots(rows,10,'2026-11-24').shortage,3);
});
test('missing lots, inconsistent expiry, negative historical balance and invalid input block suggestions',()=>{
 for(const additional of [row(5,null,'2026-02-01',null,0,1),row(5,'B','2026-02-01','2027-02-01',1),row(5,'B','2026-02-01',null,0,20)]){const result=planRecordedLots([...rows,additional],1,'2026-11-24');assert.equal(result.verified,false);assert.equal(result.allocations.length,0);}
 assert.throws(()=>planRecordedLots(rows,0,'2026-11-24'));assert.throws(()=>planRecordedLots(rows,1,'2026-02-31'));
});
