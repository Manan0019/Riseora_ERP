import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import api from "../api/api";
import { useUi } from "../context/UiContext";

function ProductionWork() {
  const { success: toastSuccess, error: toastError } = useUi();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const correctionMode = searchParams.get("mode") === "correct";

  const today = new Date().toISOString().slice(0, 10);

  const [batch, setBatch] = useState(null);
  const [consumption, setConsumption] = useState([]);
  const [goodOutputQty, setGoodOutputQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("0");
  const [reworkQty, setReworkQty] = useState("0");
  const [scrapQty, setScrapQty] = useState("0");
  const [finishedLotNo, setFinishedLotNo] = useState("");
  const [mfgDate, setMfgDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState("");
  const [labourCost, setLabourCost] = useState("");
  const [electricityCost, setElectricityCost] = useState("");
  const [otherOverheadCost, setOtherOverheadCost] = useState("");
  const [notes, setNotes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, correctionMode]);

  const loadBatch = async (preserveMessage = false) => {
    try {
      setLoading(true);
      setError("");
      if (!preserveMessage) setMessage("");

      const response = await api.get(`/production/${id}`);
      const data = response.data.batch;
      setBatch(data);

      const isExistingCompletion = data.status === "COMPLETED" || data.status === "CLOSED";

      setConsumption(
        (data.consumption || []).map((item) => ({
          itemId: Number(item.item_id),
          actualQuantity: isExistingCompletion
            ? String(Number(item.actual_quantity || 0))
            : String(Number(item.planned_quantity || 0)),
          wasteQuantity: isExistingCompletion
            ? String(Number(item.waste_quantity || 0))
            : "0",
          lotNo: item.lot_no || "",
        })),
      );

      setGoodOutputQty(
        isExistingCompletion
          ? String(Number(data.good_output_qty || data.actual_output_qty || 0))
          : String(Number(data.planned_batch_size || 0)),
      );
      setRejectedQty(String(Number(data.rejected_qty || 0)));
      setReworkQty(String(Number(data.rework_qty || 0)));
      setScrapQty(String(Number(data.scrap_qty || 0)));
      setFinishedLotNo(data.finished_lot_no || "");
      setMfgDate(data.mfg_date || data.production_date || today);
      setExpiryDate(data.expiry_date || "");
      setLabourCost(isExistingCompletion ? String(Number(data.labour_cost || 0)) : "");
      setElectricityCost(
        isExistingCompletion ? String(Number(data.electricity_cost || 0)) : "",
      );
      setOtherOverheadCost(
        isExistingCompletion ? String(Number(data.other_overhead_cost || 0)) : "",
      );
      setNotes(data.notes || "");
      setCorrectionReason("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load production batch.");
    } finally {
      setLoading(false);
    }
  };

  const updateConsumption = (index, field, value) => {
    setConsumption((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const outcome = useMemo(() => {
    const planned = Number(batch?.planned_batch_size || 0);
    const good = Number(goodOutputQty || 0);
    const rejected = Number(rejectedQty || 0);
    const rework = Number(reworkQty || 0);
    const scrap = Number(scrapQty || 0);
    const total = good + rejected + rework + scrap;
    const variance = good - planned;
    const variancePercent = planned > 0 ? (variance / planned) * 100 : 0;
    const yieldPercent = planned > 0 ? (good / planned) * 100 : 0;

    return { planned, good, rejected, rework, scrap, total, variance, variancePercent, yieldPercent };
  }, [batch, goodOutputQty, rejectedQty, reworkQty, scrapQty]);

  const handleStart = async () => {
    try {
      setStarting(true);
      setError("");
      const response = await api.patch(`/production/${id}/start`, {
        ingredients: consumption.map((item) => ({
          itemId: Number(item.itemId),
          lotNo: item.lotNo.trim(),
        })),
      });
      const successMessage = response.data.message || "Production started.";
      setMessage(successMessage);
      toastSuccess(successMessage, "Production started");
      await loadBatch(true);
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || "Unable to start production batch.";
      setError(errorMessage);
      toastError(errorMessage, "Production not started");
    } finally {
      setStarting(false);
    }
  };

  const validate = () => {
    if (!batch) return "Production batch is not loaded.";

    if (correctionMode && batch.status !== "COMPLETED") {
      return "Only a completed, not-yet-closed batch can be corrected.";
    }

    if (!correctionMode && batch.status !== "IN_PRODUCTION") {
      return "Start the production batch before completing it.";
    }

    if (correctionMode && !correctionReason.trim()) {
      return "Correction reason is required.";
    }

    const values = [
      [outcome.good, "Good output"],
      [outcome.rejected, "Rejected quantity"],
      [outcome.rework, "Rework quantity"],
      [outcome.scrap, "Scrap quantity"],
    ];

    for (const [value, label] of values) {
      if (!Number.isFinite(value) || value < 0) return `${label} cannot be negative.`;
    }

    if (outcome.total <= 0) {
      return "Enter at least one production outcome: good, rejected, rework or scrap.";
    }

    if (outcome.good > 0 && Number(batch.finished_track_lot || 0) === 1 && !finishedLotNo.trim()) {
      return "Finished product lot / batch number is required.";
    }

    if (outcome.good > 0 && Number(batch.finished_track_expiry || 0) === 1 && !expiryDate) {
      return "Finished product expiry date is required.";
    }

    for (let index = 0; index < (batch.consumption || []).length; index++) {
      const source = batch.consumption[index];
      const line = consumption[index];

      if (Number(source.track_lot || 0) === 1 && !String(line?.lotNo || "").trim()) {
        return `${source.item_name}: lot number is required.`;
      }

      const actual = Number(line?.actualQuantity || 0);
      const waste = Number(line?.wasteQuantity || 0);

      if (!Number.isFinite(actual) || actual < 0) {
        return `${source.item_name}: actual consumption cannot be negative.`;
      }
      if (!Number.isFinite(waste) || waste < 0) {
        return `${source.item_name}: waste cannot be negative.`;
      }
      if (waste > actual) {
        return `${source.item_name}: waste cannot exceed actual consumption.`;
      }

      const currentAvailable = Number(source.current_stock_display || 0);
      const availableForCompletion = correctionMode
        ? currentAvailable + Number(source.actual_quantity || 0)
        : currentAvailable + Number(source.issued_quantity || 0);

      if (actual > availableForCompletion + 0.0000001) {
        return `${source.item_name}: actual consumption exceeds stock available for this batch.`;
      }
    }

    for (const [value, label] of [
      [Number(labourCost || 0), "Direct labour cost"],
      [Number(electricityCost || 0), "Electricity / utilities cost"],
      [Number(otherOverheadCost || 0), "Other manufacturing cost"],
    ]) {
      if (!Number.isFinite(value) || value < 0) return `${label} cannot be negative.`;
    }

    return null;
  };

  const handleSave = async () => {
    setError("");
    setMessage("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      goodOutputQty: Number(goodOutputQty || 0),
      rejectedQty: Number(rejectedQty || 0),
      reworkQty: Number(reworkQty || 0),
      scrapQty: Number(scrapQty || 0),
      finishedLotNo: finishedLotNo.trim(),
      mfgDate: mfgDate || null,
      expiryDate: expiryDate || null,
      labourCost: Number(labourCost || 0),
      electricityCost: Number(electricityCost || 0),
      otherOverheadCost: Number(otherOverheadCost || 0),
      notes: notes.trim(),
      correctionReason: correctionReason.trim(),
      ingredients: consumption.map((item) => ({
        itemId: Number(item.itemId),
        actualQuantity: Number(item.actualQuantity || 0),
        wasteQuantity: Number(item.wasteQuantity || 0),
        lotNo: item.lotNo.trim(),
      })),
    };

    try {
      setSaving(true);
      const endpoint = correctionMode
        ? `/production/${id}/correct`
        : `/production/${id}/complete`;
      const response = await api.patch(endpoint, payload);
      const production = response.data.production;

      const pricingMessage =
        Number(production.suggestedSellingPrice || 0) > 0
          ? ` Target-margin suggested selling price: ₹${Number(
              production.suggestedSellingPrice,
            ).toFixed(2)}. Current default selling price was ₹${Number(
              production.sellingPriceSnapshot || 0,
            ).toFixed(2)}.`
          : "";

      const successMessage = `${production.batchNo} ${
        correctionMode ? "corrected" : "completed"
      } successfully. Good output: ${Number(production.goodOutputQty || 0).toFixed(3)} ${
        production.actualOutputUnit
      }. Total cost: ₹${Number(production.totalProductionCost || 0).toFixed(
        2,
      )}. Unit cost: ₹${Number(production.finishedUnitCost || 0).toFixed(2)}/${
        production.finishedBaseUnit || "unit"
      }.${pricingMessage}`;

      setMessage(successMessage);
      toastSuccess(
        successMessage,
        correctionMode ? "Production corrected" : "Production completed",
      );

      await loadBatch(true);
    } catch (err) {
      console.error(err);
      const errorMessage =
        err.response?.data?.message ||
        `Unable to ${correctionMode ? "correct" : "complete"} production batch.`;
      setError(errorMessage);
      toastError(errorMessage, "Production update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-muted">Loading production batch...</div>;
  }

  if (!batch) {
    return <div className="alert alert-danger">Production batch was not found.</div>;
  }

  const canEditLots = correctionMode
    ? batch.status === "COMPLETED"
    : batch.status === "DRAFT";

  const canEditActuals = correctionMode
    ? batch.status === "COMPLETED"
    : batch.status === "IN_PRODUCTION";

  const canComplete = canEditActuals;

  const editable = canEditLots || canEditActuals;

  return (
    <div className="transaction-page production-work-page">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">
            {correctionMode ? "Correct Production Batch" : "Production Actuals"}
          </h2>
          <div className="text-muted">
            {batch.batch_no} • {batch.finished_item_name} • {batch.formula_code} V
            {batch.version_no}
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/production-register")}
          >
            Production Register
          </button>

          {batch.status === "DRAFT" && !correctionMode && (
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? "Starting..." : "Start Production"}
            </button>
          )}
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {correctionMode && (
        <div className="alert alert-warning">
          A correction is allowed only when the finished product and every consumed
          component have no later stock movements. The ERP will reverse the original
          batch movements, apply the corrected actuals, recalculate cost and keep an
          audit event. If later transactions exist, the correction will be blocked.
        </div>
      )}

      {!editable && (
        <div className="alert alert-secondary">
          This batch is {batch.status}. It is not editable from this screen.
        </div>
      )}

      <div className="card mb-4 transaction-card">
        <div className="card-body">
          <h5 className="mb-3">Batch Plan</h5>
          <div className="row g-3">
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Status</div>
                <div className="fw-semibold">{batch.status}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Production Date</div>
                <div className="fw-semibold">{batch.production_date}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Planned Output</div>
                <div className="fw-semibold">
                  {Number(batch.planned_batch_size || 0).toFixed(3)} {batch.batch_unit_code}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">QC</div>
                <div className="fw-semibold">{batch.qc_status || "NOT_CHECKED"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 transaction-card">
        <div className="card-body">
          <div className="mb-3">
            <h5 className="mb-1">Actual Material Consumption</h5>
            <div className="text-muted small">
              Enter the quantity actually removed from usable stock. Waste is the
              part of that actual consumption that was spilled, damaged or otherwise
              lost during production/packing.
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle entry-table">
              <thead className="table-light">
                <tr>
                  <th>Component</th>
                  <th>Type</th>
                  <th>Planned</th>
                  <th>Issued to WIP</th>
                  <th style={{ minWidth: 135 }}>Actual Consumed</th>
                  <th style={{ minWidth: 120 }}>Waste</th>
                  <th>Unit</th>
                  <th>Available</th>
                  <th>Variance</th>
                  <th style={{ minWidth: 130 }}>Lot</th>
                </tr>
              </thead>
              <tbody>
                {(batch.consumption || []).map((item, index) => {
                  const actual = Number(consumption[index]?.actualQuantity || 0);
                  const planned = Number(item.planned_quantity || 0);
                  const variance = actual - planned;
                  const current = Number(item.current_stock_display || 0);
                  const issued = Number(item.issued_quantity || 0);
                  const restored = correctionMode ? Number(item.actual_quantity || 0) : 0;
                  const available = correctionMode
                    ? current + restored
                    : current + issued;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="fw-semibold">{item.item_name}</div>
                        <small className="text-muted">{item.item_code}</small>
                        {Number(item.process_extra_planned_quantity || 0) > 0 && (
                          <div className="mt-1">
                            <span className="badge formula-extra-badge">
                              {Number(item.formula_planned_quantity || 0) > 0
                                ? "Formula + Allowance"
                                : "Process Allowance"}
                            </span>
                          </div>
                        )}
                        {Number(item.process_extra_planned_quantity || 0) > 0 && item.extra_reason && (
                          <div className="formula-cell-hint mt-1">{item.extra_reason}</div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            (item.category_role || item.category_code) === "PACK"
                              ? "text-bg-warning"
                              : "text-bg-primary"
                          }`}
                        >
                          {item.category_name || item.category_code}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold">{planned.toFixed(3)}</div>
                        {Number(item.process_extra_planned_quantity || 0) > 0 && (
                          <div className="formula-cell-hint">
                            Standard {Number(item.formula_planned_quantity || 0).toFixed(3)}
                            {" + "}Allowance {Number(item.process_extra_planned_quantity || 0).toFixed(3)}
                          </div>
                        )}
                      </td>
                      <td>{Number(item.issued_quantity || 0).toFixed(3)}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          className="form-control"
                          value={consumption[index]?.actualQuantity ?? ""}
                          disabled={!canEditActuals}
                          onChange={(event) =>
                            updateConsumption(index, "actualQuantity", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          className="form-control"
                          value={consumption[index]?.wasteQuantity ?? ""}
                          disabled={!canEditActuals}
                          onChange={(event) =>
                            updateConsumption(index, "wasteQuantity", event.target.value)
                          }
                        />
                      </td>
                      <td>{item.unit_code}</td>
                      <td>
                        {available.toFixed(3)} {item.unit_code}
                        {correctionMode && restored > 0 && (
                          <div className="text-muted small">
                            correction can restore {restored.toFixed(3)} from this batch
                          </div>
                        )}
                        {!correctionMode && batch.status === "IN_PRODUCTION" && issued > 0 && (
                          <div className="text-muted small">
                            includes {issued.toFixed(3)} already issued to WIP
                          </div>
                        )}
                      </td>
                      <td className={variance > 0 ? "text-danger" : variance < 0 ? "text-success" : ""}>
                        {variance > 0 ? "+" : ""}
                        {variance.toFixed(3)}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={consumption[index]?.lotNo || ""}
                          disabled={!canEditLots}
                          placeholder={Number(item.track_lot || 0) === 1 ? "Required" : "Optional"}
                          onChange={(event) =>
                            updateConsumption(index, "lotNo", event.target.value)
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mb-4 transaction-card">
        <div className="card-body">
          <div className="mb-3">
            <h5 className="mb-1">Production Outcome</h5>
            <div className="text-muted small">
              Only Good Output is added to saleable finished-goods stock. Rejected,
              rework and scrap quantities are recorded for production analysis.
            </div>
          </div>

          <div className="row">
            {[
              ["Good Output", goodOutputQty, setGoodOutputQty],
              ["Rejected", rejectedQty, setRejectedQty],
              ["Rework", reworkQty, setReworkQty],
              ["Scrap", scrapQty, setScrapQty],
            ].map(([label, value, setter]) => (
              <div className="col-md-3 mb-3" key={label}>
                <label className="form-label">{label}</label>
                <div className="input-group">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="form-control"
                    value={value}
                    disabled={!canEditActuals}
                    onChange={(event) => setter(event.target.value)}
                  />
                  <span className="input-group-text">{batch.batch_unit_code}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Total Outcome Recorded</div>
                <div className="fw-semibold">
                  {outcome.total.toFixed(3)} {batch.batch_unit_code}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Good Output Variance</div>
                <div className={`fw-semibold ${outcome.variance < 0 ? "text-danger" : outcome.variance > 0 ? "text-success" : ""}`}>
                  {outcome.variance > 0 ? "+" : ""}{outcome.variance.toFixed(3)} {batch.batch_unit_code}
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Variance %</div>
                <div className="fw-semibold">{outcome.variancePercent.toFixed(2)}%</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="border rounded p-3 h-100">
                <div className="text-muted small">Good Yield %</div>
                <div className="fw-semibold">{outcome.yieldPercent.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-4 mb-3">
              <label className="form-label">Finished Lot / Batch No.{Number(batch.finished_track_lot || 0) === 1 ? " *" : ""}</label>
              <input
                type="text"
                className="form-control"
                value={finishedLotNo}
                disabled={!canEditActuals}
                onChange={(event) => setFinishedLotNo(event.target.value)}
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Manufacturing Date</label>
              <input
                type="date"
                className="form-control"
                value={mfgDate}
                disabled={!canEditActuals}
                onChange={(event) => setMfgDate(event.target.value)}
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Expiry Date{Number(batch.finished_track_expiry || 0) === 1 ? " *" : ""}</label>
              <input
                type="date"
                className="form-control"
                value={expiryDate}
                disabled={!canEditActuals}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 transaction-card">
        <div className="card-body">
          <h5 className="mb-3">Actual Manufacturing Costs</h5>
          <div className="row">
            {[
              ["Direct Labour", labourCost, setLabourCost],
              ["Electricity / Utilities", electricityCost, setElectricityCost],
              ["Other Manufacturing Cost", otherOverheadCost, setOtherOverheadCost],
            ].map(([label, value, setter]) => (
              <div className="col-md-4 mb-3" key={label}>
                <label className="form-label">{label}</label>
                <div className="input-group">
                  <span className="input-group-text">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={value}
                    disabled={!canEditActuals}
                    onChange={(event) => setter(event.target.value)}
                  />
                </div>
              </div>
            ))}

            <div className="col-12 mb-3">
              <label className="form-label">Batch Notes</label>
              <textarea
                className="form-control"
                rows="3"
                value={notes}
                disabled={!canEditActuals}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            {correctionMode && (
              <div className="col-12">
                <label className="form-label">Correction Reason *</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={correctionReason}
                  disabled={!canEditActuals}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  placeholder="Explain why the completed production batch is being corrected."
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {!correctionMode && batch.status === "DRAFT" && (
        <div className="alert alert-info">
          Click <strong>Start Production</strong> first. Planned material will be issued
          from stock into WIP. After production, enter actual consumption and outcome.
        </div>
      )}

      {canComplete && (
        <div className="transaction-action-bar">
          <div className="transaction-action-copy">
            <span>{correctionMode ? "Production correction" : "Production completion"}</span>
            <strong>{outcome.good.toFixed(3)} {batch.batch_unit_code} good output</strong>
            <small>Yield {outcome.yieldPercent.toFixed(2)}% • variance {outcome.variancePercent.toFixed(2)}%</small>
          </div>
          <div className="d-flex gap-2">
          <button
            type="button"
            className={correctionMode ? "btn btn-warning btn-lg" : "btn btn-success btn-lg"}
            onClick={handleSave}
            disabled={saving || !canComplete}
          >
            {saving
              ? correctionMode
                ? "Posting Correction..."
                : "Completing Batch..."
              : correctionMode
                ? "Post Production Correction"
                : "Complete Production Batch"}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary btn-lg"
            onClick={() => navigate("/production-register")}
            disabled={saving}
          >
            Back to Register
          </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionWork;
