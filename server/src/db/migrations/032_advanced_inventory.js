import db from '../database.js';
import {installAmendments} from '../../utils/recordAmendments.js';
import {installAdvancedInventory} from '../../utils/advancedInventory.js';
import {installRecordHistory} from '../../utils/recordHistorySchema.js';
export function runAdvancedInventoryMigration(){db.transaction(()=>{installAdvancedInventory(db);installAmendments(db);
 const columns=new Set(db.prepare('PRAGMA table_info(formula_specifications)').all().map(x=>x.name));
 for(const name of ['viscosity_min_cp','viscosity_max_cp'])if(!columns.has(name))db.exec(`ALTER TABLE formula_specifications ADD COLUMN ${name} REAL CHECK(${name} IS NULL OR ${name}>=0)`);
 db.exec(`CREATE TABLE IF NOT EXISTS production_qc_measurements(id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL UNIQUE REFERENCES production_batches(id), measurements_json TEXT NOT NULL, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
 installRecordHistory(db,true);})();}
