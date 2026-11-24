import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import riseoraLogo from "../assets/riseora-logo-Horizontal.png";

import "./ReportPrint.css";
import { formatReportValue as formatValue, reportColumnWeights, reportCellClass, reportPaper, reportPageCss } from "../utils/reportPresentation";

function ReportPrint() {
  const [searchParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const reportKey = searchParams.get("reportKey") || "";
  const requestParams = useMemo(() => {
    const result = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "reportKey" && value) result[key] = value;
    }
    return result;
  }, [searchParams]);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        setError("");
        const response = await api.get(`/reports/${reportKey}`, { params: requestParams });
        setReport(response.data.report);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Unable to load printable report.");
      } finally {
        setLoading(false);
      }
    }

    if (reportKey) loadReport();
    else { setError("Report not found."); setLoading(false); }
  }, [reportKey, requestParams]);

  useEffect(() => {
    if (!report) return;
    const previous = document.title;
    document.title = `Riseora ERP - ${report.title}`;
    return () => { document.title = previous; };
  }, [report]);

  async function savePdf() {
    if (!window.riseoraReports?.savePdf) return window.print();
    try {
      setSaving(true);
      setSaveMessage("");
      await document.fonts?.ready;
      await Promise.all(Array.from(document.querySelectorAll(".report-sheet img"), image => image.decode().catch(() => {})));
      const result = await window.riseoraReports.savePdf(report.title, reportPaper(report.columns.length));
      if (result.success) setSaveMessage("PDF saved successfully.");
      else if (!result.canceled) setSaveMessage(result.message || "Unable to save PDF.");
    } catch (err) { setSaveMessage(err.message || "Unable to save PDF."); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="p-4">Loading report...</div>;
  }

  if (error || !report) {
    return <div className="alert alert-danger m-4">{error || "Report not found."}</div>;
  }

  const company = report.company || {};
  const landscape = report.columns.length > 7;
  const weights = reportColumnWeights(report);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const filterText = report.filterSummary || "All applicable records";
  return (
    <div className={`report-print-page ${landscape ? "is-landscape" : ""} ${report.columns.length > 10 ? "is-wide" : ""}`}>
      {/* This page rule exists only while the report route is mounted. It overrides the invoice default. */}
      <style media="print">{reportPageCss(report.columns.length)}</style>
      <div className="report-actions">
        <button type="button" className="btn btn-dark" disabled={saving} onClick={savePdf}>
          {saving ? "Saving PDF..." : window.riseoraReports?.savePdf ? "Save PDF" : "Print / Save PDF"}
        </button>
        {window.riseoraReports?.savePdf && <button type="button" className="btn btn-outline-secondary" onClick={() => window.print()}>Print</button>}
        <button type="button" className="btn btn-outline-secondary" onClick={() => window.close()}>Close</button>
        <span className="report-help">{report.columns.length > 10 ? "A3 landscape" : landscape ? "A4 landscape" : "A4 portrait"}</span>
        {saveMessage && <span className="report-help" role="status">{saveMessage}</span>}
        {!window.riseoraReports?.savePdf && <span className="report-help">For browser PDF export, disable browser headers and footers in the print dialog.</span>}
      </div>

      <div className="report-sheet">
        <div className="report-header">
          <div className="report-heading">
            <img className="report-logo" src={riseoraLogo} alt="Riseora" />
            <h1 className="report-title">{report.title}</h1>
            <div className="report-description">{report.description}</div>
          </div>

          <div className="company-meta">
            <strong>{company.legal_name || company.name || "Riseora"}</strong>
            {company.address && <div>{company.address}</div>}
            <div>
              {[company.city, company.state, company.pincode].filter(Boolean).join(", ")}
            </div>
            {company.gstin && <div>GSTIN: {company.gstin}</div>}
            {company.phone && <div>Phone: {company.phone}</div>}
            {company.email && <div>{company.email}</div>}
          </div>
        </div>

        <div className="report-meta">
          <div><strong>Filters:</strong> {filterText} · {report.rows.length.toLocaleString("en-IN")} records</div>
          <div>Generated: {new Date(report.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</div>
        </div>

        {report.summary?.length > 0 && (
          <div className="summary-grid">
            {report.summary.map((item) => (
              <div className="summary-box" key={item.label}>
                <div className="summary-label">{item.label}</div>
                <div className="summary-value">{formatValue(item.value, item.format)}</div>
              </div>
            ))}
          </div>
        )}

        {report.notes?.map((note) => (
          <div className="report-note" key={note}>{note}</div>
        ))}

        <table className="report-table">
          <colgroup>{report.columns.map((column, index) => <col key={column.key} style={{ width: `${weights[index] / totalWeight * 100}%` }} />)}</colgroup>
          <thead>
            <tr>
              {report.columns.map((column) => <th key={column.key} scope="col" className={reportCellClass(column)}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, rowIndex) => (
              <tr key={`${row.id ?? "row"}-${rowIndex}`}>
                {report.columns.map((column) => (
                  <td
                    key={column.key}
                    className={reportCellClass(column, row[column.key])}
                  >
                    {formatValue(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}

            {report.rows.length === 0 && (
              <tr>
                <td colSpan={report.columns.length} className="report-empty">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="report-screen-footer">
          <span>Riseora ERP • {report.title}</span>
        </div>
      </div>
    </div>
  );
}

export default ReportPrint;
