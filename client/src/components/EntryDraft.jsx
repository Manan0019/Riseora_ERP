import { useEffect, useRef, useState } from 'react';
import { useUi } from '../context/UiContext';
import { useAuth } from '../context/AuthContext';
import { draftPrefix, listDrafts, writeDraft } from '../utils/entryProductivity';

// Drafts are deliberately local-only, never transferred as part of the business database.
const liveKeys = new Set();
export function useEntryDraft({ kind, enabled = true, payload, meaningful, restore, reset }) {
  const { user } = useAuth();
  const { warning } = useUi();
  const local = ['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
  const prefix = user?.id && local && enabled ? draftPrefix(`${user.id}:${user.username}`, kind) : '';
  const [keyId] = useState(() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const key = prefix ? prefix + keyId : '';
  const [available,setAvailable] = useState([]);
  const [storageError,setStorageError] = useState(false);
  const [status,setStatus] = useState('draft');
  const statusRef = useRef('draft');
  const latest = useRef(payload); latest.current = payload;
  const refresh = () => {
    if (!key) return;
    try { setAvailable(listDrafts(localStorage,prefix,new Set([...liveKeys,key]))); }
    catch { setStorageError(true); }
  };
  useEffect(() => {
    if (!key) return undefined;
    liveKeys.add(key); refresh();
    let released=false, release;
    // Chromium Web Locks also protect a live draft in another Electron window.
    const hold=new Promise(resolve=>{release=resolve;});
    navigator.locks?.request(key, async()=>{if(!released)await hold;}).catch(()=>setStorageError(true));
    window.addEventListener('storage',refresh); window.addEventListener('focus',refresh);
    return () => { released=true;release();liveKeys.delete(key); window.removeEventListener('storage',refresh); window.removeEventListener('focus',refresh); };
  },[key]);
  const persist = (nextStatus, data = latest.current) => {
    if (!key) return true;
    try { writeDraft(localStorage,key,data,nextStatus); setStorageError(false); return true; }
    catch { setStorageError(true); return false; }
  };
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    if (!key || statusRef.current !== 'draft') return;
    if (meaningful) persist('draft');
    else { try { localStorage.removeItem(key); } catch { setStorageError(true); } }
  },[key,serialized,meaningful]);
  function clear() {
    statusRef.current='draft'; setStatus('draft');
    if (!key) return;
    try { localStorage.removeItem(key); } catch { setStorageError(true); }
    refresh();
  }
  function beginPost() {
    if (statusRef.current !== 'draft') return false;
    if (!persist('posting')) {warning('Unable to protect this local draft before posting. Free local storage or restart the application after preserving the entry.');return false;}
    statusRef.current='posting'; setStatus('posting'); return true;
  }
  function failed(error) {
    if(statusRef.current!=='posting') return;
    const code=error?.response?.status;
    const next = Number.isInteger(code) && code >=400 && code<500 && code!==408 ? 'draft' : 'uncertain';
    statusRef.current=next; setStatus(next); persist(next);
  }
  async function withInactiveDraft(record, action) {
    if(liveKeys.has(record.key)) return;
    if(!navigator.locks){warning('Draft recovery requires a current Chromium browser with Web Locks support.');return;}
    try { await navigator.locks.request(record.key,{ifAvailable:true},lock=>{
      if(!lock){warning('This draft is open in another window. Close it before recovering or discarding.');return;}
      const fresh=listDrafts(localStorage,prefix,new Set([...liveKeys,key])).find(x=>x.key===record.key && x.updatedAt===record.updatedAt && x.status===record.status);
      if(fresh)action(fresh);refresh();
    }); } catch { setStorageError(true); }
  }
  function recover(record) {
    if (meaningful || statusRef.current !== 'draft' || record.status !== 'draft') return;
    return withInactiveDraft(record,fresh=>{
      const data=fresh.payload;
      if(!data.form || typeof data.form!=='object' || Array.isArray(data.form) || (kind==='formula' ? !Array.isArray(data.ingredients)||!Array.isArray(data.processExtras) : !Array.isArray(data.lines))){warning('This draft has an invalid format.');return;}
      writeDraft(localStorage,key,data);localStorage.removeItem(record.key);restore(data);
    });
  }
  function remove(record) {return withInactiveDraft(record,fresh=>localStorage.removeItem(fresh.key));}
  function discardCurrent() { clear(); reset?.(); }
  return { enabled: Boolean(key), available, storageError, status, meaningful, beginPost, failed, clear, recover, remove, discardCurrent, refresh };
}

export default function EntryDraft({ draft, saving = false }) {
  const {confirm}=useUi();
  if (!draft.enabled && draft.status !== 'uncertain') return null;
  return <section className="entry-draft-panel mb-3" aria-label="Local draft recovery">
    <div className="entry-draft-heading"><span><strong>Draft recovery</strong><small> {draft.storageError ? 'Storage unavailable — keep this form open.' : draft.meaningful ? 'Saved locally while editing (not posted).' : 'Unfinished entries can be recovered here.'}</small></span><button type="button" className="btn btn-sm btn-outline-secondary" onClick={draft.refresh}>Refresh</button></div>
    {draft.status==='uncertain' && <div className="alert alert-warning mb-2">The previous save result is uncertain. Check the register before entering it again. This draft cannot be posted again from this form.</div>}
    {draft.meaningful && !saving && <button type="button" className="btn btn-sm btn-outline-danger" onClick={async()=>{if(await confirm({title:'Discard current draft?',message:'No posted records will be changed. Check the register first if a posting was interrupted.',confirmLabel:'Discard draft',variant:'warning'})) draft.discardCurrent();}}>Discard current draft</button>}
    {draft.available.map(record=><div className="entry-draft-record" key={record.key}><div><strong>{new Date(record.updatedAt).toLocaleString('en-IN')}</strong><small>{record.status==='draft' ? 'Unfinished entry — verify dates, item IDs and prices, especially after restoring a database.' : 'Previous posting may have succeeded. Check the register; recovery is disabled.'}</small></div><div className="d-flex gap-2"><button type="button" disabled={saving || draft.meaningful || record.status!=='draft'} className="btn btn-sm btn-outline-primary" onClick={async()=>{if(await confirm({title:"Restore unfinished entry?",message:"Review the recovered entry against current records and verify it has not already been posted, especially after restoring a database.",confirmLabel:"Restore draft"}))draft.recover(record);}}>Restore</button><button type="button" disabled={saving} className="btn btn-sm btn-outline-danger" onClick={async()=>{if(await confirm({title:'Discard saved draft?',message:'This deletes only the local recovery copy. Check the register first if posting was interrupted.',confirmLabel:'Discard draft',variant:'warning'}))draft.remove(record);}}>Discard</button></div></div>)}
  </section>;
}
