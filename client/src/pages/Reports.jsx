import { useLocation } from "react-router-dom";
import SortableTh, { useSortableRows } from "../components/SortableTh";
import { readPreference, writePreference } from "../utils/proPreferences";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import SearchableSelect from "../components/SearchableSelect";
import SmartDateInput from "../components/SmartDateInput";

import AppIcon from "../components/AppIcon";
import { formatReportValue as formatValue, reportCellClass } from "../utils/reportPresentation";
import { reportDateRange, reportRequestKey, filterReportRows, pageReportRows } from "../utils/reportWorkspace";

function Reports() {
  const { fromDate: firstOfMonth, toDate: today } = reportDateRange("month");

  const [catalog, setCatalog] = useState([]);
  const { search: routeSearch } = useLocation();
  const [reportKey, setReportKey] = useState(() => new URLSearchParams(routeSearch).get("report") || "sales-register");
  const [result, setResult] = useState(null);
  const [libraryQuery,setLibraryQuery]=useState("");
  const [rowQuery,setRowQuery]=useState("");
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(()=>readPreference("reportPageSize",50));
  const [setupLoading,setSetupLoading]=useState(true);
  const [exportNotice,setExportNotice]=useState("");
  const request=useRef(null);
  const report=result?.key===reportKey?result.report:null;
  useEffect(() => { const key=new URLSearchParams(routeSearch).get("report"); if(key) {request.current?.abort();setLoading(false);setReportKey(key);setResult(null);setRowQuery("");setPage(1);setError("");setExportNotice("");} },[routeSearch]);
  useEffect(()=>()=>request.current?.abort(),[]);
  const [hiddenByReport,setHiddenByReport] = useState(() => readPreference("reportColumns", {}));
  const shownColumns=useMemo(()=>{const all=report?.columns||[];const visible=all.filter(c=>!(hiddenByReport[reportKey]||[]).includes(c.key));return visible.length?visible:all;},[report,hiddenByReport,reportKey]);
  const {sortedRows,sort,toggle} = useSortableRows(report?.rows||[], "", "asc", reportKey);
  const matchingRows=useMemo(()=>filterReportRows(sortedRows,shownColumns,rowQuery,formatValue),[sortedRows,shownColumns,rowQuery]);
  const visiblePage=pageReportRows(matchingRows,page,pageSize);
  function toggleColumn(key) { setPage(1);setHiddenByReport(prev=>{ const existing=prev[reportKey]||[]; const next={...prev,[reportKey]:existing.includes(key)?existing.filter(x=>x!==key):[...existing,key]};writePreference("reportColumns",next);return next;}); }

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
    days: "90"
  });
  const [presetNotice,setPresetNotice]=useState("");
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
        api.get("/categories")]
        );

        setCatalog(catalogResponse.data.reports || []);
        setItems(itemsResponse.data.items || []);
        setCustomers(customersResponse.data.customers || []);
        setSuppliers(suppliersResponse.data.suppliers || []);
        setCategories(categoriesResponse.data.categories || []);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Unable to load Reports setup.");
      } finally { setSetupLoading(false); }
    }

    loadSetup();
  }, []);

  const selectedDefinition = useMemo(
    () => catalog.find((item) => item.key === reportKey),
    [catalog, reportKey]
  );

  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const item of catalog) {
      if (!`${item.title} ${item.group}`.toLowerCase().includes(libraryQuery.trim().toLowerCase())) continue;
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [catalog,libraryQuery]);

  function saveFilterPreset() { writePreference(`reportFilters:${reportKey}`,filters); setPresetNotice("Saved filters for this report on this PC."); }
  function restoreFilterPreset() { const saved=readPreference(`reportFilters:${reportKey}`,null); if(saved){setFilters(prev=>({...prev,...saved}));setPresetNotice("Saved filters loaded. Generate the report to refresh results.");}else setPresetNotice("No saved filters for this report."); }
  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setExportNotice("");
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
    filters.status)
    {
      params.status = filters.status;
    }
    if (activeFilters.includes("days") && filters.days) {
      params.days = filters.days;
    }

    return params;
  }

  const currentRequestKey=reportRequestKey(reportKey,paramsForReport());
  const isStale=Boolean(report && result.signature!==currentRequestKey);
  const invalidRange=Boolean(selectedDefinition?.filters?.includes("date") && filters.fromDate && filters.toDate && filters.fromDate>filters.toDate);
  const canExport=Boolean(report && !isStale && !invalidRange && !loading && !exporting);
  function selectReport(key) {
    request.current?.abort(); setLoading(false); setReportKey(key); setResult(null); setError(""); setPresetNotice(""); setExportNotice(""); setRowQuery(""); setPage(1); setFilters(current=>({...current,status:""}));
  }
  function resetFilters() {
    setFilters({...reportDateRange("month"),customerId:"",supplierId:"",itemId:"",categoryId:"",status:"",days:"90"});
    setPresetNotice(""); setExportNotice("");
  }
  async function generateReport() {
    if(!selectedDefinition || invalidRange || loading) return;
    request.current?.abort();
    const controller=new AbortController(); request.current=controller;
    const params=paramsForReport(), signature=reportRequestKey(reportKey,params);
    try {
      setLoading(true); setError(""); setExportNotice("");
      const response = await api.get(`/reports/${reportKey}`, {params,signal:controller.signal});
      if(!controller.signal.aborted) {setResult({key:reportKey,signature,params,report:response.data.report});setPage(1);setRowQuery("");}
    } catch (err) {
      if(!controller.signal.aborted){console.error(err);setResult(null);setError(err.response?.data?.message || "Unable to generate report.");}
    } finally { if(request.current===controller&&!controller.signal.aborted)setLoading(false); }
  }

  async function exportExcel() {
    if(!canExport)return;
    try {
      setExporting(true);
      setError("");
      const response = await api.get(`/reports/${reportKey}/excel`, {
        params: result.params,
        responseType: "blob"
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
      setTimeout(()=>window.URL.revokeObjectURL(url),1000);
      setExportNotice("Excel download requested. Check your Downloads folder.");
    } catch (err) {
      console.error(err);
      setError("Unable to export the report to Excel.");
    } finally {
      setExporting(false);
    }
  }

  function openPrintView() {
    if(!canExport)return;
    const params = new URLSearchParams({ reportKey, ...result.params });
    window.open(`/reports/print?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const activeFilters = selectedDefinition?.filters || [];
  const isProductionReport = activeFilters.includes("productionStatus");

  return (
    <div className="report-workspace">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Reports</h2>
          <p className="text-muted mb-0">
            Business reports with printable PDF views and real Excel workbook export.
          </p>
        </div>
      </div>

      {error && <div role="alert" className="alert alert-danger">{error}</div>}

      <div className="report-workspace-grid">
        <aside className="report-library">
          <div className="card">
            <div className="card-body">
              <h6 className="mb-2">Report Library <span className="report-count">{catalog.length}</span></h6>
              <div className="report-search-input mb-3"><AppIcon name="search"/><input className="form-control" aria-label="Find a report" placeholder="Find a report…" value={libraryQuery} onChange={e=>setLibraryQuery(e.target.value)}/>{libraryQuery&&<button type="button" aria-label="Clear report search" onClick={()=>setLibraryQuery("")}>×</button>}</div>
              {setupLoading&&<p role="status" className="small">Loading report library…</p>}
              {!setupLoading&&!Object.keys(groupedCatalog).length&&<p className="small">No matching reports.</p>}

              {Object.entries(groupedCatalog).map(([group, reports]) =>
              <div key={group} className="mb-3">
                  <div className="text-uppercase text-muted small fw-semibold mb-2">
                    {group}
                  </div>

                  <div className="d-grid gap-1">
                    {reports.map((item) =>
                  <button
                    key={item.key}
                    type="button"
                    className={`btn text-start ${
                    item.key === reportKey ? "btn-success" : "btn-outline-secondary"}`
                    }
                    aria-pressed={item.key===reportKey}
                    disabled={exporting}
                    onClick={()=>selectReport(item.key)}>
                        {item.title}
                      </button>
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="report-workspace-main">
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                <div>
                  <h5 className="mb-1">{selectedDefinition?.title || "Select Report"}</h5>
                  <div className="text-muted small">Choose filters and generate the report.</div>
                  <div className="d-flex flex-wrap gap-2 mt-2"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={saveFilterPreset}>Save filters</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={restoreFilterPreset}>Load saved filters</button></div><small role="status">{presetNotice}</small>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generateReport}
                    disabled={loading || exporting || !selectedDefinition || invalidRange}>
                    
                    {loading ? "Generating..." : "Generate Report"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={exportExcel}
                    disabled={!canExport}>
                    
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    onClick={openPrintView}
                    disabled={!canExport}>
                    
                    Preview / PDF
                  </button>
                </div>
              </div>

              {activeFilters.includes("date")&&<div className="report-quick-dates" aria-label="Date presets">{[["today","Today"],["month","This month"],["lastMonth","Last month"],["last30","Last 30 days"],["all","All dates"]].map(([key,label])=><button key={key} type="button" className="btn btn-sm btn-outline-secondary" onClick={()=>setFilters(f=>({...f,...reportDateRange(key)}))}>{label}</button>)}</div>}
              <div className="row g-3">
                {activeFilters.includes("date") &&
                <>
                    <div className="col-md-3">
                      <label className="form-label">From Date</label>
                      <SmartDateInput

                      className="form-control"
                      aria-label="Report from date"
                      value={filters.fromDate}
                      onChange={(event) => updateFilter("fromDate", event.target.value)} />
                    
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">To Date</label>
                      <SmartDateInput

                      className="form-control"
                      aria-label="Report to date"
                      value={filters.toDate}
                      onChange={(event) => updateFilter("toDate", event.target.value)} />
                    
                    </div>
                  </>
                }

                {activeFilters.includes("customer") &&
                <div className="col-md-4">
                    <label className="form-label">Customer</label>
                    <SearchableSelect
                    value={filters.customerId}
                    onChange={(value) => updateFilter("customerId", value)}
                    options={customers}
                    placeholder="All Customers / search..."
                    ariaLabel="Report customer filter"
                    getOptionLabel={(customer) => `${customer.code} - ${customer.name}`}
                    getOptionMeta={(customer) =>
                    [customer.city, customer.state].filter(Boolean).join(", ")
                    }
                    getOptionSearchText={(customer) =>
                    `${customer.phone || ""} ${customer.alternate_phone || ""}`
                    } />
                  
                  </div>
                }

                {activeFilters.includes("supplier") &&
                <div className="col-md-4">
                    <label className="form-label">Supplier</label>
                    <SearchableSelect
                    value={filters.supplierId}
                    onChange={(value) => updateFilter("supplierId", value)}
                    options={suppliers}
                    placeholder="All Suppliers / search..."
                    ariaLabel="Report supplier filter"
                    getOptionLabel={(supplier) => `${supplier.code} - ${supplier.name}`}
                    getOptionMeta={(supplier) =>
                    [supplier.city, supplier.state].filter(Boolean).join(", ")
                    }
                    getOptionSearchText={(supplier) =>
                    `${supplier.phone || ""} ${supplier.alternate_phone || ""}`
                    } />
                  
                  </div>
                }

                {activeFilters.includes("item") &&
                <div className="col-md-4">
                    <label className="form-label">Item / Product</label>
                    <SearchableSelect
                    value={filters.itemId}
                    onChange={(value) => updateFilter("itemId", value)}
                    options={items}
                    placeholder="All Items / search..."
                    ariaLabel="Report item filter"
                    getOptionLabel={(item) => `${item.code} - ${item.name}`}
                    getOptionMeta={(item) =>
                    [item.category_name, item.unit_code].filter(Boolean).join(" · ")
                    }
                    getOptionSearchText={(item) => `${item.hsn_code || ""}`} />
                  
                  </div>
                }

                {activeFilters.includes("category") &&
                <div className="col-md-4">
                    <label className="form-label">Category</label>
                    <select
                    className="form-select"
                    aria-label="Category"
                    value={filters.categoryId}
                    onChange={(event) => updateFilter("categoryId", event.target.value)}>
                    
                      <option value="">All Categories</option>
                      {categories.map((category) =>
                    <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                    )}
                    </select>
                  </div>
                }

                {(activeFilters.includes("status") || isProductionReport) &&
                <div className="col-md-3">
                    <label className="form-label">Status</label>
                    <select
                    className="form-select"
                    aria-label="Status"
                    value={filters.status}
                    onChange={(event) => updateFilter("status", event.target.value)}>
                    
                      <option value="">All Statuses</option>
                      {isProductionReport ?
                    <>
                          <option value="DRAFT">Draft</option>
                          <option value="IN_PRODUCTION">In Production</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CLOSED">Closed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </> :

                    <>
                          <option value="POSTED">Posted</option>
                          <option value="CANCELLED">Cancelled</option>
                        </>
                    }
                    </select>
                  </div>
                }

                {activeFilters.includes("days") &&
                <div className="col-md-3">
                    <label className="form-label">Expiry Horizon</label>
                    <select
                    className="form-select"
                    aria-label="Expiry horizon"
                    value={filters.days}
                    onChange={(event) => updateFilter("days", event.target.value)}>
                    
                      <option value="30">30 Days</option>
                      <option value="60">60 Days</option>
                      <option value="90">90 Days</option>
                      <option value="180">180 Days</option>
                      <option value="365">1 Year</option>
                    </select>
                  </div>
                }
              </div>
              <div className="report-filter-footer"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>Reset filters</button>{invalidRange&&<span role="alert" className="text-danger">From date must not be after To date.</span>}{isStale&&<span role="status" className="report-stale"><AppIcon name="warning" size={16}/> Filters changed. Generate again before exporting.</span>}{exportNotice&&<span role="status">{exportNotice}</span>}</div>
            </div>
          </div>
          {loading&&<div role="status" className="report-state"><span className="spinner-border spinner-border-sm"/> Generating report…</div>}
          {!report&&!loading&&!error&&<div className="report-state report-state-empty"><AppIcon name="reports" size={30}/><strong>Ready to generate a report</strong><span>Select a report, adjust filters and choose Generate Report.</span></div>}

          {report &&
          <>
              {report.summary?.length > 0 &&
            <div className="row g-3 mb-4">
                  {report.summary.map((item) =>
              <div className="col-md-6 col-xl-3" key={item.label}>
                      <div className="report-summary-card h-100">
                        <div className="text-muted small">{item.label}</div>
                        <div className="fw-bold fs-5">
                          {formatValue(item.value, item.format)}
                        </div>
                      </div>
                    </div>
              )}
                </div>
            }

              <div className="card" aria-busy={loading}>
                <div className="card-body">
                  <div className="mb-3">
                    <h5 className="mb-1">{report.title}</h5>
                    <div className="text-muted small">{report.description}</div><div className="small mt-1">{report.filterSummary || "All applicable records"} · {report.rows.length.toLocaleString("en-IN")} records</div>
                  </div>

                  {report.notes?.map((note) =>
                <div className="alert alert-warning py-2" key={note}>
                      {note}
                    </div>
                )}

                  <div className="report-results-toolbar"><div className="report-search-input"><AppIcon name="search"/><input className="form-control" aria-label="Search report rows" placeholder="Search within results…" value={rowQuery} onChange={e=>{setRowQuery(e.target.value);setPage(1);}}/>{rowQuery&&<button type="button" aria-label="Clear result search" onClick={()=>{setRowQuery("");setPage(1);}}>×</button>}</div><label className="report-page-size">Rows per page <select className="form-select form-select-sm" value={pageSize} onChange={e=>{const size=Number(e.target.value);setPageSize(size);writePreference("reportPageSize",size);setPage(1);}}>{[25,50,100,250].map(n=><option key={n}>{n}</option>)}</select></label></div>
                  <p className="report-export-note">PDF and Excel include all records for the generated filters, not just the on-screen search, page, sort or visible columns. Exports fetch the latest data.</p>
                  <details className="pro-columns mb-2"><summary>Visible columns (screen only)</summary><button className="btn btn-sm btn-outline-secondary m-2" type="button" onClick={()=>setHiddenByReport(prev=>{const next={...prev,[reportKey]:[]};writePreference("reportColumns",next);return next;})}>Show all columns</button><div className="d-flex flex-wrap gap-3 p-2">{report.columns.map(c=><label key={c.key}><input type="checkbox" className="form-check-input me-1" checked={shownColumns.some(x=>x.key===c.key)} disabled={shownColumns.length===1&&shownColumns[0].key===c.key} onChange={()=>toggleColumn(c.key)}/>{c.label}</label>)}</div></details>
                  <div className="table-responsive">
                    <table className="table table-bordered table-hover align-middle table-sm">
                      <thead className="table-light">
                        <tr>
                          {shownColumns.map((column) =>
                        <SortableTh key={`${reportKey}:${column.key}`} field={`${reportKey}:${column.key}`} sort={{...sort,key:sort.key?`${reportKey}:${sort.key}`:""}} onSort={()=>{toggle(column.key);setPage(1);}}>{column.label}</SortableTh>
                        )}
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePage.rows.map((row, rowIndex) =>
                      <tr key={`${row.id ?? "row"}-${rowIndex}`}>
                            {shownColumns.map((column) =>
                        <td
                          key={column.key}
                          className={reportCellClass(column,row[column.key])}>
                                {formatValue(row[column.key], column.format)}
                              </td>
                        )}
                          </tr>
                      )}

                        {matchingRows.length === 0 &&
                      <tr>
                            <td
                          colSpan={shownColumns.length}
                          className="text-center text-muted py-4">
                          
                              {rowQuery ? "No matching records in this report." : "No records found for the selected filters."}
                            </td>
                          </tr>
                      }
                      </tbody>
                    </table>
                  </div>
                  <div className="report-pagination"><span role="status">{visiblePage.first}–{visiblePage.last} of {matchingRows.length.toLocaleString("en-IN")} records{rowQuery?` (${report.rows.length} total)`:""}</span><div><button type="button" className="btn btn-sm btn-outline-secondary" disabled={visiblePage.page<=1} onClick={()=>setPage(visiblePage.page-1)}>Previous</button><span>Page {visiblePage.page} of {visiblePage.pages}</span><button type="button" className="btn btn-sm btn-outline-secondary" disabled={visiblePage.page>=visiblePage.pages} onClick={()=>setPage(visiblePage.page+1)}>Next</button></div></div>
                </div>
              </div>
            </>
          }
        </section>
      </div>
    </div>);

}

export default Reports;
