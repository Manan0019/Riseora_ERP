import db from "../database.js";

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export function runAdvancedProductionMigration() {
  addColumnIfMissing(
    "production_batches",
    "good_output_qty",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "rejected_qty",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "rework_qty",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "scrap_qty",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "total_outcome_qty",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "output_variance_qty",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "output_variance_percent",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "yield_percent",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "manufacturing_loss_cost",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "wip_material_cost",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "formula_snapshot_json",
    "TEXT",
  );
  addColumnIfMissing(
    "production_batches",
    "started_at",
    "TEXT",
  );
  addColumnIfMissing(
    "production_batches",
    "completed_at",
    "TEXT",
  );
  addColumnIfMissing(
    "production_batches",
    "closed_at",
    "TEXT",
  );
  addColumnIfMissing(
    "production_batches",
    "qc_status",
    "TEXT NOT NULL DEFAULT 'NOT_CHECKED'",
  );
  addColumnIfMissing(
    "production_batches",
    "qc_checked_at",
    "TEXT",
  );
  addColumnIfMissing(
    "production_batches",
    "qc_notes",
    "TEXT",
  );
  addColumnIfMissing(
    "production_batches",
    "correction_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_batches",
    "last_correction_reason",
    "TEXT",
  );

  addColumnIfMissing(
    "production_consumption",
    "planned_base_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "actual_base_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "base_unit_id",
    "INTEGER",
  );
  addColumnIfMissing(
    "production_consumption",
    "base_unit_cost",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "total_cost",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "variance_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "variance_percent",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "waste_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "waste_base_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "issued_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "issued_base_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "issued_base_unit_cost",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "issued_total_cost",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "returned_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "returned_base_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "extra_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "extra_base_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "extra_cost",
    "REAL NOT NULL DEFAULT 0",
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS production_batch_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      production_batch_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (production_batch_id)
        REFERENCES production_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_production_batch_events_batch
      ON production_batch_events(production_batch_id, id);

    CREATE INDEX IF NOT EXISTS idx_production_batches_status
      ON production_batches(status);
  `);

  /*
   * Bring historical one-step production records into the new lifecycle.
   * Old POSTED records were already fully consumed/produced, so they are
   * equivalent to COMPLETED batches.
   */
  db.exec(`
    UPDATE production_batches
    SET status = 'COMPLETED'
    WHERE status = 'POSTED';

    UPDATE production_batches
    SET
      good_output_qty = CASE
        WHEN good_output_qty = 0 THEN COALESCE(actual_output_qty, 0)
        ELSE good_output_qty
      END,
      total_outcome_qty = CASE
        WHEN total_outcome_qty = 0 THEN COALESCE(actual_output_qty, 0)
        ELSE total_outcome_qty
      END,
      output_variance_qty = CASE
        WHEN output_variance_qty = 0
          THEN COALESCE(actual_output_qty, 0) - COALESCE(planned_batch_size, 0)
        ELSE output_variance_qty
      END,
      output_variance_percent = CASE
        WHEN COALESCE(planned_batch_size, 0) > 0
          THEN ((COALESCE(actual_output_qty, 0) - planned_batch_size) / planned_batch_size) * 100
        ELSE 0
      END,
      yield_percent = CASE
        WHEN COALESCE(planned_batch_size, 0) > 0
          THEN (COALESCE(actual_output_qty, 0) / planned_batch_size) * 100
        ELSE 0
      END,
      completed_at = COALESCE(completed_at, updated_at, created_at)
    WHERE status IN ('COMPLETED', 'CLOSED');
  `);

  console.log("Advanced production migration completed");
}
