import fs from 'node:fs';
import path from 'node:path';
import db from '../db/database.js';
import { createBackup, listDatabaseBackups, cleanupOldBackups } from './backupService.js';
import { RESTORE_MARKER_FILE } from '../db/pendingRestore.js';
const configPath = path.join(path.dirname(db.name), 'backup-schedule.json');
export function backupSchedule() {
  try { const v=JSON.parse(fs.readFileSync(configPath,'utf8')); return { hours:[0,6,12,24].includes(v.hours)?v.hours:24 }; }
  catch { return {hours:24}; }
}
export function setBackupSchedule(hours) {
  if (![0,6,12,24].includes(hours)) throw new Error('Select off, 6, 12 or 24 hours.');
  const tmp=configPath+'.tmp'; fs.writeFileSync(tmp,JSON.stringify({hours}),{mode:0o600}); fs.renameSync(tmp,configPath); return {hours};
}
let inProgress=false;
async function tick() {
  if(inProgress || fs.existsSync(path.join(path.dirname(db.name),RESTORE_MARKER_FILE))) return;
  const {hours}=backupSchedule(); if(!hours)return;
  inProgress=true;
  try {
    const latest=listDatabaseBackups().find(b=>b.fileName.startsWith('scheduled_')||b.fileName.startsWith('startup_')||b.fileName.startsWith('riseora_erp_backup_'));
    if(latest && Date.now()-Date.parse(latest.modifiedAt)<hours*3600000)return;
    await createBackup('scheduled'); cleanupOldBackups({keep:30,prefix:'scheduled_'});
  } catch(e){console.error('Scheduled backup failed:',e.message);} finally {inProgress=false;}
}
export function startBackupSchedule(){const t=setInterval(tick,60000);t.unref();void tick();}
