import { useEffect, useRef, useState } from "react";
import api from "../api/api";

export default function WorkspaceSearch({ pages, onOpen, onClose, help = false }) {
  const ref = useRef(null);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState([]);
  const [state, setState] = useState("");
  const [active, setActive] = useState(0);
  const normalized = query.trim().toLowerCase();
  const results = [...pages.filter(p => p.label.toLowerCase().includes(normalized)).map(p => ({ label:p.label, kind:"Page", path:p.to })), ...remote].filter((r,i,all)=>all.findIndex(x=>x.path===r.path)===i).slice(0, 40);
  useEffect(() => { const d = ref.current; d.showModal(); return () => d.close(); }, []);
  useEffect(() => {
    setRemote([]); setActive(0); setState("");
    if (help || normalized.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("Searching records…");
      try { const { data } = await api.get("/workspace-search", { params:{ q: normalized }, signal:controller.signal }); if (!controller.signal.aborted) { setRemote(data.results || []); setState(""); } }
      catch { if (!controller.signal.aborted) setState("Record search unavailable. Page navigation is still available."); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalized, help]);
  function choose(result) { if (result) { onClose(); onOpen(result.path); } }
  return <dialog ref={ref} className="pro-dialog" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h2>{help ? "Keyboard shortcuts" : "Find anything"}</h2><button className="btn btn-outline-secondary" onClick={onClose} type="button">Close</button></header>
    {help ? <dl className="pro-shortcuts">{[["Ctrl+K","Search pages and records"],["Ctrl+F","Focus the visible search field"],["Ctrl+N","New record / row on supported forms"],["Ctrl+S","Save supported forms; focus Post for financial entries"],["F2","Focus an explicitly marked edit action"],["Tab / Shift+Tab","Move through controls"],["Esc","Close search or existing dialogs"],["F1","Keyboard help"]].map(([k,v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl> : <>
      <input autoFocus className="form-control" aria-label="Search workspace" placeholder="Search modules, items, parties, invoices…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{ if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(0,Math.min(results.length-1,i+(e.key==="ArrowDown"?1:-1))));} if(e.key==="Enter"){e.preventDefault();choose(results[active]);} }}/>
      <div className="pro-search-results">{results.map((r,i)=><button type="button" className={active===i?"is-selected":""} key={`${r.kind}:${r.path}`} onClick={()=>choose(r)}><span>{r.label}</span><small>{r.kind}</small></button>)}{!results.length && !state && <p>No results.</p>}</div><small role="status">{state || "Use ↑ / ↓ and Enter to open a result in a new tab."}</small>
    </>}
  </dialog>;
}
