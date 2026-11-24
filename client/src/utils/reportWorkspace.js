// Pure report-view helpers. Screen-only search/paging never alter export parameters.
export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function reportDateRange(preset, now = new Date()) {
  const y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  if(preset==='all') return {fromDate:'',toDate:''};
  if(preset==='lastMonth') return {fromDate:localIsoDate(new Date(y,m-1,1)),toDate:localIsoDate(new Date(y,m,0))};
  if(preset==='last30') return {fromDate:localIsoDate(new Date(y,m,d-29)),toDate:localIsoDate(now)};
  if(preset==='today') return {fromDate:localIsoDate(now),toDate:localIsoDate(now)};
  return {fromDate:localIsoDate(new Date(y,m,1)),toDate:localIsoDate(now)};
}
export function reportRequestKey(reportKey, params) {
  return JSON.stringify([reportKey,Object.entries(params).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>[k,String(v)]).sort(([a],[b])=>a.localeCompare(b))]);
}
export function filterReportRows(rows, columns, query, formatValue) {
  const tokens=String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(!tokens.length) return rows;
  return rows.filter(row=>{const text=columns.map(c=>`${row[c.key]??''} ${formatValue(row[c.key],c.format)}`).join(' ').toLowerCase(); return tokens.every(t=>text.includes(t));});
}
export function pageReportRows(rows, requestedPage, size) {
  const limit=[25,50,100,250].includes(Number(size))?Number(size):50;
  const pages=Math.max(1,Math.ceil(rows.length/limit));
  const page=Math.max(1,Math.min(pages,Math.trunc(Number(requestedPage))||1));
  const start=(page-1)*limit;
  return {page,pages,first:rows.length?start+1:0,last:Math.min(start+limit,rows.length),rows:rows.slice(start,start+limit)};
}
