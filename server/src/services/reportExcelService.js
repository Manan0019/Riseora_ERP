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
  return String(value ?? "")
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

function numericStyle(format, bold = false) {
  if (bold) {
    if (format === "currency") return 9;
    if (format === "quantity") return 10;
    if (format === "percent") return 11;
    return 8;
  }
  if (format === "currency") return 4;
  if (format === "quantity") return 5;
  if (format === "percent") return 6;
  if (format === "integer") return 7;
  return 0;
}

function makeCell(ref, value, format = "text", styleOverride = null) {
  const style = styleOverride ?? numericStyle(format);
  const numeric = ["currency", "quantity", "percent", "integer"].includes(format)
    && Number.isFinite(Number(value));

  if (numeric) {
    return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  }

  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value ?? "")}</t></is></c>`;
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
  const columnCount = Math.max(1, report.columns.length);
  const lastCol = columnName(columnCount - 1);
  const companyName = report.company?.legal_name || report.company?.name || "Riseora";
  const tableStart = 7;
  const dataStart = tableStart + 1;
  const dataEnd = Math.max(dataStart, dataStart + report.rows.length - 1);
  const rowXml = [];

  rowXml.push(`<row r="1" ht="26"><c r="A1" s="1" t="inlineStr"><is><t>${xmlEscape(report.title)}</t></is></c></row>`);
  rowXml.push(`<row r="2"><c r="A2" s="2" t="inlineStr"><is><t>${xmlEscape(companyName)}</t></is></c></row>`);
  rowXml.push(`<row r="3"><c r="A3" t="inlineStr"><is><t>${xmlEscape(filterLabel(filters))}</t></is></c></row>`);
  rowXml.push(`<row r="4"><c r="A4" t="inlineStr"><is><t>${xmlEscape(`Generated ${new Date(report.generatedAt).toLocaleString("en-IN")}`)}</t></is></c></row>`);

  const headerCells = report.columns.map((column, index) =>
    makeCell(`${columnName(index)}${tableStart}`, column.label, "text", 3),
  ).join("");
  rowXml.push(`<row r="${tableStart}" ht="22">${headerCells}</row>`);

  report.rows.forEach((row, rowIndex) => {
    const excelRow = dataStart + rowIndex;
    const cells = report.columns.map((column, colIndex) =>
      makeCell(
        `${columnName(colIndex)}${excelRow}`,
        row[column.key],
        column.format,
        ["text", "date"].includes(column.format) ? 12 : null,
      ),
    ).join("");
    rowXml.push(`<row r="${excelRow}">${cells}</row>`);
  });

  let summaryRow = dataStart + report.rows.length + 2;
  if (report.summary?.length) {
    rowXml.push(`<row r="${summaryRow}"><c r="A${summaryRow}" s="8" t="inlineStr"><is><t>SUMMARY</t></is></c></row>`);
    summaryRow += 1;
    for (const summary of report.summary) {
      rowXml.push(`<row r="${summaryRow}">${makeCell(`A${summaryRow}`, summary.label, "text", 8)}${makeCell(`B${summaryRow}`, summary.value, summary.format, numericStyle(summary.format, true))}</row>`);
      summaryRow += 1;
    }
  }

  const widths = report.columns.map((column) => {
    const labelLength = String(column.label || "").length;
    const maxData = report.rows.slice(0, 200).reduce(
      (max, row) => Math.max(max, String(row[column.key] ?? "").length),
      0,
    );
    return Math.min(40, Math.max(10, Math.max(labelLength, maxData) + 2));
  });
  const colsXml = widths.map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
  ).join("");

  const merges = [
    `A1:${lastCol}1`,
    `A2:${lastCol}2`,
    `A3:${lastCol}3`,
    `A4:${lastCol}4`,
  ];

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${Math.max(summaryRow, dataEnd)}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="${tableStart}" topLeftCell="A${dataStart}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowXml.join("")}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
  ${report.rows.length ? `<autoFilter ref="A${tableStart}:${lastCol}${dataEnd}"/>` : ""}
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode='₹#,##0.00;[Red]-₹#,##0.00'/>
    <numFmt numFmtId="165" formatCode='0.000'/>
    <numFmt numFmtId="166" formatCode='0.00"%"'/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FF174B37"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF174B37"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9E2DC"/></left><right style="thin"><color rgb="FFD9E2DC"/></right><top style="thin"><color rgb="FFD9E2DC"/></top><bottom style="thin"><color rgb="FFD9E2DC"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="13">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(report.title.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
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
    fileName: `${safeFileName(report.title)}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
