import { useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { readPreference, writePreference } from "../utils/proPreferences";

export function useSortableRows(rows, defaultKey = "", defaultDirection = "asc") {
  const {pathname}=useLocation();
  const prefKey=`sort:${pathname}`;
  const [sort, setSort] = useState(() => defaultKey ? readPreference(prefKey, {key:defaultKey,direction:defaultDirection}) : {key:defaultKey,direction:defaultDirection});
  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const left = a[sort.key]; const right = b[sort.key];
      if (left == null || left === "") return right == null || right === "" ? 0 : 1;
      if (right == null || right === "") return -1;
      const x = Number(left); const y = Number(right);
      const comparison = Number.isFinite(x) && Number.isFinite(y) ? x - y :
        String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "desc" ? -comparison : comparison;
    });
    return copy;
  }, [rows, sort]);
  function toggle(key) {
    setSort((current) => { const next={key,direction:current.key===key&&current.direction==="asc"?"desc":"asc"};if(defaultKey)writePreference(prefKey,next);return next; });
  }
  return { sortedRows, sort, toggle };
}

export default function SortableTh({ field, sort, onSort, children, ...props }) {
  const {pathname}=useLocation();
  const key=`width:${pathname}:${field}`;
  const [width,setWidth]=useState(()=>readPreference(key, null));
  const drag=useRef(null), header=useRef(null);
  function change(value){const next=Math.max(64,Math.min(900,Math.round(value)));setWidth(next);return next;}
  return <th {...props} ref={header} className={`${props.className||""} pro-resizable-th`} style={{...props.style,...(width?{width:`${width}px`,minWidth:`${width}px`}:{})}} aria-sort={sort.key === field ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
    <button type="button" className="table-sort-button" onClick={() => onSort(field)} title={`Sort by ${typeof children === "string" ? children : field}`}>
      <span>{children}</span><span className="table-sort-indicator" aria-hidden="true">{sort.key === field ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
    <span className="pro-resize-handle" role="separator" aria-label={`Resize ${field} column`} aria-orientation="vertical" aria-valuemin={64} aria-valuemax={900} aria-valuenow={width||128} tabIndex={0} title="Drag to resize; double-click to reset. Arrow keys adjust width."
      onPointerDown={e=>{if(e.button!==0)return; e.preventDefault(); e.stopPropagation(); drag.current={x:e.clientX,w:header.current.getBoundingClientRect().width,last:null};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(drag.current)drag.current.last=change(drag.current.w+e.clientX-drag.current.x);}}
      onPointerUp={()=>{if(drag.current?.last)writePreference(key,drag.current.last);drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
      onDoubleClick={e=>{e.stopPropagation();setWidth(null);writePreference(key,null);}}
      onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='Home'){setWidth(null);writePreference(key,null);}else writePreference(key,change((header.current?.getBoundingClientRect().width||128)+(e.key==='ArrowRight'?16:-16)));}} />
  </th>;
}
