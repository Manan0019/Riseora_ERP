import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportXlsx } from '../server/src/services/reportExcelService.js';
import { formatReportValue, reportColumnWeights, reportCellClass, reportPaper, reportPageCss } from '../client/src/utils/reportPresentation.js';

// The existing writer stores uncompressed ZIP entries, allowing dependency-free inspection.
function unzipStored(buffer) {
  const entries = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0);
    const size = buffer.readUInt32LE(offset + 18);
    const length = buffer.readUInt16LE(offset + 26);
    const extra = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + length + extra;
    entries.set(buffer.toString('utf8', offset + 30, offset + 30 + length), buffer.toString('utf8', start, start + size));
    offset = start + size;
  }
  return entries;
}
const sample = {
  title: 'Report / test', generatedAt: '2026-11-24T11:31:15Z', company: { name: 'A & B' }, description: 'Test',
  filterSummary: 'Category: Raw material',
  columns: [{key:'code',label:'Code',format:'text'}, {key:'date',label:'Date',format:'date'}, {key:'amount',label:'Amount',format:'currency'}, {key:'shortage',label:'Shortage',format:'quantity'}, {key:'percent',label:'Margin',format:'percent'}],
  rows: [{code:'=1+1',date:'2026-11-24',amount:1234.5,shortage:1.25,percent:25}, {code:'001',date:null,amount:null,shortage:0,percent:0}],
  summary:[{label:'Records',value:2,format:'integer'}], notes:['Read only']
};
test('XLSX preserves types, literal text, zeros and missing cells', () => {
  const entries = unzipStored(createReportXlsx(sample).buffer);
  const sheet = entries.get('xl/worksheets/sheet1.xml');
  assert.match(sheet, /<t xml:space="preserve">=1\+1<\/t>/);
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.match(sheet, /<t xml:space="preserve">001<\/t>/);
  assert.match(sheet, /<v>1234\.5<\/v>/);
  assert.match(sheet, /<v>1\.25<\/v>/);
  assert.match(sheet, /<v>25<\/v>/);
  assert.match(sheet, /<v>0<\/v>/);
  assert.match(sheet, /<v>46350<\/v>/); // Excel date serial for 2026-11-24
  assert.match(sheet, /<t xml:space="preserve"><\/t>/);
  assert.match(sheet, /A &amp; B/);
});
test('XLSX has valid filter/merge order, frozen headers, summary and print settings', () => {
  const entries = unzipStored(createReportXlsx(sample).buffer);
  const sheet = entries.get('xl/worksheets/sheet1.xml');
  assert.ok(sheet.indexOf('<autoFilter') < sheet.indexOf('<mergeCells'));
  assert.ok(sheet.indexOf('Records</t>') < sheet.indexOf('Code</t>'));
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /fitToWidth="1" fitToHeight="0"/);
  assert.match(sheet, /Category: Raw material/);
  assert.match(entries.get('xl/workbook.xml'), /_xlnm\.Print_Titles/);
  assert.match(entries.get('xl/workbook.xml'), /_xlnm\.Print_Area/);
});
test('empty and wide report exports remain valid and choose appropriate paper', () => {
  const empty = unzipStored(createReportXlsx({...sample, rows:[]}).buffer).get('xl/worksheets/sheet1.xml');
  assert.match(empty,/No records found/); assert.doesNotMatch(empty, /<autoFilter/);
  const wide = unzipStored(createReportXlsx({...sample, columns:Array.from({length:13},(_,i)=>({key:`col${i}`,label:`Column ${i}`,format:'text'})),rows:[]}).buffer).get('xl/worksheets/sheet1.xml');
  assert.match(wide,/paperSize="8" orientation="landscape"/);
});
test('PDF report presentation handles nulls, amounts, dates and shortage highlighting', () => {
  assert.equal(formatReportValue(null,'currency'),'—');
  assert.equal(formatReportValue(0,'quantity'),'0.000');
  assert.equal(formatReportValue(123456.5,'currency'),'₹1,23,456.50');
  assert.equal(formatReportValue('2026-11-24','date'),'24/11/2026');
  assert.match(reportCellClass(sample.columns[3], 1),/text-alert/);
  assert.doesNotMatch(reportCellClass(sample.columns[3], 0),/text-alert/);
  assert.ok(reportColumnWeights(sample).every(n=>n>0));
});

test('one default page size covers every report continuation page', () => {
  assert.deepEqual(reportPaper(7), {pageSize:'A4',landscape:false});
  assert.deepEqual(reportPaper(8), {pageSize:'A4',landscape:true});
  assert.deepEqual(reportPaper(11), {pageSize:'A3',landscape:true});
  assert.match(reportPageCss(8), /@page \{\s*size: A4 landscape !important/);
  assert.match(reportPageCss(11), /size: A3 landscape !important/);
  assert.match(reportPageCss(8), /counter\(page\).*counter\(pages\)/);
});
