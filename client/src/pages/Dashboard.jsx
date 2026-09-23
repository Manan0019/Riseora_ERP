import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../api/api";

function Dashboard() {
  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await api.get(
            "/dashboard/summary"
          );

        setSummary(
          response.data.summary
        );
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    };

  if (loading) {
    return (
      <div>
        Loading dashboard...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="alert alert-danger">
        {error ||
          "Dashboard data unavailable."}
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">
            Dashboard
          </h2>

          <p className="text-muted mb-0">
            Riseora ERP overview
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={
            loadDashboard
          }
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Total Sales
              </div>

              <div className="fs-5 fw-bold">
                ₹
                {Number(
                  summary.totalSales ||
                    0
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Total Purchases
              </div>

              <div className="fs-5 fw-bold">
                ₹
                {Number(
                  summary.totalPurchases ||
                    0
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Customer Outstanding
              </div>

              <div className="fs-5 fw-bold">
                ₹
                {Number(
                  summary.customerOutstanding ||
                    0
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Supplier Outstanding
              </div>

              <div className="fs-5 fw-bold">
                ₹
                {Number(
                  summary.supplierOutstanding ||
                    0
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Active Stock Items
              </div>

              <div className="fs-5 fw-bold">
                {
                  summary.stockItemCount
                }
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Low Stock
              </div>

              <div className="fs-5 fw-bold">
                {
                  summary.lowStockCount
                }
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                WIP Batches
              </div>

              <div className="fs-5 fw-bold">
                {Number(
                  summary.wipBatchCount ||
                    0
                )}
              </div>

              <small className="text-muted">
                ₹{Number(
                  summary.wipMaterialValue ||
                    0
                ).toFixed(2)} material
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-xl-2">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">
                Draft Production
              </div>

              <div className="fs-5 fw-bold">
                {Number(
                  summary.draftProductionCount ||
                    0
                )}
              </div>

              <small className="text-muted">
                Awaiting material issue
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  Low Stock Items
                </h5>

                <Link
                  to="/stock"
                  className="btn btn-sm btn-outline-primary"
                >
                  View Stock
                </Link>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Stock</th>
                      <th>Reorder Level</th>
                      <th>Unit</th>
                    </tr>
                  </thead>

                  <tbody>
                    {summary.lowStockItems.map(
                      (item) => (
                        <tr
                          key={
                            item.id
                          }
                        >
                          <td>
                            {
                              item.code
                            }
                          </td>

                          <td>
                            {
                              item.name
                            }
                          </td>

                          <td>
                            {Number(
                              item.current_stock ||
                                0
                            ).toFixed(
                              3
                            )}
                          </td>

                          <td>
                            {Number(
                              item.reorder_level ||
                                0
                            ).toFixed(
                              3
                            )}
                          </td>

                          <td>
                            {
                              item.unit_code
                            }
                          </td>
                        </tr>
                      )
                    )}

                    {summary.lowStockItems.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center text-muted"
                        >
                          No low-stock items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  Recent Production
                </h5>

                <Link
                  to="/production-register"
                  className="btn btn-sm btn-outline-primary"
                >
                  View All
                </Link>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Batch</th>
                      <th>Product</th>
                      <th>Qty</th>
                    </tr>
                  </thead>

                  <tbody>
                    {summary.recentProduction.map(
                      (batch) => (
                        <tr
                          key={
                            batch.id
                          }
                        >
                          <td>
                            <div>
                              {
                                batch.batch_no
                              }
                            </div>

                            <small className="text-muted">
                              {
                                batch.production_date
                              }
                            </small>
                          </td>

                          <td>
                            {
                              batch.finished_item_name
                            }
                          </td>

                          <td>
                            {Number(
                              batch.actual_output_qty ||
                                0
                            ).toFixed(
                              3
                            )}{" "}
                            {
                              batch.unit_code
                            }
                          </td>
                        </tr>
                      )
                    )}

                    {summary.recentProduction.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center text-muted"
                        >
                          No production batches yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;