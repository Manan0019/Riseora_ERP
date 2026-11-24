import {useState,useRef} from 'react';
import api from '../api/api';
import MasterEditorModal from './MasterEditorModal';
import {useUi} from '../context/UiContext';
const fields={hsnCode:['HSN','hsn_code'],defaultGstRate:['GST %','default_gst_rate'],reorderLevel:['Reorder level','reorder_level']};
export default function BulkItemEditor({items,onClose,onSaved}){
 const {confirm,success,error}=useUi();
 const [field,setField]=useState('hsnCode');const [value,setValue]=useState('');const [busy,setBusy]=useState(false);const running=useRef(false);
 async function save(){if(running.current)return;const [label,column]=fields[field];if(field!=='hsnCode'&&!value.trim()){error('Enter a value.');return;}
  running.current=true;setBusy(true);
  if(!await confirm({title:`Update ${items.length} items?`,message:`Set ${label} to ${value.trim()||'(blank)'} for the selected items. Existing posted transactions will not be changed.`,confirmLabel:'Update selected items',variant:'warning'})){running.current=false;setBusy(false);return;}
  setBusy(true);try{const response=await api.put('/items/bulk',{field,value,items:items.map(item=>({id:Number(item.id),expected:item[column]??null}))});success(`${response.data.updated} items updated.`);onSaved();}catch(e){error(e.response?.data?.message||'Bulk update failed. Refresh and verify the records.');}finally{running.current=false;setBusy(false);}
 }
 return <MasterEditorModal open title="Bulk edit item defaults" size="lg" onRequestClose={()=>{if(!busy)onClose();}} footer={<><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy||!items.length} onClick={save}>{busy?'Updating…':'Review and update'}</button></>}>
 <p className="text-muted">{items.length} selected active items. Only the chosen field changes; posted invoices and stock transactions are preserved.</p>
 <div className="row g-2 mb-3"><div className="col-sm-6"><label className="form-label" htmlFor="bulk-field">Field</label><select id="bulk-field" className="form-select" disabled={busy} value={field} onChange={e=>{setField(e.target.value);setValue('');}}>{Object.entries(fields).map(([key,[label]])=><option key={key} value={key}>{label}</option>)}</select></div><div className="col-sm-6"><label className="form-label" htmlFor="bulk-value">New value {field==='hsnCode'?'(blank clears HSN)':''}</label><input id="bulk-value" className="form-control" disabled={busy} type={field==='hsnCode'?'text':'number'} min="0" step="any" value={value} onChange={e=>setValue(e.target.value)}/></div></div>
 <div className="table-responsive bulk-preview"><table className="table table-bordered table-sm"><thead><tr><th>Code</th><th>Item</th><th>Current value</th><th>New value</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item[fields[field][1]]??'—'}</td><td>{value||'—'}</td></tr>)}</tbody></table></div></MasterEditorModal>;
}
