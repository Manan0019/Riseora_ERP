import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import SearchableSelect from "../components/SearchableSelect";
import { useUi } from "../context/UiContext";

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
  const { success: toastSuccess, error: toastError } = useUi();
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

      const successMessage = `Purchase ${response.data.purchase.purchaseNo} saved successfully.`;
      setMessage(successMessage);
      toastSuccess(successMessage, "Purchase posted");

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

      const errorMessage = err.response?.data?.message || "Unable to save purchase.";
      setError(errorMessage);
      toastError(errorMessage, "Purchase not saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="transaction-page purchase-entry-page">
      <div className="transaction-intro mb-4">
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

      <div className="card mb-4 transaction-card">
        <div className="card-body">
          <div className="transaction-section-heading">
            <div><span className="transaction-step">01</span><div><h5>Purchase Details</h5><p>Supplier, document date and supplier invoice reference.</p></div></div>
          </div>
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

              <SearchableSelect
                value={form.supplierId}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    supplierId: value,
                  }))
                }
                options={suppliers}
                placeholder="Search supplier by code or name..."
                ariaLabel="Supplier"
                getOptionLabel={(supplier) => `${supplier.code} - ${supplier.name}`}
                getOptionMeta={(supplier) =>
                  [supplier.city, supplier.state].filter(Boolean).join(", ")
                }
                getOptionSearchText={(supplier) =>
                  `${supplier.phone || ""} ${supplier.alternate_phone || ""}`
                }
              />
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

      <div className="card mb-4 transaction-card transaction-lines-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 transaction-section-heading compact">
            <div><span className="transaction-step">02</span><div><h5>Purchase Items</h5><p>Quantities, rates, GST and traceability details.</p></div></div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={addLine}
            >
              + Add Item
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle entry-table">
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
                          <SearchableSelect
                            value={line.itemId}
                            onChange={(value) =>
                              handleLineChange(index, "itemId", value)
                            }
                            options={items}
                            placeholder="Search item..."
                            ariaLabel={`Purchase item row ${index + 1}`}
                            getOptionLabel={(itemOption) =>
                              `${itemOption.code} - ${itemOption.name}`
                            }
                            getOptionMeta={(itemOption) =>
                              [itemOption.category_name, itemOption.unit_code]
                                .filter(Boolean)
                                .join(" · ")
                            }
                            getOptionSearchText={(itemOption) =>
                              `${itemOption.hsn_code || ""}`
                            }
                          />
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
          <div className="card mb-4 transaction-card">
            <div className="card-body">
              <div className="transaction-mini-title">Notes & Purchase Context</div>
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
          <div className="card mb-4 transaction-card totals-card">
            <div className="card-body">
              <div className="transaction-mini-title">Charges & Purchase Total</div>
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

      <div className="transaction-action-bar">
        <div className="transaction-action-copy">
          <span>Purchase total</span>
          <strong>₹{totals.grandTotal.toFixed(2)}</strong>
          <small>{lines.length} line{lines.length === 1 ? "" : "s"} ready to post</small>
        </div>
        <button
          type="button"
          className="btn btn-success btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving Purchase..." : "Post Purchase"}
        </button>
      </div>
    </div>
  );
}

export default Purchases;