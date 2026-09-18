import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const emptyLine = () => ({
  itemId: "",
  quantity: "",
  rate: "",
  gstRate: "0",
  lotNo: "",
  mfgDate: "",
  expiryDate: "",
});

function Purchases() {
  const today = new Date().toISOString().slice(0, 10);

  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);

  const [form, setForm] = useState({
    purchaseDate: today,
    supplierId: "",
    supplierInvoiceNo: "",
    supplierInvoiceDate: "",
    freightAmount: "0",
    otherCharges: "0",
    notes: "",
  });

  const [lines, setLines] = useState([
    emptyLine(),
  ]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [supplierResponse, itemResponse] =
        await Promise.all([
          api.get("/suppliers"),
          api.get("/items"),
        ]);

      setSuppliers(
        supplierResponse.data.suppliers
      );

      setItems(
        itemResponse.data.items
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load suppliers or items."
      );
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
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
      emptyLine(),
    ]);
  };

  const removeLine = (index) => {
    if (lines.length === 1) {
      setLines([emptyLine()]);
      return;
    }

    setLines((current) =>
      current.filter(
        (_, lineIndex) =>
          lineIndex !== index
      )
    );
  };

  const calculateLine = (line) => {
    const quantity =
      Number(line.quantity || 0);

    const rate =
      Number(line.rate || 0);

    const gstRate =
      Number(line.gstRate || 0);

    const taxable =
      quantity * rate;

    const gst =
      taxable * (gstRate / 100);

    const total =
      taxable + gst;

    return {
      taxable,
      gst,
      total,
    };
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    for (const line of lines) {
      const result =
        calculateLine(line);

      subtotal += result.taxable;
      gst += result.gst;
    }

    const freight =
      Number(
        form.freightAmount || 0
      );

    const other =
      Number(
        form.otherCharges || 0
      );

    return {
      subtotal,
      gst,
      freight,
      other,
      grandTotal:
        subtotal +
        gst +
        freight +
        other,
    };
  }, [
    lines,
    form.freightAmount,
    form.otherCharges,
  ]);

  const getSelectedItem = (
    itemId
  ) => {
    return items.find(
      (item) =>
        item.id === Number(itemId)
    );
  };

  const validate = () => {
    if (!form.purchaseDate) {
      return "Purchase date is required.";
    }

    if (!form.supplierId) {
      return "Supplier is required.";
    }

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {
      const line = lines[i];

      if (!line.itemId) {
        return `Item is required in row ${
          i + 1
        }.`;
      }

      if (
        Number(line.quantity) <= 0
      ) {
        return `Quantity must be greater than zero in row ${
          i + 1
        }.`;
      }

      if (
        Number(line.rate) < 0
      ) {
        return `Rate cannot be negative in row ${
          i + 1
        }.`;
      }

      const item =
        getSelectedItem(
          line.itemId
        );

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
          "/purchases",
          {
            ...form,

            supplierId:
              Number(
                form.supplierId
              ),

            freightAmount:
              Number(
                form.freightAmount ||
                  0
              ),

            otherCharges:
              Number(
                form.otherCharges ||
                  0
              ),

            items: lines.map(
              (line) => ({
                ...line,

                itemId:
                  Number(
                    line.itemId
                  ),

                quantity:
                  Number(
                    line.quantity
                  ),

                rate:
                  Number(
                    line.rate
                  ),

                gstRate:
                  Number(
                    line.gstRate ||
                      0
                  ),
              })
            ),
          }
        );

      setMessage(
        `Purchase ${response.data.purchase.purchaseNo} saved successfully.`
      );

      setForm({
        purchaseDate: today,
        supplierId: "",
        supplierInvoiceNo: "",
        supplierInvoiceDate: "",
        freightAmount: "0",
        otherCharges: "0",
        notes: "",
      });

      setLines([
        emptyLine(),
      ]);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to save purchase."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Purchase Entry
        </h2>

        <p className="text-muted mb-0">
          Record raw material and
          packaging purchases.
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
                Purchase Date *
              </label>

              <input
                type="date"
                className="form-control"
                name="purchaseDate"
                value={
                  form.purchaseDate
                }
                onChange={
                  handleFormChange
                }
              />
            </div>

            <div className="col-md-5 mb-3">
              <label className="form-label">
                Supplier *
              </label>

              <select
                className="form-select"
                name="supplierId"
                value={
                  form.supplierId
                }
                onChange={
                  handleFormChange
                }
              >
                <option value="">
                  Select Supplier
                </option>

                {suppliers.map(
                  (supplier) => (
                    <option
                      key={
                        supplier.id
                      }
                      value={
                        supplier.id
                      }
                    >
                      {supplier.code} -{" "}
                      {
                        supplier.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                Supplier Invoice No.
              </label>

              <input
                className="form-control"
                name="supplierInvoiceNo"
                value={
                  form.supplierInvoiceNo
                }
                onChange={
                  handleFormChange
                }
              />
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label">
                Supplier Invoice Date
              </label>

              <input
                type="date"
                className="form-control"
                name="supplierInvoiceDate"
                value={
                  form.supplierInvoiceDate
                }
                onChange={
                  handleFormChange
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Purchase Items
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
                  <th style={{ minWidth: 220 }}>
                    Item
                  </th>

                  <th style={{ minWidth: 100 }}>
                    Qty
                  </th>

                  <th style={{ minWidth: 90 }}>
                    Unit
                  </th>

                  <th style={{ minWidth: 120 }}>
                    Rate
                  </th>

                  <th style={{ minWidth: 100 }}>
                    GST %
                  </th>

                  <th style={{ minWidth: 120 }}>
                    Taxable
                  </th>

                  <th style={{ minWidth: 120 }}>
                    GST
                  </th>

                  <th style={{ minWidth: 120 }}>
                    Total
                  </th>

                  <th style={{ minWidth: 130 }}>
                    Lot No.
                  </th>

                  <th style={{ minWidth: 150 }}>
                    Mfg Date
                  </th>

                  <th style={{ minWidth: 150 }}>
                    Expiry Date
                  </th>

                  <th></th>
                </tr>
              </thead>

              <tbody>
                {lines.map(
                  (line, index) => {
                    const item =
                      getSelectedItem(
                        line.itemId
                      );

                    const values =
                      calculateLine(
                        line
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
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "itemId",
                                e.target
                                  .value
                              )
                            }
                          >
                            <option value="">
                              Select
                              Item
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
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "quantity",
                                e.target
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
                              line.rate
                            }
                            onChange={(
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "rate",
                                e.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={
                              line.gstRate
                            }
                            onChange={(
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "gstRate",
                                e.target
                                  .value
                              )
                            }
                          />
                        </td>

                        <td>
                          ₹
                          {values.taxable.toFixed(
                            2
                          )}
                        </td>

                        <td>
                          ₹
                          {values.gst.toFixed(
                            2
                          )}
                        </td>

                        <td>
                          ₹
                          {values.total.toFixed(
                            2
                          )}
                        </td>

                        <td>
                          <input
                            className="form-control"
                            value={
                              line.lotNo
                            }
                            disabled={
                              !item?.track_lot
                            }
                            onChange={(
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "lotNo",
                                e.target
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
                              line.mfgDate
                            }
                            disabled={
                              !item?.track_lot &&
                              !item?.track_expiry
                            }
                            onChange={(
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "mfgDate",
                                e.target
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
                              e
                            ) =>
                              handleLineChange(
                                index,
                                "expiryDate",
                                e.target
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

      <div className="row">
        <div className="col-lg-7">
          <div className="card mb-4">
            <div className="card-body">
              <label className="form-label">
                Notes
              </label>

              <textarea
                className="form-control"
                rows="3"
                name="notes"
                value={form.notes}
                onChange={
                  handleFormChange
                }
              />
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card mb-4">
            <div className="card-body">
              <div className="row">
                <div className="col-6 mb-3">
                  <label className="form-label">
                    Freight
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    name="freightAmount"
                    value={
                      form.freightAmount
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-6 mb-3">
                  <label className="form-label">
                    Other Charges
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    name="otherCharges"
                    value={
                      form.otherCharges
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>
              </div>

              <table className="table mb-0">
                <tbody>
                  <tr>
                    <th>Subtotal</th>

                    <td className="text-end">
                      ₹
                      {totals.subtotal.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>GST</th>

                    <td className="text-end">
                      ₹
                      {totals.gst.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>Freight</th>

                    <td className="text-end">
                      ₹
                      {totals.freight.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Other Charges
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.other.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Grand Total
                    </th>

                    <th className="text-end">
                      ₹
                      {totals.grandTotal.toFixed(
                        2
                      )}
                    </th>
                  </tr>
                </tbody>
              </table>
            </div>
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
          ? "Saving Purchase..."
          : "Save Purchase"}
      </button>
    </div>
  );
}

export default Purchases;