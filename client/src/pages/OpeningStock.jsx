import { useEffect, useState } from "react";
import api from "../api/api";

const createEmptyLine = () => ({
  itemId: "",
  quantity: "",
  unitCost: "",
  lotNo: "",
  expiryDate: "",
});

function OpeningStock() {
  const today = new Date().toISOString().slice(0, 10);

  const [items, setItems] = useState([]);

  const [openingDate, setOpeningDate] = useState(today);
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState([
    createEmptyLine(),
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const response = await api.get("/items");

      setItems(response.data.items);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load items."
      );
    }
  };

  const getItem = (itemId) => {
    return items.find(
      (item) =>
        item.id === Number(itemId)
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
    if (!openingDate) {
      return "Opening stock date is required.";
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

      if (
        Number(line.quantity) <= 0
      ) {
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
          "/opening-stock",
          {
            openingDate,
            notes,

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
                  line.lotNo,

                expiryDate:
                  line.expiryDate,
              })
            ),
          }
        );

      setMessage(
        `Opening stock ${response.data.openingStock.openingNo} saved successfully.`
      );

      setOpeningDate(today);
      setNotes("");

      setLines([
        createEmptyLine(),
      ]);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to save opening stock."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Opening Stock
        </h2>

        <p className="text-muted mb-0">
          Enter inventory that existed before starting Riseora ERP.
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
            <div className="col-md-3">
              <label className="form-label">
                Opening Date *
              </label>

              <input
                type="date"
                className="form-control"
                value={openingDate}
                onChange={(event) =>
                  setOpeningDate(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-9">
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
                placeholder="Optional notes"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Opening Stock Items
            </h5>

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
                    Quantity
                  </th>

                  <th style={{ width: 100 }}>
                    Unit
                  </th>

                  <th style={{ width: 140 }}>
                    Unit Cost
                  </th>

                  <th style={{ width: 160 }}>
                    Lot No.
                  </th>

                  <th style={{ width: 170 }}>
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
        className="btn btn-success"
        onClick={handleSave}
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : "Save Opening Stock"}
      </button>
    </div>
  );
}

export default OpeningStock;