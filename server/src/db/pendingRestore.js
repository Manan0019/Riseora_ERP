/*
 * Restore only before the application's primary SQLite connection is opened.
 * Never overwrite a live database from an HTTP handler.
 * SQLite's online-backup API makes a consistent safety copy (including WAL data).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

export const RESTORE_STAGE_FILE = '.riseora-pending-restore.db';
export const RESTORE_MARKER_FILE = '.riseora-restore-request.json';
const REQUIRED_TABLES = ['users', 'items', 'units', 'item_categories', 'purchases', 'purchase_items', 'sales_invoices', 'sales_items', 'stock_transactions'];

export function validateRiseoraDatabase(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 4096) {
    throw new Error('Selected backup is missing or empty.');
  }
  const magic = Buffer.alloc(16);
  const file = fs.openSync(filePath, 'r');
  try { fs.readSync(file, magic, 0, magic.length, 0); } finally { fs.closeSync(file); }
  if (magic.toString('utf8') !== 'SQLite format 3\0') throw new Error('Selected file is not a SQLite database.');

  const source = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    if (String(source.pragma('quick_check', { simple: true })).toLowerCase() !== 'ok') {
      throw new Error('Backup failed SQLite integrity validation.');
    }
    const issues = source.pragma('foreign_key_check');
    if (issues.length) throw new Error(`Backup contains ${issues.length} foreign-key errors.`);
    const tables = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({name}) => name));
    const missing = REQUIRED_TABLES.filter(name => !tables.has(name));
    if (missing.length) throw new Error(`Not a compatible Riseora ERP backup; missing: ${missing.join(', ')}.`);
    return {
      companyName: tables.has('companies') ? source.prepare('SELECT name FROM companies ORDER BY id LIMIT 1').get()?.name || null : null,
      formulaCount: tables.has('formulas') ? source.prepare('SELECT COUNT(*) AS n FROM formulas').get().n : null,
      productionCount: tables.has('production_batches') ? source.prepare('SELECT COUNT(*) AS n FROM production_batches').get().n : null,
      itemCount: Number(source.prepare('SELECT COUNT(*) AS n FROM items').get().n),
      purchaseCount: Number(source.prepare('SELECT COUNT(*) AS n FROM purchases').get().n),
      salesCount: Number(source.prepare('SELECT COUNT(*) AS n FROM sales_invoices').get().n),
      sizeBytes: fs.statSync(filePath).size,
    };
  } finally { source.close(); }
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export async function applyPendingDatabaseRestore(dbPath, backupDir) {
  const dataDir = path.dirname(dbPath);
  const markerPath = path.join(dataDir, RESTORE_MARKER_FILE);
  if (!fs.existsSync(markerPath)) return false;

  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  if (marker?.stageFile !== RESTORE_STAGE_FILE || !/^[a-f\d]{64}$/.test(marker.sha256 || '')) {
    throw new Error('Pending restore request is invalid. Original database was not modified.');
  }
  const stagePath = path.join(dataDir, RESTORE_STAGE_FILE);
  validateRiseoraDatabase(stagePath);
  if (sha256File(stagePath) !== marker.sha256) {
    throw new Error('Pending restore backup checksum changed. Original database was not modified.');
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const suffix = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  // This backup captures all committed transactions, including anything written after staging.
  if (fs.existsSync(dbPath)) {
    const before = new Database(dbPath, { fileMustExist: true });
    try {
      const rollbackPath = path.join(backupDir, `before_restore_${suffix}.db`);
      await before.backup(rollbackPath);
      validateRiseoraDatabase(rollbackPath);
      const checkpoint = before.pragma('wal_checkpoint(TRUNCATE)');
      if (checkpoint.some(row => Number(row.busy || 0) > 0)) {
        throw new Error('Database is in use. Close all other Riseora ERP processes before restoring.');
      }
    } finally { before.close(); }
  }

  const tmp = path.join(dataDir, `.riseora-restoring-${suffix}.db`);
  const movedOld = path.join(dataDir, `.riseora-original-${suffix}.db`);
  fs.copyFileSync(stagePath, tmp, fs.constants.COPYFILE_EXCL);
  let originalMoved = false;
  try {
    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, movedOld);
      originalMoved = true;
    }
    // A closed WAL database must not bring an old WAL into a replaced database.
    for (const suffix of ['-wal', '-shm']) {
      fs.rmSync(`${dbPath}${suffix}`, {force: true});
    }
    fs.renameSync(tmp, dbPath);
    validateRiseoraDatabase(dbPath);
    fs.rmSync(markerPath, { force: true });
    fs.rmSync(stagePath, { force: true });
    if (originalMoved) fs.rmSync(movedOld, { force: true });
    return true;
  } catch (error) {
    // Prefer restoring the exact prior DB; its online safety backup is retained too.
    if (originalMoved && fs.existsSync(movedOld)) {
      if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });
      fs.renameSync(movedOld, dbPath);
    }
    throw new Error(`Database restore could not complete: ${error?.message || error}`);
  } finally { fs.rmSync(tmp, { force: true }); }
}
