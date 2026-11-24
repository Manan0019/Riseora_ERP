import db from '../database.js';
import { installRecordHistory } from '../../utils/recordHistorySchema.js';
export function runManagementMigration() {
  db.transaction(()=>{
    db.exec(`CREATE TABLE IF NOT EXISTS item_barcodes (
      id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id), barcode TEXT NOT NULL UNIQUE COLLATE NOCASE
    ); CREATE INDEX IF NOT EXISTS idx_item_barcodes_item ON item_barcodes(item_id);
    CREATE TABLE IF NOT EXISTS formula_specifications (
      id INTEGER PRIMARY KEY, formula_id INTEGER NOT NULL UNIQUE REFERENCES formulas(id),
      instructions TEXT NOT NULL DEFAULT '', ph_min REAL, ph_max REAL, viscosity TEXT NOT NULL DEFAULT '', appearance TEXT NOT NULL DEFAULT '',
      CHECK(ph_min IS NULL OR ph_min BETWEEN 0 AND 14), CHECK(ph_max IS NULL OR ph_max BETWEEN 0 AND 14), CHECK(ph_min IS NULL OR ph_max IS NULL OR ph_min<=ph_max)
    );
    CREATE TABLE IF NOT EXISTS ingredient_substitution_requests (
      id INTEGER PRIMARY KEY, formula_id INTEGER NOT NULL REFERENCES formulas(id),
      original_item_id INTEGER NOT NULL REFERENCES items(id), proposed_item_id INTEGER NOT NULL REFERENCES items(id),
      reason TEXT NOT NULL, review_note TEXT, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
      requested_by INTEGER REFERENCES users(id), reviewed_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
      CHECK(original_item_id<>proposed_item_id)
    );`);
    installRecordHistory(db,true);
  })();
}
