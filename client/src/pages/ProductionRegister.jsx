import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";
import { useUi } from "../context/UiContext";

function statusBadge(status) {
  const map = {
    DRAFT: "text-bg-secondary",
    IN_PRODUCTION: "text-bg-warning",
    COMPLETED: "text-bg-success",
    CLOSED: "text-bg-primary",
    CANCELLED: "text-bg-dark",
  };

  const label = status === "IN_PRODUCTION" ? "In Production" : status;
  return <span className={`badge ${map[status] || "text-bg-secondary"}`}>{label}</span>;
}

function qcBadge(status) {
  const map = {
    PASSED: "text-bg-success",
    FAILED: "text-bg-danger",
    NOT_CHECKED: "text-bg-secondary",
  };

  return (
    <span className={`badge ${map[status] || "text-bg-secondary"}`}>
      {status === "NOT_CHECKED" ? "Not Checked" : status || "Not Checked"}
    </span>
  );
}

function ProductionRegister() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [qcStatus, setQcStatus] = useState("NOT_CHECKED");
  const [qcNotes, setQcNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/production");
      setBatches(response.data.batches || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load production register.");
    } finally {
      setLoading(false);
    }
  };

  const loadBatchDetails = async (id) => {
    try {
      setDetailsLoading(true);
      setError("");
      setMessage("");
      const response = await api.get(`/production/${id}`);
      const batch = response.data.batch;
      setSelectedBatch(batch);
      setQcStatus(batch.qc_status || "NOT_CHECKED");
      setQcNotes(batch.qc_notes || "");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load production batch details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const refreshSelected = async () => {
    await loadBatches();
    if (selectedBatch?.id) {
      await loadBatchDetails(selectedBatch.id);
    }
  };

  const filteredBatches = useMemo(() => {
    const text = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const matchesStatus = statusFilter === "ALL" || batch.status === statusFilter;
      if (!matchesStatus) return false;
      if (!text) return true;

      return (
        (batch.batch_no || "").toLowerCase().includes(text) ||
        (batch.finished_item_name || "").toLowerCase().includes(text) ||
        (batch.formula_code || "").toLowerCase().includes(text) ||
        (batch.formula_name || "").toLowerCase().includes(text) ||
        (batch.finished_lot_no || "").toLowerCase().includes(text)
      );
    });
  }, [batches, search, statusFilter]);

  const costSummary = useMemo(() => {
    if (!selectedBatch) {
      return {
        rawCost: 0,
        packagingCost: 0,
        otherMaterialCost: 0,
        materialCost: 0,
        labourCost: 0,
        electricityCost: 0,
        otherOverheadCost: 0,
        totalCost: 0,
        unitCost: 0,
      };
    }

    let rawCost = 0;
    let packagingCost = 0;
    let otherMaterialCost = 0;

    for (const item of selectedBatch.consumption || []) {
      const amount =
        Number(item.total_cost || 0) ||
        Number(item.actual_quantity || 0) * Number(item.unit_cost || 0);

      if ((item.category_role || item.category_code) === "RAW") rawCost += amount;
      else if ((item.category_role || item.category_code) === "PACK") packagingCost += amount;
      else otherMaterialCost += amount;
    }

    const calculatedMaterial = rawCost + packagingCost + otherMaterialCost;
    const storedMaterial = Number(selectedBatch.material_cost || 0);
    const materialCost = storedMaterial > 0 ? storedMaterial : calculatedMaterial;
    const labourCost = Number(selectedBatch.labour_cost || 0);
    const electricityCost = Number(selectedBatch.electricity_cost || 0);
    const otherOverheadCost = Number(selectedBatch.other_overhead_cost || 0);
    const storedTotal = Number(selectedBatch.total_production_cost || 0);
    const totalCost =
      storedTotal > 0
        ? storedTotal
        : materialCost + labourCost + electricityCost + otherOverheadCost;
    const storedUnitCost = Number(selectedBatch.finished_unit_cost || 0);
    const goodQty = Number(
      selectedBatch.good_output_qty || selectedBatch.actual_output_qty || 0,
    );
    const unitCost = storedUnitCost > 0 ? storedUnitCost : goodQty > 0 ? totalCost / goodQty : 0;

    return {
      rawCost,
      packagingCost,
      otherMaterialCost,
      materialCost,
      labourCost,
      electricityCost,
      otherOverheadCost,
      totalCost,
      unitCost,
    };
  }, [selectedBatch]);

  const handleCancel = async () => {
    if (!selectedBatch) return;

    const confirmed = await confirmAction({
      title: "Cancel production batch?",
      message: `${selectedBatch.batch_no} will be cancelled.`,
      detail: "Completed output and material movements are reversed only when inventory safety checks pass. Closed batches cannot be cancelled directly.",
      confirmLabel: "Cancel Batch",
      cancelLabel: "Keep Batch",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");
      await api.patch(`/production/${selectedBatch.id}/cancel`);
      const successMessage = `${selectedBatch.batch_no} cancelled successfully.`;
      setMessage(successMessage);
      toastSuccess(successMessage, "Production cancelled");
      await refreshSelected();
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || "Unable to cancel production batch.";
      setError(errorMessage);
      toastError(errorMessage, "Cancellation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!selectedBatch) return;

    const confirmed = await confirmAction({
      title: "Close production batch?",
      message: `${selectedBatch.batch_no} will be finalized and locked.`,
      detail: "After closing, direct correction and cancellation are intentionally disabled to protect manufacturing history.",
      confirmLabel: "Close Batch",
      cancelLabel: "Keep Open",
      variant: "warning",
    });
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");
      await api.patch(`/production/${selectedBatch.id}/close`);
      const successMessage = `${selectedBatch.batch_no} closed successfully.`;
      setMessage(successMessage);
      toastSuccess(successMessage, "Production closed");
      await refreshSelected();
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || "Unable to close production batch.";
      setError(errorMessage);
      toastError(errorMessage, "Closing failed");
    } finally {
      setActionLoading(false);
    }
  };

  const saveQc = async () => {
    if (!selectedBatch) return;

    try {
      setActionLoading(true);
      setError("");
      await api.patch(`/production/${selectedBatch.id}/qc`, {
        qcStatus,
        qcNotes: qcNotes.trim(),
      });
      setMessage("QC status updated successfully.");
      toastSuccess("The quality-control status and notes were saved.", "QC updated");
      await refreshSelected();
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || "Unable to update QC status.";
      setError(errorMessage);
      toastError(errorMessage, "QC update failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Production Register</h2>
          <p className="text-muted mb-0">
            Review planned, in-production, completed and closed batches with actual
            yield, wastage, costing, QC and audit history.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={loadBatches}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-md-9">
              <input
                type="text"
                className="form-control"
                placeholder="Search batch, product, formula or lot..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_PRODUCTION">In Production</option>
                <option value="COMPLETED">Completed</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Batch</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Formula</th>
                  <th>Planned</th>
                  <th>Good</th>
                  <th>Rejected</th>
                  <th>Rework</th>
                  <th>Scrap</th>
                  <th>Yield %</th>
                  <th>QC</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center text-muted">
                      Loading production batches...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center text-muted">
                      No production batches found.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      onClick={() => loadBatchDetails(batch.id)}
                      style={{ cursor: "pointer" }}
                      className={selectedBatch?.id === batch.id ? "table-primary" : ""}
                    >
                      <td>{batch.batch_no}</td>
                      <td>{batch.production_date}</td>
                      <td>{batch.finished_item_name}</td>
                      <td>
                        {batch.formula_code} V{batch.version_no}
                      </td>
                      <td>
                        {Number(batch.planned_batch_size || 0).toFixed(3)} {batch.batch_unit_code}
                      </td>
                      <td>{Number(batch.good_output_qty || batch.actual_output_qty || 0).toFixed(3)}</td>
                      <td>{Number(batch.rejected_qty || 0).toFixed(3)}</td>
                      <td>{Number(batch.rework_qty || 0).toFixed(3)}</td>
                      <td>{Number(batch.scrap_qty || 0).toFixed(3)}</td>
                      <td>{Number(batch.yield_percent || 0).toFixed(2)}%</td>
                      <td>{qcBadge(batch.qc_status)}</td>
                      <td>{statusBadge(batch.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedBatch && (
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start mb-3 gap-3">
              <div>
                <h5 className="mb-1">{selectedBatch.batch_no}</h5>
                <div className="text-muted">
                  {selectedBatch.finished_item_name} • {selectedBatch.formula_code} V
                  {selectedBatch.version_no}
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 justify-content-end">
                {["DRAFT", "IN_PRODUCTION"].includes(selectedBatch.status) && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/production/${selectedBatch.id}/work`)}
                  >
                    Enter Actuals
                  </button>
                )}

                {selectedBatch.status === "COMPLETED" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-warning"
                      onClick={() =>
                        navigate(`/production/${selectedBatch.id}/work?mode=correct`)
                      }
                    >
                      Correct Batch
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleClose}
                      disabled={actionLoading}
                    >
                      Close Batch
                    </button>
                  </>
                )}

                {selectedBatch.status !== "CANCELLED" && selectedBatch.status !== "CLOSED" && (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleCancel}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {detailsLoading ? (
              <p className="text-muted">Loading batch details...</p>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Status</div>
                      <div>{statusBadge(selectedBatch.status)}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Planned Output</div>
                      <div className="fw-semibold">
                        {Number(selectedBatch.planned_batch_size || 0).toFixed(3)}{" "}
                        {selectedBatch.batch_unit_code}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Good Output</div>
                      <div className="fw-semibold">
                        {Number(
                          selectedBatch.good_output_qty || selectedBatch.actual_output_qty || 0,
                        ).toFixed(3)}{" "}
                        {selectedBatch.batch_unit_code}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Good Yield</div>
                      <div className="fw-semibold">
                        {Number(selectedBatch.yield_percent || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Rejected</div>
                      <div className="fw-semibold">
                        {Number(selectedBatch.rejected_qty || 0).toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Rework</div>
                      <div className="fw-semibold">
                        {Number(selectedBatch.rework_qty || 0).toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Scrap</div>
                      <div className="fw-semibold">
                        {Number(selectedBatch.scrap_qty || 0).toFixed(3)}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Good Output Variance</div>
                      <div className="fw-semibold">
                        {Number(selectedBatch.output_variance_qty || 0).toFixed(3)}{" "}
                        {selectedBatch.batch_unit_code}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedBatch.status === "COMPLETED" && (
                  <div className="border rounded p-3 mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <h6 className="mb-1">Quality Check</h6>
                        <div className="text-muted small">
                          QC is lightweight in V1. Failed QC prevents final batch closure.
                        </div>
                      </div>
                      {qcBadge(selectedBatch.qc_status)}
                    </div>

                    <div className="row g-2 align-items-end">
                      <div className="col-md-3">
                        <label className="form-label">QC Status</label>
                        <select
                          className="form-select"
                          value={qcStatus}
                          onChange={(event) => setQcStatus(event.target.value)}
                        >
                          <option value="NOT_CHECKED">Not Checked</option>
                          <option value="PASSED">Passed</option>
                          <option value="FAILED">Failed</option>
                        </select>
                      </div>
                      <div className="col-md-7">
                        <label className="form-label">QC Notes</label>
                        <input
                          type="text"
                          className="form-control"
                          value={qcNotes}
                          onChange={(event) => setQcNotes(event.target.value)}
                        />
                      </div>
                      <div className="col-md-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary w-100"
                          onClick={saveQc}
                          disabled={actionLoading}
                        >
                          Save QC
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedBatch.status === "IN_PRODUCTION" && (
                  <div className="alert alert-warning mb-4">
                    <strong>Work In Progress:</strong>{" "}
                    planned materials have been issued from usable stock. Current WIP material value is{" "}
                    <strong>₹{Number(selectedBatch.wip_material_cost || 0).toFixed(2)}</strong>.
                    Completing the batch will return unused material, consume any extra material,
                    and transfer the final production cost into good finished stock.
                  </div>
                )}

                {!["DRAFT", "IN_PRODUCTION", "CANCELLED"].includes(selectedBatch.status) && (
                  <div className="mb-4">
                    <h6 className="mb-3">Production Costing</h6>
                    <div className="row g-3">
                      {[
                        ["Raw Material", costSummary.rawCost],
                        ["Packaging", costSummary.packagingCost],
                        ["Direct Labour", costSummary.labourCost],
                        ["Electricity / Utilities", costSummary.electricityCost],
                        ["Other Manufacturing", costSummary.otherOverheadCost],
                        ["Total Production Cost", costSummary.totalCost],
                        ["Finished Unit Cost", costSummary.unitCost],
                      ].map(([label, value]) => (
                        <div className="col-md-3" key={label}>
                          <div className="border rounded p-3 h-100">
                            <div className="text-muted small">{label}</div>
                            <div className="fs-5 fw-semibold">
                              ₹{Number(value || 0).toFixed(2)}
                              {label === "Finished Unit Cost" && (
                                <> / {selectedBatch.batch_unit_code}</>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!['DRAFT', 'IN_PRODUCTION', 'CANCELLED'].includes(selectedBatch.status) && (
                  <div className="mb-4">
                    <h6 className="mb-3">Pricing Review</h6>

                    <div className="alert alert-light border mb-3">
                      Production costing never changes the selling price automatically.
                      The ERP preserves the selling price and target margin that were active
                      when this batch was completed, then calculates a recommendation from
                      the actual finished-unit cost.
                    </div>

                    <div className="row g-3">
                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Default Sale Price Snapshot</div>
                          <div className="fs-5 fw-semibold">
                            ₹{Number(selectedBatch.selling_price_snapshot || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Margin at Snapshot Price</div>
                          <div className="fs-5 fw-semibold">
                            {(() => {
                              const price = Number(selectedBatch.selling_price_snapshot || 0);
                              const cost = Number(selectedBatch.finished_unit_cost || 0);
                              return price > 0
                                ? (((price - cost) / price) * 100).toFixed(2)
                                : "0.00";
                            })()}%
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Target Gross Margin</div>
                          <div className="fs-5 fw-semibold">
                            {Number(
                              selectedBatch.target_margin_percent_snapshot || 0,
                            ).toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Suggested Selling Price</div>
                          <div className="fs-5 fw-semibold">
                            {Number(selectedBatch.suggested_selling_price || 0) > 0
                              ? `₹${Number(selectedBatch.suggested_selling_price).toFixed(2)}`
                              : "Not configured"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <h6>Component Plan vs Actual</h6>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Component</th>
                        <th>Type</th>
                        <th>Planned</th>
                        <th>Issued</th>
                        <th>Actual</th>
                        <th>Returned</th>
                        <th>Extra</th>
                        <th>Waste</th>
                        <th>Variance</th>
                        <th>Variance %</th>
                        <th>Unit</th>
                        <th>Lot</th>
                        <th>Unit Cost</th>
                        <th>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBatch.consumption || []).map((item) => {
                        const planned = Number(item.planned_quantity || 0);
                        const actual = Number(item.actual_quantity || 0);
                        const variance = Number(
                          item.variance_quantity || actual - planned,
                        );
                        const variancePercent =
                          Number(item.variance_percent || 0) ||
                          (planned > 0 ? (variance / planned) * 100 : 0);
                        const amount =
                          Number(item.total_cost || 0) ||
                          actual * Number(item.unit_cost || 0);

                        return (
                          <tr key={item.id}>
                            <td>
                              {item.item_code} - {item.item_name}
                            </td>
                            <td>
                              <div>{item.category_name || item.category_code}</div>
                              {String(item.component_role || "").toUpperCase() === "ACTUAL_EXTRA" ? (
                                <>
                                  <span className="badge text-bg-info mt-1">Actual Extra</span>
                                  {item.extra_reason && (
                                    <small className="formula-cell-hint d-block mt-1">
                                      {item.extra_reason}
                                    </small>
                                  )}
                                </>
                              ) : (
                                Number(item.process_extra_planned_quantity || 0) > 0 && (
                                  <span className="badge formula-extra-badge mt-1">
                                    {Number(item.formula_planned_quantity || 0) > 0
                                      ? "Formula + Allowance"
                                      : "Process Allowance"}
                                  </span>
                                )
                              )}
                            </td>
                            <td>
                              {String(item.component_role || "").toUpperCase() === "ACTUAL_EXTRA" ? (
                                <span className="text-muted">Not planned</span>
                              ) : (
                                <>
                                  <div>{planned.toFixed(3)}</div>
                                  {Number(item.process_extra_planned_quantity || 0) > 0 && (
                                    <>
                                      <small className="text-muted d-block">
                                        Formula {Number(item.formula_planned_quantity || 0).toFixed(3)} + allowance {Number(item.process_extra_planned_quantity || 0).toFixed(3)}
                                      </small>
                                      {item.extra_reason && (
                                        <small className="formula-cell-hint d-block">{item.extra_reason}</small>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                            <td>{Number(item.issued_quantity || 0).toFixed(3)}</td>
                            <td>{actual.toFixed(3)}</td>
                            <td>{Number(item.returned_quantity || 0).toFixed(3)}</td>
                            <td>{Number(item.extra_quantity || 0).toFixed(3)}</td>
                            <td>{Number(item.waste_quantity || 0).toFixed(3)}</td>
                            <td className={variance > 0 ? "text-danger" : variance < 0 ? "text-success" : ""}>
                              {variance > 0 ? "+" : ""}{variance.toFixed(3)}
                            </td>
                            <td>
                              {String(item.component_role || "").toUpperCase() === "ACTUAL_EXTRA"
                                ? "-"
                                : `${variancePercent.toFixed(2)}%`}
                            </td>
                            <td>{item.unit_code}</td>
                            <td>{item.lot_no || "-"}</td>
                            <td>₹{Number(item.unit_cost || 0).toFixed(4)}</td>
                            <td className="fw-semibold">₹{amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="row mb-4">
                  <div className="col-md-3 mb-3">
                    <strong>Finished Lot</strong>
                    <div>{selectedBatch.finished_lot_no || "-"}</div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <strong>Mfg Date</strong>
                    <div>{selectedBatch.mfg_date || "-"}</div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <strong>Expiry Date</strong>
                    <div>{selectedBatch.expiry_date || "-"}</div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <strong>Corrections</strong>
                    <div>{Number(selectedBatch.correction_count || 0)}</div>
                  </div>
                  <div className="col-12">
                    <strong>Notes</strong>
                    <div>{selectedBatch.notes || "-"}</div>
                  </div>
                </div>

                <h6>Batch Audit History</h6>
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Date / Time</th>
                        <th>Event</th>
                        <th>Reason / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBatch.events || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center text-muted">
                            No batch audit events found.
                          </td>
                        </tr>
                      ) : (
                        selectedBatch.events.map((event) => (
                          <tr key={event.id}>
                            <td>{event.event_date}</td>
                            <td>{event.event_type}</td>
                            <td>{event.reason || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionRegister;