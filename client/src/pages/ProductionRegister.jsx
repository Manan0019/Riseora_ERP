import { useEffect, useMemo, useState } from "react";

import api from "../api/api";

function ProductionRegister() {
  const [batches, setBatches] = useState([]);

  const [selectedBatch, setSelectedBatch] = useState(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [detailsLoading, setDetailsLoading] = useState(false);

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

      const response = await api.get(`/production/${id}`);

      setSelectedBatch(response.data.batch);
    } catch (err) {
      console.error(err);

      setError("Unable to load production batch details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredBatches = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) {
      return batches;
    }

    return batches.filter(
      (batch) =>
        (batch.batch_no || "").toLowerCase().includes(text) ||
        (batch.formula_name || "").toLowerCase().includes(text) ||
        (batch.finished_item_name || "").toLowerCase().includes(text) ||
        (batch.finished_lot_no || "").toLowerCase().includes(text),
    );
  }, [batches, search]);

  const getLoss = (batch) => {
    return (
      Number(batch.planned_batch_size || 0) -
      Number(batch.actual_output_qty || 0)
    );
  };

  const getLossPercent = (batch) => {
    const planned = Number(batch.planned_batch_size || 0);

    if (planned <= 0) {
      return 0;
    }

    return (getLoss(batch) / planned) * 100;
  };

  const costSummary = useMemo(() => {
    if (!selectedBatch?.consumption) {
      return {
        rawCost,
        packagingCost,
        otherCost,

        materialCost,
        labourCost,
        electricityCost,
        otherOverheadCost,
        overheadCost,

        totalCost,
        unitCost,
      };
    }

    let rawCost = 0;
    let packagingCost = 0;
    let otherCost = 0;

    selectedBatch.consumption.forEach((item) => {
      const amount =
        Number(item.actual_quantity || 0) * Number(item.unit_cost || 0);

      if (item.category_code === "RAW") {
        rawCost += amount;
      } else if (item.category_code === "PACK") {
        packagingCost += amount;
      } else {
        otherCost += amount;
      }
    });
    const materialCost = Number(
      selectedBatch.material_cost || rawCost + packagingCost + otherCost,
    );

    const labourCost = Number(selectedBatch.labour_cost || 0);

    const electricityCost = Number(selectedBatch.electricity_cost || 0);

    const otherOverheadCost = Number(selectedBatch.other_overhead_cost || 0);

    const overheadCost = labourCost + electricityCost + otherOverheadCost;

    const totalCost = Number(
      selectedBatch.total_production_cost || materialCost + overheadCost,
    );

    const unitCost = Number(selectedBatch.finished_unit_cost || 0);
    return {
      rawCost,
      packagingCost,
      otherCost,
      totalCost,
      unitCost,
    };
  }, [selectedBatch]);

  const handleCancelBatch = async () => {
    if (!selectedBatch) {
      return;
    }

    if (selectedBatch.status === "CANCELLED") {
      setError("This production batch is already cancelled.");

      return;
    }

    const confirmed = window.confirm(
      `Cancel ${selectedBatch.batch_no}? Raw materials will be restored and finished stock will be reversed.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await api.patch(`/production/${selectedBatch.id}/cancel`);

      setSelectedBatch(null);

      await loadBatches();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message || "Unable to cancel production batch.",
      );
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Production Register</h2>

          <p className="text-muted mb-0">
            Review manufacturing batches and ingredient consumption.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={loadBatches}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-4">
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search batch, formula, product or lot..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Batch No.</th>
                  <th>Date</th>
                  <th>Formula</th>
                  <th>Finished Product</th>
                  <th>Planned</th>
                  <th>Actual Output</th>
                  <th>Loss</th>
                  <th>Loss %</th>
                  <th>Lot No.</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted">
                      Loading production batches...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        onClick={() => loadBatchDetails(batch.id)}
                        style={{
                          cursor: "pointer",
                        }}
                        className={
                          selectedBatch?.id === batch.id ? "table-primary" : ""
                        }
                      >
                        <td>{batch.batch_no}</td>

                        <td>{batch.production_date}</td>

                        <td>
                          {batch.formula_name} V{batch.version_no}
                        </td>

                        <td>{batch.finished_item_name}</td>

                        <td>
                          {Number(batch.planned_batch_size).toFixed(3)}{" "}
                          {batch.batch_unit_code}
                        </td>

                        <td>
                          {Number(batch.actual_output_qty).toFixed(3)}{" "}
                          {batch.batch_unit_code}
                        </td>

                        <td>{getLoss(batch).toFixed(3)}</td>

                        <td>{getLossPercent(batch).toFixed(2)}%</td>

                        <td>{batch.finished_lot_no || "-"}</td>

                        <td>
                          {batch.status === "CANCELLED" ? (
                            <span className="badge text-bg-danger">
                              Cancelled
                            </span>
                          ) : (
                            <span className="badge text-bg-success">
                              Posted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredBatches.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center text-muted">
                          No production batches found.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedBatch && (
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Batch Details</h5>

              {selectedBatch.status !== "CANCELLED" && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleCancelBatch}
                >
                  Cancel Production
                </button>
              )}
            </div>

            {detailsLoading ? (
              <p>Loading batch details...</p>
            ) : (
              <>
                <div className="row mb-4">
                  <div className="col-md-3 mb-3">
                    <strong>Batch No.</strong>

                    <div>{selectedBatch.batch_no}</div>
                  </div>

                  <div className="col-md-3 mb-3">
                    <strong>Product</strong>

                    <div>{selectedBatch.finished_item_name}</div>
                  </div>

                  <div className="col-md-3 mb-3">
                    <strong>Lot No.</strong>

                    <div>{selectedBatch.finished_lot_no || "-"}</div>
                  </div>

                  <div className="col-md-3 mb-3">
                    <strong>Actual Output</strong>

                    <div>
                      {Number(selectedBatch.actual_output_qty).toFixed(3)}{" "}
                      {selectedBatch.batch_unit_code}
                    </div>
                  </div>

                  <div className="col-md-3">
                    <strong>Mfg Date</strong>

                    <div>{selectedBatch.mfg_date || "-"}</div>
                  </div>

                  <div className="col-md-3">
                    <strong>Expiry Date</strong>

                    <div>{selectedBatch.expiry_date || "-"}</div>
                  </div>

                  <div className="col-md-6">
                    <strong>Notes</strong>

                    <div>{selectedBatch.notes || "-"}</div>
                  </div>
                </div>

                {selectedBatch.status !== "CANCELLED" && (
                  <div className="mb-4">
                    <h6 className="mb-3">Production Costing</h6>

                    <div className="row g-3">
                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">
                            Raw Material Cost
                          </div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.rawCost.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Packaging Cost</div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.packagingCost.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Direct Labour</div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.labourCost.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">
                            Electricity / Utilities
                          </div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.electricityCost.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">
                            Other Manufacturing
                          </div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.otherOverheadCost.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">
                            Total Production Cost
                          </div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.totalCost.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">
                            Finished Unit Cost
                          </div>

                          <div className="fs-5 fw-semibold">
                            ₹{costSummary.unitCost.toFixed(2)}
                            {" / "}
                            {selectedBatch.batch_unit_code}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <h6>Component Consumption & Costing</h6>

                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Component</th>
                        <th>Type</th>
                        <th>Planned Qty</th>
                        <th>Actual Qty</th>
                        <th>Unit</th>
                        <th>Difference</th>
                        <th>Lot No.</th>
                        <th>Unit Cost</th>
                        <th>Amount</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedBatch.consumption.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.item_code} - {item.item_name}
                          </td>

                          <td>
                            {item.category_code === "RAW" ? (
                              <span className="badge text-bg-primary">Raw</span>
                            ) : item.category_code === "PACK" ? (
                              <span className="badge text-bg-warning">
                                Packaging
                              </span>
                            ) : (
                              <span className="badge text-bg-secondary">
                                {item.category_code || "-"}
                              </span>
                            )}
                          </td>

                          <td>{Number(item.planned_quantity).toFixed(3)}</td>

                          <td>{Number(item.actual_quantity).toFixed(3)}</td>

                          <td>{item.unit_code}</td>

                          <td>
                            {(
                              Number(item.actual_quantity) -
                              Number(item.planned_quantity)
                            ).toFixed(3)}
                          </td>

                          <td>{item.lot_no || "-"}</td>

                          <td>₹{Number(item.unit_cost || 0).toFixed(2)}</td>

                          <td className="fw-semibold">
                            ₹
                            {(
                              Number(item.actual_quantity || 0) *
                              Number(item.unit_cost || 0)
                            ).toFixed(2)}
                          </td>
                        </tr>
                      ))}

                      {selectedBatch.consumption.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center text-muted">
                            No consumption details found.
                          </td>
                        </tr>
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
