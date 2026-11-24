import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { encodeBarcode, labelPages } from '../utils/barcodeLabels';
import './BarcodePrint.css';

function Label({ item, barcode, encoded }) {
  return <div className="barcode-label"><strong>{item.name}</strong><span className="barcode-item-code">{item.code}</span><svg role="img" aria-label={`Code 128 barcode ${barcode}`} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${encoded.modules} 56`} style={{width:`${encoded.widthMm}mm`,height:'14mm'}} preserveAspectRatio="none" shapeRendering="crispEdges"><rect width={encoded.modules} height="56" fill="white"/>{encoded.bars.map(bar=><rect key={bar.x} x={bar.x} y="0" width={bar.width} height="56" fill="black"/>)}</svg><span className="barcode-human">{barcode}</span></div>;
}
export default function BarcodePrint() {
  const [params]=useSearchParams();
  const itemId=params.get('item'),aliasId=params.get('alias'),count=Number(params.get('count')||1);
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController(); setData(null);setError('');
    if(!/^\d+$/.test(itemId||'')||!/^\d+$/.test(aliasId||'')){setError('Invalid barcode selection.');return;}
    Promise.all([api.get('/items',{params:{includeInactive:true},signal:controller.signal}),api.get(`/manage/barcodes/${itemId}`,{signal:controller.signal})]).then(([items,aliases])=>{
      if(controller.signal.aborted)return;
      const item=items.data.items?.find(i=>String(i.id)===itemId),alias=aliases.data.rows?.find(a=>String(a.id)===aliasId);
      if(!item||!alias)throw new Error('The selected item or barcode no longer exists.');
      const encoded=encodeBarcode(alias.barcode);setData({item,barcode:alias.barcode,encoded,pages:labelPages(count,encoded.wide)});
    }).catch(e=>{if(!controller.signal.aborted)setError(e.response?.data?.message||e.message||'Unable to load barcode labels.');});
    return()=>controller.abort();
  },[itemId,aliasId,count]);
  useEffect(()=>{const previous=document.title;document.title='Riseora ERP - Barcode Labels';return()=>{document.title=previous;};},[]);
  return <main className="barcode-print-page">
    <style media="print">{`@page {size:A4 portrait; margin:10mm;}`}</style>
    <div className="barcode-print-actions"><h1>Barcode labels</h1><div className="d-flex gap-2"><button type="button" className="btn btn-primary" disabled={!data} onClick={()=>window.print()}>Print / Save PDF</button><button type="button" className="btn btn-outline-secondary" onClick={()=>window.close()}>Close</button></div><p>Code 128 · A4 sheet · Print at 100% / actual size, with browser headers and footers disabled. Test a scan before printing in bulk. Intended for ordinary A4 paper, not pre-cut label templates.</p></div>
    {error?<p className="alert alert-danger">{error}</p>:!data?<p className="p-3">Loading labels…</p>:data.pages.map((n,page)=><section key={page} className={`barcode-sheet ${data.encoded.wide?'barcode-wide':''}`} aria-label={`Label sheet ${page+1}`}>{Array.from({length:n},(_,i)=><Label key={i} {...data}/>)}</section>)}
  </main>;
}
