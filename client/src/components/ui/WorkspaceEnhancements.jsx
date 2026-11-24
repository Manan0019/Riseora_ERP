import { useState } from 'react';
import WorkspaceDialog from './WorkspaceDialog';
import AppIcon from '../AppIcon';
import { useNotificationHistory } from '../../context/UiContext';
import { APPEARANCE_DEFAULTS, FONT_SIZES } from '../../utils/workspaceAppearance';

export function AppearanceDialog({ value, onChange, onClose }) {
  return <WorkspaceDialog title="Appearance & readability" onClose={onClose}>
    <p className="text-muted">Preferences apply immediately to this workspace and are saved on this device. Printed invoices, reports and labels remain unchanged.</p>
    <fieldset className="appearance-options"><legend>Color theme</legend>{['light','dark'].map(theme=><label key={theme} className={`appearance-option ${value.theme===theme?'selected':''}`}><input type="radio" name="riseora-theme" checked={value.theme===theme} onChange={()=>onChange({...value,theme})}/><span className={`appearance-swatch ${theme}`} aria-hidden="true"><i/><i/><i/></span><strong>{theme==='light'?'Riseora light':'Dark workspace'}</strong></label>)}</fieldset>
    <fieldset className="appearance-font-options mt-3"><legend>Text size</legend><div className="d-flex flex-wrap gap-2">{FONT_SIZES.map(font=><button key={font} type="button" className={`btn ${value.font===font?'btn-primary':'btn-outline-primary'}`} aria-pressed={value.font===font} onClick={()=>onChange({...value,font})}>{font}%</button>)}</div></fieldset>
    <div className="appearance-sample mt-3"><strong>Purchase Register</strong><p className="mb-0">Item name · Quantity 12.500 KG · ₹1,250.00</p></div>
    <button type="button" className="btn btn-outline-secondary mt-3" onClick={()=>onChange({...APPEARANCE_DEFAULTS})}>Reset appearance</button>
  </WorkspaceDialog>;
}
const types={success:'Success',danger:'Error',warning:'Warning',info:'Information'};
export function NotificationControl({ open, onOpen, onClose }) {
  const { history, markAllRead, clearHistory } = useNotificationHistory();
  const [filter,setFilter]=useState('all');
  const unread=history.filter(n=>!n.read).length;
  const filtered=history.filter(n=>filter==='all'||n.type===filter);
  return <><button type="button" className="workspace-notification-button" onClick={()=>{setFilter('all');markAllRead();onOpen();}} title="Notification centre" aria-label={`Notification centre, ${unread} unread`}><AppIcon name="bell" size={18}/>{unread>0&&<span className="notification-count">{unread>99?'99+':unread}</span>}</button>
    {open&&<WorkspaceDialog title="Notification centre" onClose={()=>{markAllRead();onClose();}}>
      <div className="notification-toolbar"><label>Show <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All notifications</option>{Object.entries(types).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><button className="btn btn-outline-secondary" type="button" disabled={!history.length} onClick={markAllRead}>Mark all read</button><button className="btn btn-outline-secondary" type="button" disabled={!history.length} onClick={clearHistory}>Clear history</button></div>
      <p className="text-muted small">Last 100 notifications from this signed-in window. History clears on sign-out or restart.</p>
      <div className="notification-history" aria-live="polite">{filtered.length===0?<p className="text-center text-muted p-4">No notifications to show.</p>:filtered.map(n=><article className={`notification-entry ${n.type}`} key={n.id}><span className="notification-symbol"><AppIcon name={n.type==='success'?'check':n.type==='info'?'info':'warning'}/></span><div><div className="notification-meta"><span>{types[n.type]||'Information'}{!n.read?' · New':''}</span><time dateTime={new Date(n.createdAt).toISOString()}>{new Date(n.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</time></div><strong>{n.title||types[n.type]}</strong><p>{n.message}</p></div></article>)}</div>
    </WorkspaceDialog>}
  </>;
}
// Copy visible cell text only, never move live forms, event handlers or markup.
function visible(el) { return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
function cellText(cell) {
  const clone=cell.cloneNode(true);
  clone.querySelectorAll('.pro-resize-handle,.table-sort-indicator,[aria-hidden="true"],button:not(.table-sort-button),input,select,textarea,svg').forEach(e=>e.remove());
  return (clone.textContent||'').replace(/\s+/g,' ').trim();
}
function tableSnapshot(table,index) {
  const name=table.caption?.textContent?.trim() || table.closest('section,.card')?.querySelector('h2,h3,h4,h5,h6')?.textContent?.trim() || `Table ${index+1}`;
  const rows=section=>Array.from(section?.rows||[]).filter(visible).map(row=>Array.from(row.cells).filter(visible).map(cell=>({text:cellText(cell),colSpan:cell.colSpan,rowSpan:cell.rowSpan,heading:cell.tagName==='TH'})));
  return { name, head:rows(table.tHead), body:Array.from(table.tBodies).flatMap(rows), foot:rows(table.tFoot) };
}
export function captureVisibleTables(scope) {
  return Array.from(scope?.querySelectorAll('table')||[]).filter(table=>visible(table)&&!table.querySelector('input:not([type="checkbox"]),select,textarea,[contenteditable="true"]')).map(tableSnapshot);
}
export function TableViewer({ tables, onClose }) {
  const [index,setIndex]=useState(0),table=tables[index];
  const renderRows=rows=>rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>{const Cell=cell.heading?'th':'td';return <Cell key={j} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>{cell.text}</Cell>;})}</tr>);
  return <WorkspaceDialog title="Expanded table view" className="expanded-table-dialog" onClose={onClose}>
    {!table?<p className="text-muted">No visible read-only table is available on this page. Open a register, stock view or generated report first.</p>:<><div className="expanded-table-toolbar"><label>Table <select className="form-select" value={index} onChange={e=>setIndex(Number(e.target.value))}>{tables.map((t,i)=><option key={i} value={i}>{t.name} ({t.body.length} rows)</option>)}</select></label><span>{table.body.length} visible rows · Read-only snapshot</span></div><p className="text-muted small">Shows the rows currently displayed, not all pages of a paginated report. Close to edit, sort or change filters.</p><div className="table-responsive expanded-table-scroll"><table className="table mb-0"><thead>{renderRows(table.head)}</thead><tbody>{renderRows(table.body)}</tbody>{table.foot.length>0&&<tfoot>{renderRows(table.foot)}</tfoot>}</table></div></>}
  </WorkspaceDialog>;
}
