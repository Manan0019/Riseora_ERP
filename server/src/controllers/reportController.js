import { getReport, reportCatalog } from "../services/reportService.js";
import { createReportXlsx } from "../services/reportExcelService.js";

export function listReports(req, res) {
  return res.json({ success: true, reports: reportCatalog });
}

export function reportData(req, res) {
  try {
    const report = getReport(req.params.reportKey, req.query);
    return res.json({ success: true, report });
  } catch (error) {
    console.error("Report error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to generate report.",
    });
  }
}

export function reportExcel(req, res) {
  try {
    const report = getReport(req.params.reportKey, req.query);
    const result = createReportXlsx(report, req.query);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader("Content-Length", result.buffer.length);
    return res.end(result.buffer);
  } catch (error) {
    console.error("Report Excel error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to export report to Excel.",
    });
  }
}
