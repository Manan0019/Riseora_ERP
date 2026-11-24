const numericFormats = new Set(["currency", "quantity", "percent", "integer"]);
export function isReportNumber(format) { return numericFormats.has(format); }
export function formatReportValue(value, format) {
  if (value === null || value === undefined || value === "") return "—";
  if (isReportNumber(format)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (format === "currency") return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);
    if (format === "quantity") return n.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    if (format === "percent") return `${n.toFixed(2)}%`;
    return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  if (format === "date" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [y, m, d] = value.split("-"); return `${d}/${m}/${y}`;
  }
  return String(value);
}
export function reportColumnWeights(report) {
  return report.columns.map(column => {
    const sample = report.rows.reduce((max, row) => Math.max(max, formatReportValue(row[column.key], column.format).length), 0);
    const label = String(column.label || "").length;
    if (isReportNumber(column.format)) return Math.min(24, Math.max(9, label * .7, sample + 2));
    if (column.format === "date") return Math.max(12, Math.min(22, sample + 2));
    if (/^(unit|unit_code)$/.test(column.key)) return 6;
    if (/name|description|notes|address|particular/i.test(column.key)) return Math.min(40, Math.max(19, label + 2, sample * .8));
    return Math.min(25, Math.max(10, label + 2, sample + 2));
  });
}
export function reportCellClass(column, value) {
  return [isReportNumber(column.format) ? "text-number" : "", /^(unit|unit_code)$/.test(column.key) ? "text-unit" : "", column.key === "shortage" && Number(value) > 0 ? "text-alert" : ""].filter(Boolean).join(" ");
}

// A single default page format for the entire report, including fragmented tables.
export function reportPaper(columnCount) {
  if (columnCount > 10) return { pageSize: "A3", landscape: true };
  return { pageSize: "A4", landscape: columnCount > 7 };
}
export function reportPageCss(columnCount) {
  const { pageSize, landscape } = reportPaper(columnCount);
  return `@page {
    size: ${pageSize} ${landscape ? "landscape" : "portrait"} !important;
    margin: 13mm 10mm 13mm !important;
    @top-left { content: 'RISEORA ERP  |  BUSINESS REPORTS'; font: 8pt Arial; color: #455e50; }
    @bottom-left { content: 'Riseora ERP'; font: 8pt Arial; color: #455e50; }
    @bottom-right { content: 'Page ' counter(page) ' of ' counter(pages); font: 8pt Arial; color: #455e50; }
  }`;
}
