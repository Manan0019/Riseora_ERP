import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";

function Production() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [formulas, setFormulas] = useState([]);
  const [openBatches, setOpenBatches] = useState([]);
  const [formulaId, setFormulaId] = useState("");
  const [productionDate, setProductionDate] = useState(today);
  const [plannedBatchSize, setPlannedBatchSize] = useState("");
  const [notes, setNotes] = useState("");
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadFormulas();
    loadOpenBatches();
  }, []);

  const loadFormulas = async () => {
    try {
      const response = await api.get("/formulas");
      setFormulas(response.data.formulas || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load formulas.");
    }
  };

  const loadOpenBatches = async () => {
    try {
      setLoadingOpen(true);
      const response = await api.get("/production/open");
      setOpenBatches(response.data.batches || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load open production batches.");
    } finally {
      setLoadingOpen(false);
    }
  };

  const selectedFormula = useMemo(
    () => formulas.find((formula) => formula.id === Number(formulaId)),
    [formulas, formulaId],
  );

  const handleFormulaChange = (event) => {
    const value = event.target.value;
    setFormulaId(value);
    setCalculation(null);
    setError("");
    setMessage("");

    const formula = formulas.find((item) => item.id === Number(value));
    setPlannedBatchSize(formula ? String(formula.batch_size) : "");
  };

  const calculateRequirements = async () => {
    setError("");
    setMessage("");

    if (!formulaId) {
      setError("Please select a formula.");
      return;
    }

    if (Number(plannedBatchSize) <= 0) {
      setError("Planned batch size must be greater than zero.");
      return;
    }

    try {
      setCalculating(true);
      const response = await api.get("/production/calculate", {
        params: {
          formulaId: Number(formulaId),
          batchSize: Number(plannedBatchSize),
        },
      });
      setCalculation(response.data.calculation);
    } catch (err) {
      console.error(err);
      setCalculation(null);
      setError(
        err.response?.data?.message || "Unable to calculate production requirements.",
      );
    } finally {
      setCalculating(false);
    }
  };

  const createPlan = async () => {
    setError("");
    setMessage("");

    if (!productionDate) {
      setError("Production date is required.");
      return;
    }

    if (!formulaId) {
      setError("Formula is required.");
      return;
    }

    if (Number(plannedBatchSize) <= 0) {
      setError("Planned batch size must be greater than zero.");
      return;
    }

    if (!calculation) {
      setError("Calculate requirements before creating the production plan.");
      return;
    }

    try {
      setSaving(true);
      const response = await api.post("/production", {
        productionDate,
        formulaId: Number(formulaId),
        plannedBatchSize: Number(plannedBatchSize),
        notes: notes.trim(),
      });

      const production = response.data.production;
      setMessage(
        `${production.batchNo} created as a production plan. Actual consumption and output will be entered after production.`,
      );

      setFormulaId("");
      setPlannedBatchSize("");
      setNotes("");
      setCalculation(null);
      setProductionDate(today);
      await loadOpenBatches();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to create production plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Production Planning</h2>
          <p className="text-muted mb-0">
            Plan production from a formula first. Creating a plan does not change stock.
            Starting the batch issues planned material into WIP; completion reconciles actual
            usage, returns unused material and records the actual finished output.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={loadOpenBatches}
          disabled={loadingOpen}
        >
          {loadingOpen ? "Refreshing..." : "Refresh Open Batches"}
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1">New Production Plan</h5>
              <div className="text-muted small">
                The formula defines the standard. The completed batch will record
                what actually happened.
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label">Production Date *</label>
              <input
                type="date"
                className="form-control"
                value={productionDate}
                onChange={(event) => setProductionDate(event.target.value)}
              />
            </div>

            <div className="col-md-5 mb-3">
              <label className="form-label">Formula *</label>
              <select
                className="form-select"
                value={formulaId}
                onChange={handleFormulaChange}
              >
                <option value="">Select Formula</option>
                {formulas.map((formula) => (
                  <option key={formula.id} value={formula.id}>
                    {formula.code} - {formula.name} (V{formula.version_no})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">Planned Output *</label>
              <input
                type="number"
                min="0"
                step="0.001"
                className="form-control"
                value={plannedBatchSize}
                onChange={(event) => {
                  setPlannedBatchSize(event.target.value);
                  setCalculation(null);
                }}
              />
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">Unit</label>
              <input
                type="text"
                className="form-control"
                value={selectedFormula?.batch_unit_code || ""}
                disabled
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">Plan Notes</label>
              <input
                type="text"
                className="form-control"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional production instruction or note"
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={calculateRequirements}
            disabled={calculating}
          >
            {calculating ? "Calculating..." : "Calculate Requirements"}
          </button>
        </div>
      </div>

      {calculation && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="mb-3">
              <h5 className="mb-1">Planned Material Requirements</h5>
              <div className="text-muted">
                {calculation.formula.finished_item_name} — {Number(plannedBatchSize).toFixed(3)}{" "}
                {calculation.formula.batch_unit_code}
              </div>
            </div>

            <div className="alert alert-light border">
              This is a planning preview only. Creating the plan does not deduct
              stock. Planned material is issued to WIP only when production is started;
              actual consumption is reconciled when the batch is completed.
            </div>

            <div className="table-responsive mb-3">
              <table className="table table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Component</th>
                    <th>Type</th>
                    <th>Planned Qty</th>
                    <th>Formula Unit</th>
                    <th>Stock Requirement</th>
                    <th>Available Stock</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {calculation.ingredients.map((ingredient) => (
                    <tr key={ingredient.ingredientItemId}>
                      <td>
                        <div>{ingredient.ingredientName}</div>
                        <small className="text-muted">
                          {ingredient.ingredientCode}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            ingredient.categoryCode === "PACK"
                              ? "text-bg-warning"
                              : "text-bg-primary"
                          }`}
                        >
                          {ingredient.categoryCode || "RAW"}
                        </span>
                      </td>
                      <td>{Number(ingredient.requiredQuantity).toFixed(3)}</td>
                      <td>{ingredient.unitCode}</td>
                      <td>
                        {Number(ingredient.requiredBaseQuantity).toFixed(3)}{" "}
                        {ingredient.baseUnitCode}
                      </td>
                      <td>
                        {Number(ingredient.currentStockBase).toFixed(3)}{" "}
                        {ingredient.baseUnitCode}
                      </td>
                      <td>
                        {ingredient.sufficientStock ? (
                          <span className="badge text-bg-success">Available</span>
                        ) : (
                          <span className="badge text-bg-warning">Short at present</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-success"
                onClick={createPlan}
                disabled={saving}
              >
                {saving ? "Creating Plan..." : "Create Production Plan"}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setCalculation(null)}
                disabled={saving}
              >
                Clear Preview
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-3">
            <h5 className="mb-1">Open Production Batches</h5>
            <div className="text-muted small">
              Start a planned batch, then enter actual consumption, wastage and
              production outcome when the work is finished.
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
                  <th>Planned Output</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingOpen ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      Loading open production batches...
                    </td>
                  </tr>
                ) : openBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      No open production batches.
                    </td>
                  </tr>
                ) : (
                  openBatches.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.batch_no}</td>
                      <td>{batch.production_date}</td>
                      <td>{batch.finished_item_name}</td>
                      <td>
                        {batch.formula_code} V{batch.version_no}
                      </td>
                      <td>
                        {Number(batch.planned_batch_size || 0).toFixed(3)}{" "}
                        {batch.batch_unit_code}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            batch.status === "IN_PRODUCTION"
                              ? "text-bg-warning"
                              : "text-bg-secondary"
                          }`}
                        >
                          {batch.status === "IN_PRODUCTION" ? "In Production" : "Draft"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/production/${batch.id}/work`)}
                        >
                          Open Batch
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Production;
