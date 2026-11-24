import test from 'node:test';
import assert from 'node:assert/strict';
import {reportDateRange,reportRequestKey,filterReportRows,pageReportRows} from '../client/src/utils/reportWorkspace.js';
import {formatReportValue} from '../client/src/utils/reportPresentation.js';
test('date presets handle local dates and January rollover',()=>{
 const now=new Date(2026,0,12,23,59);
 assert.deepEqual(reportDateRange('month',now),{fromDate:'2026-01-01',toDate:'2026-01-12'});
 assert.deepEqual(reportDateRange('lastMonth',now),{fromDate:'2025-12-01',toDate:'2025-12-31'});
 assert.deepEqual(reportDateRange('last30',now),{fromDate:'2025-12-14',toDate:'2026-01-12'});
 assert.deepEqual(reportDateRange('all',now),{fromDate:'',toDate:''});
});
test('report identity changes with report or filters but not key order or ID type',()=>{
 const key=reportRequestKey('low-stock',{categoryId:4,days:'90'});
 assert.equal(key,reportRequestKey('low-stock',{days:90,categoryId:'4',status:''}));
 assert.notEqual(key,reportRequestKey('low-stock',{categoryId:5,days:90}));
 assert.notEqual(key,reportRequestKey('stock',{categoryId:4,days:90}));
});
test('screen-only search supports multiple terms and formatted values without mutating full results',()=>{
 const rows=[{name:'Glycerin USP',unit:'L',amount:1000},{name:'Glycerin soap',unit:'PCS',amount:20}];
 const cols=[{key:'name'},{key:'unit'},{key:'amount',format:'currency'}];
 assert.deepEqual(filterReportRows(rows,cols,'glycerin 1,000',formatReportValue),[rows[0]]);
 assert.deepEqual(filterReportRows(rows,cols,'not found',formatReportValue),[]);
 assert.equal(rows.length,2);
});
test('pagination preserves all 198 records and handles empty or out of range pages',()=>{
 const rows=Array.from({length:198},(_,i)=>({i}));
 const pages=[1,2,3,4].flatMap(p=>pageReportRows(rows,p,50).rows);
 assert.deepEqual(pages,rows);
 assert.equal(pageReportRows(rows,99,50).last,198);
 assert.deepEqual(pageReportRows([],5,50),{page:1,pages:1,first:0,last:0,rows:[]});
});
