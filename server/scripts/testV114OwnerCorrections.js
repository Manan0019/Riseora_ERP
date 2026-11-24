/*
 * Run only with a temporary isolated DB. Never target the owner's actual data.
 * npm run test:v114
 */
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'riseora-114-test-'));
const data = path.join(tmp, 'data');
const backupDir = path.join(tmp, 'backups');
fs.mkdirSync(data);
process.env.RISEORA_DB_PATH = path.join(data, 'riseora_erp.db');
process.env.RISEORA_BACKUP_DIR = backupDir;
process.env.INITIAL_ADMIN_USERNAME = 'testadmin';
process.env.INITIAL_ADMIN_PASSWORD = `X${crypto.randomBytes(20).toString('hex')}`;
process.env.INITIAL_ADMIN_FULL_NAME = 'Test Administrator';

try {
  const { default: db } = await import('../src/db/database.js');
  const { initDatabase } = await import('../src/db/initDatabase.js');
  const { convertQuantityWithDensity, convertItemQuantityByUnitIds } = await import('../src/services/unitConversionService.js');
  const { stageDatabaseRestore, previewDatabaseRestore } = await import('../src/services/backupService.js');
  const { applyPendingDatabaseRestore, validateRiseoraDatabase } = await import('../src/db/pendingRestore.js');
  await initDatabase();
  assert.equal(convertQuantityWithDensity(1, 'L', 'ML', null), 1000);
  assert.equal(convertQuantityWithDensity(1, 'KG', 'G', null), 1000);
  assert.equal(convertQuantityWithDensity(100, 'ML', 'G', 0.9), 90);
  assert.equal(convertQuantityWithDensity(90, 'G', 'ML', 0.9), 100);
  assert.equal(convertQuantityWithDensity(0.25, 'L', 'KG', 1.2), 0.3);
  assert.throws(() => convertQuantityWithDensity(100, 'ML', 'G', null), /density/);
  assert.throws(() => convertQuantityWithDensity(3, 'PCS', 'ML', 1), /cannot be converted/);

  const rawItem = db.prepare(`SELECT i.id FROM items i JOIN units u ON u.id = i.base_unit_id WHERE u.code IN ('G','KG','ML','L') LIMIT 1`).get();
  assert.ok(rawItem, 'Seed should provide a weight or volume item');
  const unitG = db.prepare("SELECT id FROM units WHERE code = 'G'").get();
  const unitML = db.prepare("SELECT id FROM units WHERE code = 'ML'").get();
  db.prepare('UPDATE items SET density = ? WHERE id = ?').run(1.25, rawItem.id);
  assert.equal(convertItemQuantityByUnitIds(rawItem.id, 100, unitML.id, unitG.id), 125);

  const restoredName = db.prepare('SELECT name FROM items WHERE id = ?').get(rawItem.id).name;
  const importFile = path.join(tmp, 'owner-export.db');
  await db.backup(importFile);
  validateRiseoraDatabase(importFile);
  db.prepare('UPDATE items SET name = ? WHERE id = ?').run('TEMP AFTER BACKUP', rawItem.id);
  await assert.rejects(stageDatabaseRestore(Buffer.from('NOT A VALID SQLITE FILE')), /valid/);
  const preview = previewDatabaseRestore(fs.readFileSync(importFile));
  assert.equal(preview.itemCount, db.prepare("SELECT COUNT(*) n FROM items").get().n);
  assert.equal(db.prepare("SELECT name FROM items WHERE id = ?").get(rawItem.id).name, "TEMP AFTER BACKUP");
  const response = await stageDatabaseRestore(fs.readFileSync(importFile));
  assert.equal(response.requiresRestart, true);
  assert.equal(db.prepare('SELECT name FROM items WHERE id = ?').get(rawItem.id).name, 'TEMP AFTER BACKUP', 'Restore must not modify active database');
  db.close();

  assert.equal(await applyPendingDatabaseRestore(process.env.RISEORA_DB_PATH, backupDir), true);
  const reopened = new Database(process.env.RISEORA_DB_PATH, { readonly: true });
  try {
    assert.equal(reopened.prepare('SELECT name FROM items WHERE id = ?').get(rawItem.id).name, restoredName);
    assert.equal(reopened.pragma('quick_check', { simple: true }), 'ok');
  } finally { reopened.close(); }
  assert.ok(fs.readdirSync(backupDir).some(name => name.startsWith('before_restore_') && name.endsWith('.db')));
  console.log('PASS v1.1.4 density conversions + staged restore + safety backup + integrity');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
