import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const createEmptyLine = () => ({
  itemId: "",
  quantity: "",
  unitCost: "",
  lotNo: "",
  expiryDate: "",
});

function StockAdjustment() {
  const today = new Date().toISOString().slice(0, 10);

  const [items, setItems] = useState([]);
  const [stock, setStock] = useState([]);

  const [adjustmentDate, setAdjustmentDate] = useState(today);
  const [adjustmentType, setAdjustmentType] = useState("OUT");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState([
    createEmptyLine(),
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError("");

      const [itemResponse, stockResponse] =
        await Promise.all([
          api.get("/items"),
          api.get("/stock"),
        ]);

      setItems(itemResponse.data.items || []);
      setStock(stockResponse.data.stock || []);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load items or current stock."
      );
    }
  };

  const getItem = (itemId) => {
    return items.find(
      (item) =>
        item.id === Number(itemId)
    );
  };

  const getCurrentStock = (itemId) => {
    const stockItem = stock.find(
      (item) =>
        item.id === Number(itemId)
    );

    return Number(
      stockItem?.current_stock || 0
    );
  };

  const handleLineChange = (
    index,
    field,
    value
  ) => {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      createEmptyLine(),
    ]);
  };

  const removeLine = (index) => {
    if (lines.length === 1) {
      setLines([
        createEmptyLine(),
      ]);

      return;
    }

    setLines((current) =>
      current.filter(
        (_, lineIndex) =>
          lineIndex !== index
      )
    );
  };

  const validate = () => {
    if (!adjustmentDate) {
      return "Adjustment date is required.";
    }

    if (!reason.trim()) {
      return "Reason is required.";
    }

    for (
      let index = 0;
      index < lines.length;
      index++
    ) {
      const line = lines[index];

      if (!line.itemId) {
        return `Item is required in row ${
          index + 1
        }.`;
      }

      const quantity =
        Number(line.quantity);

      if (quantity <= 0) {
        return `Quantity must be greater than zero in row ${
          index + 1
        }.`;
      }

      if (
        Number(line.unitCost || 0) < 0
      ) {
        return `Unit cost cannot be negative in row ${
          index + 1
        }.`;
      }

      const item =
        getItem(line.itemId);

      if (
        adjustmentType === "OUT"
      ) {
        const currentStock =
          getCurrentStock(
            line.itemId
          );

        if (
          quantity > currentStock
        ) {
          return `${
            item?.name ||
            `Row ${index + 1}`
          }: adjustment quantity cannot exceed current stock of ${currentStock.toFixed(
            3
          )}.`;
        }
      }

      if (
        item?.track_lot &&
        !line.lotNo.trim()
      ) {
        return `Lot number is required for ${item.name}.`;
      }

      if (
        item?.track_expiry &&
        !line.expiryDate
      ) {
        return `Expiry date is required for ${item.name}.`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);

      const response =
        await api.post(
          "/stock-adjustments",
          {
            adjustmentDate,
            adjustmentType,
            reason: reason.trim(),
            notes: notes.trim(),

            items: lines.map(
              (line) => ({
                itemId:
                  Number(
                    line.itemId
                  ),

                quantity:
                  Number(
                    line.quantity
                  ),

                unitCost:
                  Number(
                    line.unitCost ||
                      0
                  ),

                lotNo:
                  line.lotNo.trim(),

                expiryDate:
                  line.expiryDate,
              })
            ),
          }
        );

      setMessage(
        `Stock adjustment ${response.data.adjustment.adjustmentNo} saved successfully.`
      );

      setAdjustmentDate(today);
      setAdjustmentType("OUT");
      setReason("");
      setNotes("");

      setLines([
        createEmptyLine(),
      ]);

      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to save stock adjustment."
      );
    } finally {
      setSaving(false);
    }
  };

  const totalQuantity = useMemo(() => {
    return lines.reduce(
      (total, line) =>
        total +
        Number(
          line.quantity || 0
        ),
      0
    );
  }, [lines]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Stock Adjustment
        </h2>

        <p className="text-muted mb-0">
          Correct stock for damage, leakage, samples,
          breakage or physical count differences.
        </p>
      </div>

      {message && (
        <div className="alert alert-success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label">
                Adjustment Date *
              </label>

              <input
                type="date"
                className="form-control"
                value={adjustmentDate}
                onChange={(event) =>
                  setAdjustmentDate(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label">
                Adjustment Type *
              </label>

              <select
                className="form-select"
                value={adjustmentType}
                onChange={(event) =>
                  setAdjustmentType(
                    event.target.value
                  )
                }
              >
                <option value="OUT">
                  Stock Out
                </option>

                <option value="IN">
                  Stock In
                </option>
              </select>
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                Reason *
              </label>

              <select
                className="form-select"
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Select Reason
                </option>

                <option value="Damage">
                  Damage
                </option>

                <option value="Leakage">
                  Leakage
                </option>

                <option value="Breakage">
                  Breakage
                </option>

                <option value="Sample">
                  Sample
                </option>

                <option value="Physical Count Difference">
                  Physical Count Difference
                </option>

                <option value="Expired">
                  Expired
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">
                Notes
              </label>

              <input
                type="text"
                className="form-control"
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                placeholder="Optional explanation"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1">
                Adjustment Items
              </h5>

              <div className="text-muted small">
                Total quantity:{" "}
                {totalQuantity.toFixed(3)}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={addLine}
            >
              + Add Item
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ minWidth: 260 }}>
                    Item
                  </th>

                  <th style={{ width: 130 }}>
                    Current Stock
                  </th>

                  <th style={{ width: 120 }}>
                    Quantity
                  </th>

                  <th style={{ width: 90 }}>
                    Unit
                  </th>

                  <th style={{ width: 130 }}>
                    Unit Cost
                  </th>

                  <th style={{ width: 160 }}>
                    Lot No.
                  </th>

                  <th style={{ width: 160 }}>
                    Expiry Date
                  </th>

                  <th style={{ width: 100 }}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {lines.map(
                  (line, index) => {
                    const item =
                      getItem(
                        line.itemId
                      );

                    const currentStock =
                      getCurrentStock(
                        line.itemId
                      );

                    return (
                      <tr key={index}>
                        <td>
                          <select
                            className="form-select"
                            value={
                              line.itemId
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "itemId",
                                event.target
                                  .value
                              )
                            }
                          >
                            <option value="">
                              Select Item
                            </option>

                            {items.map(
                              (
                                itemOption
                              ) => (
                                <option
                                  key={
                                    itemOption.id
                                  }
                                  value={
                                    itemOption.id
                                  }
                                >
                                  {
                                    itemOption.code
                                  }{" "}
                                  -{" "}
                                  {
                                    itemOption.name
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td>
                          {line.itemId
                            ? currentStock.toFixed(
                                3
                              )
                            : "-"}
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className="form-control"
                            value={
                              line.quantity
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "quantity",
                                event.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          {item?.unit_code ||
                            "-"}
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={
                              line.unitCost
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "unitCost",
                                event.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={
                              line.lotNo
                            }
                            disabled={
                              !item?.track_lot
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "lotNo",
                                event.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="date"
                            className="form-control"
                            value={
                              line.expiryDate
                            }
                            disabled={
                              !item?.track_expiry
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "expiryDate",
                                event.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              removeLine(
                                index
                              )
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={
          adjustmentType === "OUT"
            ? "btn btn-warning"
            : "btn btn-success"
        }
        onClick={handleSave}
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : adjustmentType === "OUT"
            ? "Save Stock Out"
            : "Save Stock In"}
      </button>
    </div>
  );
}

export default StockAdjustment;