// Small-office, single-host shared access. No shared SQLite files and no multi-writer claim.
import net from 'node:net';
import path from 'node:path';
export function validateSharedSettings(env,localAddresses){
 const bind=String(env.RISEORA_SHARED_BIND||'').trim(),port=Number(env.PORT||8443);
 if(!net.isIP(bind)||!localAddresses.includes(bind)||['0.0.0.0','::','127.0.0.1','::1'].includes(bind))throw new Error('RISEORA_SHARED_BIND must be a specific non-loopback address assigned to this host.');
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Shared HTTPS port must be 1024–65535.');
 let origin;try{origin=new URL(env.RISEORA_SHARED_ORIGIN);}catch{throw new Error('Set the exact HTTPS origin of the shared server.');}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||Number(origin.port||443)!==port)throw new Error('Shared origin must be HTTPS with the configured port and no path.');
 if(String(env.SESSION_SECRET||'').length<48)throw new Error('A unique random SESSION_SECRET of at least 48 characters is required.');
 const dbPath=String(env.RISEORA_DB_PATH||'');if(!path.isAbsolute(dbPath)||/^(?:\\\\|\/\/)/.test(dbPath)||/\bAppData\b/i.test(dbPath)||!dbPath.toLowerCase().endsWith('.db'))throw new Error('Use a dedicated absolute local database path, not a network share or the desktop app’s data directory.');
 if(!env.RISEORA_TLS_KEY||!env.RISEORA_TLS_CERT)throw new Error('A trusted HTTPS certificate and private key are required.');
 return {bind,port,origin:origin.origin,dbPath};
}
export function createWriterLease({now=Date.now,ttl=15*60*1000}={}){let writer=null,until=0;return {
 claim(session){if(!session)return false;const time=now();if(writer!==null&&writer!==session&&time<until)return false;writer=session;until=time+ttl;return true;},
 release(session){if(writer===session){writer=null;until=0;}},
 status(session){const active=writer!==null&&now()<until;return {active,owned:active&&writer===session,secondsRemaining:active?Math.ceil((until-now())/1000):0};}
};}
export function originAllowed(method,origin,expected){return ['GET','HEAD','OPTIONS'].includes(method)||origin===expected;}
export function createAuthThrottle({now=Date.now,windowMs=600000,max=12,maxKeys=4096}={}){const entries=new Map();return key=>{const t=now();for(const [k,v] of entries)if(t>=v.until)entries.delete(k);const old=entries.get(key);if(!old&&entries.size>=maxKeys)return false;const value=old||{count:0,until:t+windowMs};value.count++;entries.set(key,value);return value.count<=max;};}
