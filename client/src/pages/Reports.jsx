import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

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

function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 8)}01`;

  const [catalog, setCatalog] = useState([]);
  const [reportKey, setReportKey] = useState("sales-register");
  const [report, setReport] = useState(null);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    fromDate: firstOfMonth,
    toDate: today,
    customerId: "",
    supplierId: "",
    itemId: "",
    categoryId: "",
    status: "",
    days: "90",
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSetup() {
      try {
        const [catalogResponse, itemsResponse, customersResponse, suppliersResponse, categoriesResponse] =
          await Promise.all([
            api.get("/reports"),
            api.get("/items"),
            api.get("/customers"),
            api.get("/suppliers"),
            api.get("/categories"),
          ]);

        setCatalog(catalogResponse.data.reports || []);
        setItems(itemsResponse.data.items || []);
        setCustomers(customersResponse.data.customers || []);
        setSuppliers(suppliersResponse.data.suppliers || []);
        setCategories(categoriesResponse.data.categories || []);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Unable to load Reports setup.");
      }
    }

    loadSetup();
  }, []);

  const selectedDefinition = useMemo(
    () => catalog.find((item) => item.key === reportKey),
    [catalog, reportKey],
  );

  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const item of catalog) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [catalog]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function paramsForReport() {
    const params = {};
    const activeFilters = selectedDefinition?.filters || [];

    if (activeFilters.includes("date")) {
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
    }
    if (activeFilters.includes("customer") && filters.customerId) {
      params.customerId = filters.customerId;
    }
    if (activeFilters.includes("supplier") && filters.supplierId) {
      params.supplierId = filters.supplierId;
    }
    if (activeFilters.includes("item") && filters.itemId) {
      params.itemId = filters.itemId;
    }
    if (activeFilters.includes("category") && filters.categoryId) {
      params.categoryId = filters.categoryId;
    }
    if (
      (activeFilters.includes("status") || activeFilters.includes("productionStatus")) &&
      filters.status
    ) {
      params.status = filters.status;
    }
    if (activeFilters.includes("days") && filters.days) {
      params.days = filters.days;
    }

    return params;
  }

  async function generateReport() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/reports/${reportKey}`, {
        params: paramsForReport(),
      });
      setReport(response.data.report);
    } catch (err) {
      console.error(err);
      setReport(null);
      setError(err.response?.data?.message || "Unable to generate report.");
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    try {
      setExporting(true);
      setError("");
      const response = await api.get(`/reports/${reportKey}/excel`, {
        params: paramsForReport(),
        responseType: "blob",
      });

      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = match?.[1] || `${reportKey}.xlsx`;
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Unable to export the report to Excel.");
    } finally {
      setExporting(false);
    }
  }

  function openPrintView() {
    const params = new URLSearchParams({ reportKey, ...paramsForReport() });
    window.open(`/reports/print?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const activeFilters = selectedDefinition?.filters || [];
  const isProductionReport = activeFilters.includes("productionStatus");

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Reports</h2>
          <p className="text-muted mb-0">
            Business reports with printable PDF views and real Excel workbook export.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        <div className="col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">Report Library</h6>

              {Object.entries(groupedCatalog).map(([group, reports]) => (
                <div key={group} className="mb-3">
                  <div className="text-uppercase text-muted small fw-semibold mb-2">
                    {group}
                  </div>

                  <div className="d-grid gap-1">
                    {reports.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`btn text-start ${
                          item.key === reportKey ? "btn-success" : "btn-outline-secondary"
                        }`}
                        onClick={() => {
                          setReportKey(item.key);
                          setReport(null);
                          setError("");
                          setFilters((current) => ({ ...current, status: "" }));
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-xl-9">
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                <div>
                  <h5 className="mb-1">{selectedDefinition?.title || "Select Report"}</h5>
                  <div className="text-muted small">Choose filters and generate the report.</div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generateReport}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : "Generate Report"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={exportExcel}
                    disabled={!report || exporting}
                  >
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    onClick={openPrintView}
                    disabled={!report}
                  >
                    Print / Save PDF
                  </button>
                </div>
              </div>

              <div className="row g-3">
                {activeFilters.includes("date") && (
                  <>
                    <div className="col-md-3">
                      <label className="form-label">From Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={filters.fromDate}
                        onChange={(event) => updateFilter("fromDate", event.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">To Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={filters.toDate}
                        onChange={(event) => updateFilter("toDate", event.target.value)}
                      />
                    </div>
                  </>
                )}

                {activeFilters.includes("customer") && (
                  <div className="col-md-4">
                    <label className="form-label">Customer</label>
                    <select
                      className="form-select"
                      value={filters.customerId}
                      onChange={(event) => updateFilter("customerId", event.target.value)}
                    >
                      <option value="">All Customers</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.code} - {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeFilters.includes("supplier") && (
                  <div className="col-md-4">
                    <label className="form-label">Supplier</label>
                    <select
                      className="form-select"
                      value={filters.supplierId}
                      onChange={(event) => updateFilter("supplierId", event.target.value)}
                    >
                      <option value="">All Suppliers</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.code} - {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeFilters.includes("item") && (
                  <div className="col-md-4">
                    <label className="form-label">Item / Product</label>
                    <select
                      className="form-select"
                      value={filters.itemId}
                      onChange={(event) => updateFilter("itemId", event.target.value)}
                    >
                      <option value="">All Items</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeFilters.includes("category") && (
                  <div className="col-md-4">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={filters.categoryId}
                      onChange={(event) => updateFilter("categoryId", event.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.code} - {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(activeFilters.includes("status") || isProductionReport) && (
                  <div className="col-md-3">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={filters.status}
                      onChange={(event) => updateFilter("status", event.target.value)}
                    >
                      <option value="">All Statuses</option>
                      {isProductionReport ? (
                        <>
                          <option value="DRAFT">Draft</option>
                          <option value="IN_PRODUCTION">In Production</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CLOSED">Closed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </>
                      ) : (
                        <>
                          <option value="POSTED">Posted</option>
                          <option value="CANCELLED">Cancelled</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                {activeFilters.includes("days") && (
                  <div className="col-md-3">
                    <label className="form-label">Expiry Horizon</label>
                    <select
                      className="form-select"
                      value={filters.days}
                      onChange={(event) => updateFilter("days", event.target.value)}
                    >
                      <option value="30">30 Days</option>
                      <option value="60">60 Days</option>
                      <option value="90">90 Days</option>
                      <option value="180">180 Days</option>
                      <option value="365">1 Year</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {report && (
            <>
              {report.summary?.length > 0 && (
                <div className="row g-3 mb-4">
                  {report.summary.map((item) => (
                    <div className="col-md-6 col-xl-3" key={item.label}>
                      <div className="border rounded p-3 h-100 bg-white">
                        <div className="text-muted small">{item.label}</div>
                        <div className="fw-bold fs-5">
                          {formatValue(item.value, item.format)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <div className="card-body">
                  <div className="mb-3">
                    <h5 className="mb-1">{report.title}</h5>
                    <div className="text-muted small">{report.description}</div>
                  </div>

                  {report.notes?.map((note) => (
                    <div className="alert alert-warning py-2" key={note}>
                      {note}
                    </div>
                  ))}

                  <div className="table-responsive">
                    <table className="table table-bordered table-hover align-middle table-sm">
                      <thead className="table-light">
                        <tr>
                          {report.columns.map((column) => (
                            <th key={column.key}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((row, rowIndex) => (
                          <tr key={row.id ?? rowIndex}>
                            {report.columns.map((column) => (
                              <td
                                key={column.key}
                                className={
                                  ["currency", "quantity", "percent", "integer"].includes(
                                    column.format,
                                  )
                                    ? "text-end"
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
                            <td
                              colSpan={report.columns.length}
                              className="text-center text-muted py-4"
                            >
                              No records found for the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
