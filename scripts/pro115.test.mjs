import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { installRecordHistory } from '../server/src/utils/recordHistorySchema.js';
import { pricingEstimate, scaleQuantity } from '../client/src/utils/proPreferences.js';

test('history migration is idempotent, preserves legacy records, and follows rollback',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT, density REAL, notes TEXT); INSERT INTO items VALUES(1,'Old',1,'private note');");
    installRecordHistory(db);installRecordHistory(db);
    assert.equal(db.prepare('SELECT count(*) n FROM record_history').get().n,0);
    db.exec("UPDATE items SET name='New' WHERE id=1");
    let row=db.prepare('SELECT * FROM record_history').get();
    assert.deepEqual(JSON.parse(row.before_json),{name:'Old',density:1});
    assert.deepEqual(JSON.parse(row.after_json),{name:'New',density:1});
    db.exec("UPDATE items SET name='New' WHERE id=1; UPDATE items SET notes='secret' WHERE id=1;");
    assert.equal(db.prepare('SELECT count(*) n FROM record_history').get().n,1);
    db.exec("BEGIN; UPDATE items SET density=2 WHERE id=1; ROLLBACK;");
    assert.equal(db.prepare('SELECT count(*) n FROM record_history').get().n,1);
    assert.equal(db.prepare('SELECT density FROM items').get().density,1);
    db.exec("DELETE FROM items WHERE id=1;");
    assert.equal(db.prepare('SELECT operation FROM record_history ORDER BY id DESC').get().operation,'DELETE');
  }finally{db.close();}
});
test('batch scaling and gross margin calculations reject invalid quantities',()=>{
  assert.equal(scaleQuantity(25,100,500),125);assert.equal(scaleQuantity(25,0,500),null);assert.equal(scaleQuantity(-1,100,500),null);
  assert.equal(pricingEstimate(60,40),100);assert.equal(pricingEstimate(60,100),null);assert.equal(pricingEstimate(-1,40),null);assert.equal(pricingEstimate(60,-1),null);
});
