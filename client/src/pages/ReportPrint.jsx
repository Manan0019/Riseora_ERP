import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import riseoraLogo from "../assets/riseora-logo-Horizontal.png";

function formatValue(value, format) {
  if (format === "currency") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }
  if (format === "quantity") return Number(value || 0).toFixed(3);
  if (format === "percent") return `${Number(value || 0).toFixed(2)}%`;
  if (format === "integer") return Number(value || 0).toFixed(0);
  if (format === "date" && value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
  }
  return value ?? "-";
}

function ReportPrint() {
  const [searchParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
  }, [reportKey, requestParams]);

  const filterText = useMemo(() => {
    const parts = [];
    if (requestParams.fromDate) parts.push(`From: ${requestParams.fromDate}`);
    if (requestParams.toDate) parts.push(`To: ${requestParams.toDate}`);
    if (requestParams.days) parts.push(`Horizon: ${requestParams.days} days`);
    return parts.join("   •   ");
  }, [requestParams]);

  if (loading) {
    return <div className="p-4">Loading report...</div>;
  }

  if (error || !report) {
    return <div className="alert alert-danger m-4">{error || "Report not found."}</div>;
  }

  const company = report.company || {};
  const landscape = report.columns.length > 7;

  return (
    <div className="report-print-page">
      <style>{`
        @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm; }
        body { background: #eef2ef !important; }
        .report-print-page { color: #17211c; font-family: Arial, Helvetica, sans-serif; }
        .report-sheet { max-width: ${landscape ? "1450px" : "950px"}; margin: 24px auto; background: white; padding: 28px; box-shadow: 0 6px 24px rgba(0,0,0,.08); }
        .report-header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #174b37; padding-bottom: 14px; margin-bottom: 16px; }
        .report-logo { max-width: 190px; max-height: 62px; object-fit: contain; }
        .company-meta { text-align: right; font-size: 12px; line-height: 1.45; }
        .report-title { font-size: 22px; font-weight: 700; color: #174b37; margin: 0; }
        .report-description { color: #5d6963; font-size: 12px; margin-top: 4px; }
        .report-meta { font-size: 11px; color: #56635c; margin: 10px 0 14px; }
        .summary-grid { display: grid; grid-template-columns: repeat(${Math.min(4, Math.max(1, report.summary?.length || 1))}, 1fr); gap: 10px; margin-bottom: 16px; }
        .summary-box { border: 1px solid #d8e0dc; border-radius: 5px; padding: 9px; }
        .summary-label { color: #68746e; font-size: 10px; text-transform: uppercase; }
        .summary-value { font-weight: 700; margin-top: 3px; }
        .report-table { width: 100%; border-collapse: collapse; font-size: ${landscape ? "9px" : "10px"}; }
        .report-table th { background: #174b37; color: white; text-align: left; padding: 7px 6px; border: 1px solid #174b37; }
        .report-table td { padding: 6px; border: 1px solid #d9e1dd; vertical-align: top; }
        .report-table tr:nth-child(even) td { background: #f8faf9; }
        .text-number { text-align: right; white-space: nowrap; }
        .report-note { font-size: 10px; padding: 8px 10px; margin: 8px 0; border-left: 3px solid #b88729; background: #fff8e8; }
        .report-footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #dce3df; font-size: 9px; color: #6c7771; display: flex; justify-content: space-between; }
        .report-actions { max-width: ${landscape ? "1450px" : "950px"}; margin: 20px auto 0; display: flex; gap: 8px; }
        @media print {
          body { background: white !important; }
          .report-actions { display: none !important; }
          .report-sheet { margin: 0; max-width: none; padding: 0; box-shadow: none; }
          .report-table thead { display: table-header-group; }
          .report-table tr { break-inside: avoid; }
        }
      `}</style>

      <div className="report-actions">
        <button type="button" className="btn btn-dark" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => window.close()}>
          Close
        </button>
      </div>

      <div className="report-sheet">
        <div className="report-header">
          <div>
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
          {filterText && <div>{filterText}</div>}
          <div>Generated: {new Date(report.generatedAt).toLocaleString("en-IN")}</div>
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
          <thead>
            <tr>
              {report.columns.map((column) => <th key={column.key}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex}>
                {report.columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      ["currency", "quantity", "percent", "integer"].includes(column.format)
                        ? "text-number"
                        : ""
                    }
                  >
                    {formatValue(row[column.key], column.format)}
                  </td>
                ))}
              </tr>
            ))}

            {report.rows.length === 0 && (
              <tr>
                <td colSpan={report.columns.length} style={{ textAlign: "center", padding: "20px" }}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="report-footer">
          <span>Riseora ERP • {report.title}</span>
          <span>Generated {new Date(report.generatedAt).toLocaleDateString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}

export default ReportPrint;
