const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

const NUMERIC = new Set(["currency", "quantity", "percent", "integer"]);
const FORMATS = { text: 0, currency: 164, quantity: 165, percent: 166, integer: 1, date: 167 };
const formatKeys = Object.keys(FORMATS);
// Style indexes: title, company, metadata, headers, summary label; then data and summary variants.
const dataStyle = (format, stripe = false, alert = false) => 6 + Math.max(0, formatKeys.indexOf(format)) * 3 + (alert ? 2 : stripe ? 1 : 0);
const summaryStyle = format => 24 + Math.max(0, formatKeys.indexOf(format));
function dateSerial(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-03-01") return null;
  return date.getTime() / 86400000 + 25569;
}
function makeCell(ref, value, format = "text", style = 0) {
  const present = value !== null && value !== undefined && value !== "";
  if (present && NUMERIC.has(format) && Number.isFinite(Number(value))) return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  const serial = format === "date" && present ? dateSerial(value) : null;
  if (serial !== null && serial !== false) return `<c r="${ref}" s="${style}"><v>${serial}</v></c>`;
  // Always inline strings for text: leading zeros and literal formula-like values survive.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value ?? "")}</t></is></c>`;
}
function displayText(value, format) {
  if (value === null || value === undefined || value === "") return "";
  if (NUMERIC.has(format) && Number.isFinite(Number(value))) {
    const n = Number(value);
    if (format === "currency") return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (format === "quantity") return n.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    if (format === "percent") return `${n.toFixed(2)}%`;
    return n.toFixed(0);
  }
  return String(value);
}
function rowHeight(text, width, min = 19) {
  const lines = String(text || "").split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / Math.max(1, width - 3))), 0);
  return Math.min(409, Math.max(min, lines * 15 + 5));
}
function xf(numFmtId, fontId, fillId, borderId, align = "left") {
  return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`;
}
function safeFileName(value) {
  return String(value || "report")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "report";
}

function filterLabel(filters = {}) {
  const parts = [];
  if (filters.fromDate) parts.push(`From ${filters.fromDate}`);
  if (filters.toDate) parts.push(`To ${filters.toDate}`);
  if (filters.days) parts.push(`Horizon ${filters.days} days`);
  return parts.join(" | ") || "All applicable records";
}

export function createReportXlsx(report, filters = {}) {
  const columnCount = Math.max(2, report.columns.length);
  const lastCol = columnName(columnCount - 1);
  const companyName = report.company?.legal_name || report.company?.name || "Riseora";
  const sheetName = String(report.title || "Report").replace(/[\[\]:*?\/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Report";
  const widths = report.columns.map(column => {
    const longest = report.rows.reduce((max, row) => Math.max(max, ...displayText(row[column.key], column.format).split(/\r?\n/).map(t => t.length)), 0);
    const label = String(column.label || "").length;
    return Math.min(48, Math.max(column.format === "currency" ? 19 : column.format === "date" ? 14 : NUMERIC.has(column.format) ? 13 : 11, label + 4, longest + 4));
  });
  while (widths.length < columnCount) widths.push(18);
  const fullWidth = widths.reduce((a,b) => a+b, 0);
  const merges = [];
  const rowXml = [];
  let next = 1;
  const addRow = (r, height, cells) => rowXml.push(`<row r="${r}" ht="${height}" customHeight="1">${cells}</row>`);
  const fullRow = (text, style, height) => {
    const r = next++;
    merges.push(`A${r}:${lastCol}${r}`);
    addRow(r, height || rowHeight(text, fullWidth), makeCell(`A${r}`, text, "text", style));
  };
  fullRow(report.title, 1, 32);
  fullRow(companyName, 2, 23);
  if (report.description) fullRow(report.description, 3);
  const company = report.company || {};
  const contact = [company.address, [company.city, company.state, company.pincode].filter(Boolean).join(", "), company.gstin && `GSTIN: ${company.gstin}`, company.phone && `Phone: ${company.phone}`, company.email].filter(Boolean).join(" | ");
  if (contact) fullRow(contact, 3);
  fullRow(`Filters: ${report.filterSummary || filterLabel(filters)} | ${report.rows.length} records`, 3);
  const stamp = new Date(report.generatedAt);
  fullRow(`Generated: ${stamp.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, 3);
  if (report.summary?.length) {
    const half = Math.floor(columnCount / 2);
    for (const metric of report.summary) {
      const r = next++;
      const leftEnd = columnName(half - 1);
      const rightStart = columnName(half);
      if (half > 1) merges.push(`A${r}:${leftEnd}${r}`);
      if (columnCount - half > 1) merges.push(`${rightStart}${r}:${lastCol}${r}`);
      addRow(r, Math.max(24, rowHeight(metric.label, widths.slice(0, half).reduce((a,b)=>a+b,0))), makeCell(`A${r}`, metric.label, "text", 5) + makeCell(`${rightStart}${r}`, metric.value, metric.format, summaryStyle(metric.format)));
    }
  }
  for (const note of report.notes || []) fullRow(`Note: ${note}`, 3);
  next++; // small separation before the data table
  const tableStart = next++;
  const dataStart = next;
  addRow(tableStart, Math.max(25, ...report.columns.map((c,i)=>rowHeight(c.label,widths[i],25))), report.columns.map((column, index) => makeCell(`${columnName(index)}${tableStart}`, column.label, "text", 4)).join(""));
  report.rows.forEach((row, rowIndex) => {
    const r = next++;
    const cells = report.columns.map((column, i) => makeCell(`${columnName(i)}${r}`, row[column.key], column.format, dataStyle(column.format, rowIndex % 2 === 1, column.key === "shortage" && Number(row[column.key]) > 0))).join("");
    addRow(r, Math.max(19, ...report.columns.map((column,i)=>rowHeight(displayText(row[column.key],column.format),widths[i]))), cells);
  });
  if (!report.rows.length) fullRow("No records found.", 3, 24);
  const dataEnd = next - 1;
  const tableLastCol = columnName(Math.max(0, report.columns.length - 1));
  const colsXml = widths.map((width,index)=>`<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastCol}${dataEnd}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${tableStart}" topLeftCell="A${dataStart}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${dataStart}" sqref="A${dataStart}"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="19"/>
  <cols>${colsXml}</cols><sheetData>${rowXml.join("")}</sheetData>
  ${report.rows.length ? `<autoFilter ref="A${tableStart}:${tableLastCol}${dataEnd}"/>` : ""}
  <mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
  <printOptions horizontalCentered="1" gridLines="0"/>
  <pageMargins left="0.35" right="0.35" top="0.55" bottom="0.55" header="0.2" footer="0.2"/>
  <pageSetup paperSize="${report.columns.length > 10 ? 8 : 9}" orientation="${report.columns.length > 7 ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
  <headerFooter><oddHeader>&amp;LRiseora ERP&amp;R${xmlEscape(sheetName.replace(/&/g,"&&"))}</oddHeader><oddFooter>&amp;LBusiness report&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>
</worksheet>`;
  const styles = [xf(0,0,0,0),xf(0,1,2,0),xf(0,2,0,0),xf(0,0,0,0),xf(0,3,2,1),xf(0,2,3,1)];
  for (const key of formatKeys) for (let variant=0;variant<3;variant++) styles.push(xf(FORMATS[key],variant===2?4:0,variant===2?4:variant===1?3:0,1,NUMERIC.has(key)?"right":key==="date"?"center":"left"));
  for (const key of formatKeys) styles.push(xf(FORMATS[key],2,3,1,NUMERIC.has(key)?"right":"left"));
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="4"><numFmt numFmtId="164" formatCode='"₹"#,##0.00;[Red]-"₹"#,##0.00'/><numFmt numFmtId="165" formatCode="#,##0.000"/><numFmt numFmtId="166" formatCode='0.00"%"'/><numFmt numFmtId="167" formatCode="dd/mm/yyyy"/></numFmts>
  <fonts count="5"><font><sz val="11"/><color rgb="FF24352B"/><name val="Calibri"/></font><font><b/><sz val="19"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF174B37"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF8B321F"/><name val="Calibri"/></font></fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${["FF174B37","FFF0F5F1","FFFFEFE8"].map(rgb=>`<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${["left","right","top","bottom"].map(side=>`<${side} style="thin"><color rgb="FFD1DCD4"/></${side}>`).join("")}<diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const sheetRef = `'${sheetName.replace(/'/g,"''")}'`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
  <definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">${xmlEscape(`${sheetRef}!$A$1:$${lastCol}$${dataEnd}`)}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">${xmlEscape(`${sheetRef}!$${tableStart}:$${tableStart}`)}</definedName></definedNames>
</workbook>`;

  const entries = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    },
    { name: "xl/workbook.xml", data: workbookXml },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", data: stylesXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    {
      name: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(report.title)}</dc:title><dc:creator>Riseora ERP</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
    },
    {
      name: "docProps/app.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Riseora ERP</Application></Properties>`,
    },
  ];

  return {
    buffer: zipStore(entries),
    fileName: `${safeFileName(report.title)}_${new Intl.DateTimeFormat("en-CA", {year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Kolkata"}).format(stamp)}.xlsx`,
  };
}
