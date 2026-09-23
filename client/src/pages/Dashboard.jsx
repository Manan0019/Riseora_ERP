import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import AppIcon from "../components/AppIcon";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function SummaryCard({ label, value, detail, icon, tone = "primary" }) {
  return (
    <div className="dashboard-metric card h-100">
      <div className="card-body">
        <div className={`metric-icon tone-${tone}`}>
          <AppIcon name={icon} size={20} />
        </div>
        <div className="metric-copy">
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
          {detail && <div className="metric-detail">{detail}</div>}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/dashboard/summary");
      setSummary(response.data.summary);
    } catch (err) {
      console.error(err);
      setError("Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton skeleton-heading" />
        <div className="row g-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="col-md-6 col-xl-4" key={item}>
              <div className="skeleton skeleton-card" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return <div className="alert alert-danger">{error || "Dashboard data unavailable."}</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="page-hero">
        <div>
          <div className="page-eyebrow">BUSINESS OVERVIEW</div>
          <h2 className="mb-1">Dashboard</h2>
          <p className="text-muted mb-0">Live operational position across Riseora.</p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={loadDashboard}>
          <AppIcon name="refresh" size={16} />
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-4">
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Net Sales" value={money(summary.totalSales)} detail="Posted sales after returns" icon="sales" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Purchases" value={money(summary.totalPurchases)} detail="Posted purchase value" icon="purchase" tone="gold" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Customer Outstanding" value={money(summary.customerOutstanding)} detail="Current receivables" icon="customers" tone="blue" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Supplier Outstanding" value={money(summary.supplierOutstanding)} detail="Current payables" icon="suppliers" tone="amber" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Active Stock Items" value={Number(summary.stockItemCount || 0)} detail="Inventory masters in use" icon="stock" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Low Stock" value={Number(summary.lowStockCount || 0)} detail="At or below reorder level" icon="alert" tone="red" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="WIP Batches" value={Number(summary.wipBatchCount || 0)} detail={`${money(summary.wipMaterialValue)} material in process`} icon="production" tone="purple" />
        </div>
        <div className="col-md-6 col-xl-3">
          <SummaryCard label="Draft Production" value={Number(summary.draftProductionCount || 0)} detail="Awaiting material issue" icon="formula" tone="slate" />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="card dashboard-panel h-100">
            <div className="card-header dashboard-panel-header">
              <div>
                <div className="dashboard-panel-kicker">INVENTORY ATTENTION</div>
                <h5 className="mb-0">Low Stock Items</h5>
              </div>
              <Link to="/stock" className="btn btn-sm btn-outline-primary">View stock <AppIcon name="arrow" size={14} /></Link>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0 dashboard-table">
                  <thead>
                    <tr><th>Code</th><th>Item</th><th>Current</th><th>Reorder</th><th>Unit</th></tr>
                  </thead>
                  <tbody>
                    {summary.lowStockItems.map((item) => (
                      <tr key={item.id}>
                        <td><span className="table-code">{item.code}</span></td>
                        <td className="fw-semibold">{item.name}</td>
                        <td>{Number(item.current_stock || 0).toFixed(3)}</td>
                        <td>{Number(item.reorder_level || 0).toFixed(3)}</td>
                        <td><span className="unit-pill">{item.unit_code}</span></td>
                      </tr>
                    ))}
                    {summary.lowStockItems.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted py-5">No low-stock items. Inventory levels look healthy.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div className="card dashboard-panel h-100">
            <div className="card-header dashboard-panel-header">
              <div>
                <div className="dashboard-panel-kicker">MANUFACTURING</div>
                <h5 className="mb-0">Recent Production</h5>
              </div>
              <Link to="/production-register" className="btn btn-sm btn-outline-primary">View all <AppIcon name="arrow" size={14} /></Link>
            </div>
            <div className="card-body p-0">
              <div className="production-feed">
                {summary.recentProduction.map((batch) => (
                  <div className="production-feed-item" key={batch.id}>
                    <div className="production-feed-icon"><AppIcon name="production" size={18} /></div>
                    <div className="production-feed-copy">
                      <strong>{batch.finished_item_name}</strong>
                      <span>{batch.batch_no} • {batch.production_date}</span>
                    </div>
                    <div className="production-feed-qty">
                      {Number(batch.actual_output_qty || 0).toFixed(3)}
                      <small>{batch.unit_code}</small>
                    </div>
                  </div>
                ))}
                {summary.recentProduction.length === 0 && (
                  <div className="text-center text-muted py-5">No production batches yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
