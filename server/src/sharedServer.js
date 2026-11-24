// Explicit operator-managed HTTPS deployment, never used by the desktop installer.
import dotenv from 'dotenv';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {validateSharedSettings} from './utils/sharedAccess.js';
dotenv.config();
const addresses=Object.values(os.networkInterfaces()).flat().filter(Boolean).map(x=>x.address);
const cfg=validateSharedSettings(process.env,addresses);
if(process.env.INITIAL_ADMIN_PASSWORD&&(process.env.INITIAL_ADMIN_PASSWORD.length<12||Buffer.byteLength(process.env.INITIAL_ADMIN_PASSWORD)>72))throw new Error('Initial administrator password must have at least 12 characters and at most 72 bytes.');
// Fail before touching a database when TLS or the built frontend is unavailable.
for(const f of [process.env.RISEORA_TLS_KEY,process.env.RISEORA_TLS_CERT])fs.accessSync(f,fs.constants.R_OK);
const dist=new URL('../../client/dist/index.html',import.meta.url);fs.accessSync(dist,fs.constants.R_OK);
fs.mkdirSync(path.dirname(cfg.dbPath),{recursive:true});
const lock=cfg.dbPath+'.shared-host.lock';
const fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,`${process.pid}\n`);fs.closeSync(fd);
const cleanup=()=>{try{fs.unlinkSync(lock);}catch{/* already cleaned */}};
process.once('exit',cleanup);
process.env.NODE_ENV='production';process.env.RISEORA_SHARED_MODE='1';process.env.PORT=String(cfg.port);process.env.CLIENT_ORIGIN=cfg.origin;
try{await import('./app.js');}catch(e){cleanup();throw e;}
