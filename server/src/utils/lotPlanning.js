// A read-only FEFO/FIFO suggestion; never changes the stock or costing ledger.
export function planRecordedLots(movements, requested, date, method='FEFO') {
  const epsilon=1e-8;
  if(!Number.isFinite(requested)||requested<=0)throw new Error('Required quantity must be greater than zero.');
  if(!['FEFO','FIFO'].includes(method))throw new Error('Unknown allocation method.');
  const lots=new Map(), issues=new Set();
  const sorted=[...movements].sort((a,b)=>a.id-b.id);
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  if(!validDate(date))throw new Error('Invalid planning date.');
  for(const row of sorted){
    const incoming=Number(row.quantity_in),outgoing=Number(row.quantity_out),lot=String(row.lot_no??'').trim();
    if(!Number.isFinite(incoming)||!Number.isFinite(outgoing)||incoming<0||outgoing<0){issues.add('Invalid stock quantity.');continue;}
    if(!incoming&&!outgoing)continue;
    if(!lot){issues.add('Some historical movements have no lot number.');continue;}
    if(!validDate(row.transaction_date)){issues.add('Some movements have an invalid date.');continue;}
    if(row.transaction_date>date){issues.add('Future-dated stock movements exist.');continue;}
    const entry=lots.get(lot)||{lot,quantity:0,firstReceipt:null,expiry:null,missingExpiry:false};
    if(incoming>0){
      if(entry.firstReceipt===null||row.transaction_date<entry.firstReceipt)entry.firstReceipt=row.transaction_date;
      if(!validDate(row.expiry_date))entry.missingExpiry=true;
      else if(entry.expiry&&entry.expiry!==row.expiry_date)issues.add(`Conflicting expiry dates for lot ${lot}.`);
      else entry.expiry=row.expiry_date;
    }
    if(outgoing>0&&validDate(row.expiry_date)&&entry.expiry&&row.expiry_date!==entry.expiry)issues.add(`Conflicting expiry dates for lot ${lot}.`);
    entry.quantity+=incoming-outgoing;
    if(entry.quantity < -epsilon)issues.add(`Negative historical lot balance for ${lot}.`);
    lots.set(lot,entry);
  }
  const available=[...lots.values()].filter(x=>x.quantity>epsilon);
  const excluded=available.filter(x=>x.expiry&&x.expiry<date||x.missingExpiry||!x.expiry);
  const eligible=available.filter(x=>!excluded.includes(x)).sort((a,b)=>method==='FEFO'?a.expiry.localeCompare(b.expiry)||a.firstReceipt.localeCompare(b.firstReceipt)||a.lot.localeCompare(b.lot):a.firstReceipt.localeCompare(b.firstReceipt)||a.lot.localeCompare(b.lot));
  if(issues.size)return {verified:false,issues:[...issues],allocations:[],excluded,shortage:requested};
  let remaining=requested;
  const allocations=[];
  for(const l of eligible){const quantity=Math.min(l.quantity,remaining);if(quantity>epsilon){allocations.push({...l,allocated:quantity});remaining-=quantity;}if(remaining<=epsilon)break;}
  return {verified:true,issues:[],allocations,excluded,shortage:Math.max(0,remaining)};
}
