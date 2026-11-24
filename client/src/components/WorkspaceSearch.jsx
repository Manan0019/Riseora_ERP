import { useEffect, useId, useRef, useState } from "react";
import api from "../api/api";
import AppIcon from "./AppIcon";

export default function WorkspaceSearch({ pages, onOpen, onClose, open, onActivate }) {
  const ref = useRef(null), input = useRef(null), list = useRef(null), id = useId();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState([]);
  const [state, setState] = useState("");
  const [active, setActive] = useState(0);
  const normalized = query.trim().toLowerCase();
  const results = [...(remote.query === normalized ? remote.rows : []), ...pages.filter(p => p.label.toLowerCase().includes(normalized)).map(p => ({ label:p.label, kind:"Page", path:p.to }))].filter((r,i,all)=>all.findIndex(x=>x.path===r.path)===i).slice(0,40);
  useEffect(() => { if(open) input.current?.focus(); else {setQuery("");setActive(0);} }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = e => {if(!ref.current?.contains(e.target)) onClose();};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open,onClose]);
  useEffect(() => {
    setRemote([]); setActive(0); setState("");
    if (!open || normalized.length < 2) return;
    const controller = new AbortController();
    setState("Searching records…");
    const timer = setTimeout(async () => {
      try { const { data } = await api.get("/workspace-search", { params:{ q: normalized }, signal:controller.signal }); if (!controller.signal.aborted) { setRemote({query:normalized,rows:data.results || []}); setActive(0); setState(""); } }
      catch { if (!controller.signal.aborted) setState("Record search unavailable. Page navigation is still available."); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalized,open]);
  useEffect(()=>{if(open) list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[active,open]);
  function choose(result) { if (result) { onClose(); input.current?.blur(); onOpen(result.path); } }
  function key(e) {
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();input.current?.blur();}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();onActivate();setActive(i=>Math.max(0,Math.min(results.length-1,i+(e.key==='ArrowDown'?1:-1))));}
    if(e.key==='Enter'&&open){e.preventDefault();if(results[active]?.kind==="Page"||state!=="Searching records…")choose(results[active]);}
  }
  return <div className="workspace-global-search" ref={ref} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))onClose();}}>
    <div className="workspace-search-field"><AppIcon name="search" size={18}/><input ref={input} role="combobox" aria-label="Search Riseora ERP" aria-expanded={open} aria-controls={open?id:undefined} aria-autocomplete="list" aria-activedescendant={open&&results[active]?`${id}-${active}`:undefined} placeholder="Search anything…" value={query} onFocus={onActivate} onChange={e=>{setQuery(e.target.value);setActive(0);onActivate();}} onKeyDown={key}/>{query?<button type="button" className="workspace-search-clear" aria-label="Clear search" onClick={()=>{setQuery('');input.current?.focus();}}>×</button>:<kbd aria-hidden="true">Ctrl K</kbd>}</div>
    {open&&<div className="workspace-search-panel"><div className="workspace-search-caption">{normalized ? 'Search results' : 'Quick navigation'} <span>{results.length} results</span></div><div className="workspace-search-list" ref={list} role="listbox" id={id}>{results.map((r,i)=><div id={`${id}-${i}`} role="option" aria-selected={active===i} key={`${r.kind}:${r.path}`} className="workspace-search-option" onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(r)}><span className="workspace-search-type-icon"><AppIcon name={({Item:'items',Supplier:'suppliers',Customer:'customers',Purchase:'purchase',Invoice:'sales',Formula:'formula',Barcode:'items'})[r.kind]||'register'} size={17}/></span><span className="workspace-search-label">{r.label}<small>{r.kind}</small></span><AppIcon name="arrow" size={15}/></div>)}{!results.length&&!state&&<div className="workspace-search-empty">No matching records or pages.</div>}</div><div className="workspace-search-footer" role="status">{state||'↑ ↓ Navigate  ·  Enter Open  ·  Esc Close'}</div></div>}
  </div>;
}
export function ShortcutHelp({onClose}) {
  const ref=useRef(null);
  useEffect(()=>{const d=ref.current;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className="pro-dialog" onCancel={e=>{e.preventDefault();onClose();}}><header><h2>Keyboard shortcuts</h2><button className="btn btn-outline-secondary" onClick={onClose} type="button">Close</button></header><dl className="pro-shortcuts">{[["Ctrl+K","Search pages and records"],["Ctrl+F","Focus the visible search field"],["Ctrl+N","New record / row on supported forms"],["Ctrl+S","Save supported forms; focus Post for financial entries"],["F2","Focus an explicitly marked edit action"],["Tab / Shift+Tab","Move through controls"],["Esc","Close search or existing dialogs"],["F1","Keyboard help"]].map(([k,v])=><div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl></dialog>;
}
