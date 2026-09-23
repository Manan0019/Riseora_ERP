import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";

const createEmptyLine = () => ({
  itemId: "",
  quantity: "",
  rate: "",
  discountAmount: "0",
  gstRate: "0",
  lotNo: "",
});

function Sales() {
  const { success: toastSuccess, error: toastError } = useUi();
  const today = new Date().toISOString().slice(0, 10);

  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [stock, setStock] = useState([]);
  const [company, setCompany] = useState(null);

  const [form, setForm] = useState({
    invoiceDate: today,
    customerId: "",
    customerReference: "",
    discountAmount: "0",
    otherCharges: "0",
    amountPaid: "0",
    paymentMode: "CASH",
    paymentReference: "",
    notes: "",
    placeOfSupply: "",
    taxType: "AUTO",
  });

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

      const [
        customerResponse,
        itemResponse,
        stockResponse,
        companyResponse,
      ] = await Promise.all([
        api.get("/customers"),
        api.get("/items"),
        api.get("/stock"),
        api.get("/company"),
      ]);

      setCustomers(
        customerResponse.data.customers || []
      );

      // Sales should normally contain finished goods only.
      const finishedGoods =
        (itemResponse.data.items || []).filter(
          (item) =>
            item.category_code === "FG"
        );

      setItems(finishedGoods);

      setStock(
        stockResponse.data.stock || []
      );

      setCompany(
        companyResponse.data.company || null
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load customers, items or stock."
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

  const handleProductChange = (
    index,
    value
  ) => {
    const selectedProduct =
      items.find(
        (item) =>
          item.id === Number(value)
      );

    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              itemId: value,
              rate: selectedProduct
                ? String(
                    Number(
                      selectedProduct.default_selling_price ||
                        0
                    )
                  )
                : "",
              gstRate: selectedProduct
                ? String(
                    Number(
                      selectedProduct.default_gst_rate ||
                        0
                    )
                  )
                : "0",
            }
          : line
      )
    );
  };

  const handleCustomerChange = (event) => {
    const value = event.target.value;
    const selectedCustomer = customers.find(
      (customer) => customer.id === Number(value)
    );

    setForm((current) => ({
      ...current,
      customerId: value,
      placeOfSupply: selectedCustomer?.state || "",
      taxType: "AUTO",
    }));
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

  const getItem = (itemId) => {
    return items.find(
      (item) =>
        item.id === Number(itemId)
    );
  };

  const getStock = (itemId) => {
    const result = stock.find(
      (item) =>
        item.id === Number(itemId)
    );

    return Number(
      result?.current_stock || 0
    );
  };

  const calculateLine = (line) => {
    const quantity =
      Number(line.quantity || 0);

    const rate =
      Number(line.rate || 0);

    const discount =
      Number(
        line.discountAmount || 0
      );

    const gstRate =
      Number(line.gstRate || 0);

    const gross =
      quantity * rate;

    const taxable =
      Math.max(
        gross - discount,
        0
      );

    const gst =
      taxable *
      (gstRate / 100);

    const total =
      taxable + gst;

    return {
      gross,
      taxable,
      gst,
      total,
    };
  };

  const totals = useMemo(() => {
    let subtotal = 0;

    const lineValues = lines.map((line) => {
      const result = calculateLine(line);
      subtotal += result.taxable;
      return { line, result };
    });

    const invoiceDiscount = Number(form.discountAmount || 0);
    const otherCharges = Number(form.otherCharges || 0);

    let gst = 0;
    for (const { line, result } of lineValues) {
      const share = subtotal > 0
        ? invoiceDiscount * (result.taxable / subtotal)
        : 0;
      const discountedTaxable = Math.max(0, result.taxable - share);
      gst += discountedTaxable * (Number(line.gstRate || 0) / 100);
    }

    const grandTotal =
      subtotal -
      invoiceDiscount +
      gst +
      otherCharges;

    const amountPaid =
      Number(
        form.amountPaid || 0
      );

    return {
      subtotal,
      gst,
      invoiceDiscount,
      otherCharges,
      grandTotal:
        Math.max(
          grandTotal,
          0
        ),
      amountPaid,
      balance:
        Math.max(
          grandTotal -
            amountPaid,
          0
        ),
    };
  }, [
    lines,
    form.discountAmount,
    form.otherCharges,
    form.amountPaid,
  ]);

  const paymentStatus =
    totals.amountPaid <= 0
      ? "UNPAID"
      : totals.amountPaid >=
          totals.grandTotal
        ? "PAID"
        : "PARTIAL";

  const validate = () => {
    if (!form.invoiceDate) {
      return "Invoice date is required.";
    }

    if (!form.customerId) {
      return "Customer is required.";
    }

    for (
      let index = 0;
      index < lines.length;
      index++
    ) {
      const line =
        lines[index];

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
        Number(line.rate) < 0
      ) {
        return `Rate cannot be negative in row ${
          index + 1
        }.`;
      }

      const available =
        getStock(
          line.itemId
        );

      if (
        quantity >
        available
      ) {
        const item =
          getItem(
            line.itemId
          );

        return `${
          item?.name ||
          `Row ${index + 1}`
        }: only ${available.toFixed(
          3
        )} available in stock.`;
      }

      const values =
        calculateLine(line);

      if (
        Number(
          line.discountAmount ||
            0
        ) >
        values.gross
      ) {
        return `Line discount cannot exceed line amount in row ${
          index + 1
        }.`;
      }
    }

    if (
      Number(
        form.discountAmount ||
          0
      ) >
      totals.subtotal
    ) {
      return "Invoice discount cannot exceed subtotal.";
    }

    if (
      Number(
        form.amountPaid ||
          0
      ) >
      totals.grandTotal
    ) {
      return "Amount paid cannot exceed grand total.";
    }

    return null;
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    const validationError =
      validate();

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    try {
      setSaving(true);

      const response =
        await api.post(
          "/sales",
          {
            invoiceDate:
              form.invoiceDate,

            customerId:
              Number(
                form.customerId
              ),

            customerReference:
              form.customerReference.trim(),

            placeOfSupply:
              form.placeOfSupply.trim(),

            taxType:
              form.taxType,

            discountAmount:
              Number(
                form.discountAmount ||
                  0
              ),

            otherCharges:
              Number(
                form.otherCharges ||
                  0
              ),

            amountPaid:
              Number(
                form.amountPaid ||
                  0
              ),

            paymentMode:
              form.paymentMode,

            paymentReference:
              form.paymentReference.trim(),

            notes:
              form.notes.trim(),

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

                rate:
                  Number(
                    line.rate
                  ),

                discountAmount:
                  Number(
                    line.discountAmount ||
                      0
                  ),

                gstRate:
                  Number(
                    line.gstRate ||
                      0
                  ),

                lotNo:
                  line.lotNo.trim(),
              })
            ),
          }
        );

      const successMessage = `Invoice ${response.data.sale.invoiceNo} saved successfully.`;
      setMessage(successMessage);
      toastSuccess(successMessage, "Sales invoice posted");

      setForm({
        invoiceDate: today,
        customerId: "",
        customerReference: "",
        discountAmount: "0",
        otherCharges: "0",
        amountPaid: "0",
        paymentMode: "CASH",
        paymentReference: "",
        notes: "",
        placeOfSupply: "",
        taxType: "AUTO",
      });

      setLines([
        createEmptyLine(),
      ]);

      await loadData();
    } catch (err) {
      console.error(err);

      const errorMessage = err.response?.data?.message || "Unable to save sales invoice.";
      setError(errorMessage);
      toastError(errorMessage, "Invoice not saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="transaction-page sales-entry-page">
      <div className="transaction-intro mb-4">
        <h2 className="mb-1">
          Sales Invoice
        </h2>

        <p className="text-muted mb-0">
          Create customer invoices and deduct finished goods stock.
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
            <div><span className="transaction-step">01</span><div><h5>Invoice & Customer</h5><p>Choose the customer and establish invoice/tax context.</p></div></div>
          </div>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label">
                Invoice Date *
              </label>

              <input
                type="date"
                className="form-control"
                name="invoiceDate"
                value={
                  form.invoiceDate
                }
                onChange={
                  handleFormChange
                }
              />
            </div>

            <div className="col-md-5 mb-3">
              <label className="form-label">
                Customer *
              </label>

              <select
                className="form-select"
                name="customerId"
                value={
                  form.customerId
                }
                onChange={
                  handleCustomerChange
                }
              >
                <option value="">
                  Select Customer
                </option>

                {customers.map(
                  (customer) => (
                    <option
                      key={
                        customer.id
                      }
                      value={
                        customer.id
                      }
                    >
                      {customer.code} -{" "}
                      {
                        customer.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                Customer Reference
              </label>

              <input
                className="form-control"
                name="customerReference"
                value={
                  form.customerReference
                }
                onChange={
                  handleFormChange
                }
              />
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                Place of Supply
              </label>

              <input
                className="form-control"
                name="placeOfSupply"
                value={form.placeOfSupply}
                onChange={handleFormChange}
                placeholder="Defaults to customer state"
              />
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                GST Type
              </label>

              <select
                className="form-select"
                name="taxType"
                value={form.taxType}
                onChange={handleFormChange}
              >
                <option value="AUTO">
                  Auto ({company?.state || "company state"} vs customer state)
                </option>
                <option value="INTRA_STATE">CGST + SGST</option>
                <option value="INTER_STATE">IGST</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 transaction-card transaction-lines-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 transaction-section-heading compact">
            <div>
              <span className="transaction-step">02</span>
              <div>
                <h5>Sale Items</h5>
                <p>Finished goods, available stock, pricing, discount and GST.</p>
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
            <table className="table table-bordered align-middle entry-table">
              <thead className="table-light">
                <tr>
                  <th style={{ minWidth: 240 }}>
                    Product
                  </th>

                  <th>HSN</th>

                  <th>
                    Available
                  </th>

                  <th>
                    Qty
                  </th>

                  <th>
                    Unit
                  </th>

                  <th>
                    Rate
                  </th>

                  <th>
                    Discount
                  </th>

                  <th>
                    GST %
                  </th>

                  <th>
                    Taxable
                  </th>

                  <th>
                    GST
                  </th>

                  <th>
                    Total
                  </th>

                  <th>
                    Lot
                  </th>

                  <th>
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

                    const available =
                      getStock(
                        line.itemId
                      );

                    const values =
                      calculateLine(
                        line
                      );

                    const insufficient =
                      Number(
                        line.quantity ||
                          0
                      ) >
                      available;

                    return (
                      <tr
                        key={index}
                        className={
                          insufficient
                            ? "table-danger"
                            : ""
                        }
                      >
                        <td>
                          <select
                            className="form-select"
                            value={
                              line.itemId
                            }
                            onChange={(
                              event
                            ) =>
                              handleProductChange(
                                index,
                                event.target
                                  .value
                              )
                            }
                          >
                            <option value="">
                              Select Product
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
                          {item?.hsn_code || "-"}
                        </td>

                        <td>
                          {line.itemId
                            ? available.toFixed(
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
                              line.rate
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "rate",
                                event.target
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
                              line.discountAmount
                            }
                            onChange={(
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "discountAmount",
                                event.target
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
                              event
                            ) =>
                              handleLineChange(
                                index,
                                "gstRate",
                                event.target
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
                            type="text"
                            className="form-control"
                            value={
                              line.lotNo
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
        <div className="col-lg-6">
          <div className="card mb-4 transaction-card">
            <div className="card-body">
              <div className="transaction-mini-title">Notes & Customer Context</div>
              <label className="form-label">
                Notes
              </label>

              <textarea
                className="form-control"
                rows="4"
                name="notes"
                value={
                  form.notes
                }
                onChange={
                  handleFormChange
                }
              />
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card mb-4 transaction-card totals-card">
            <div className="card-body">
              <div className="transaction-mini-title">Settlement & Invoice Total</div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Invoice Discount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    name="discountAmount"
                    value={
                      form.discountAmount
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-md-6 mb-3">
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

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Amount Paid
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    name="amountPaid"
                    value={
                      form.amountPaid
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Payment Mode
                  </label>

                  <select
                    className="form-select"
                    name="paymentMode"
                    value={
                      form.paymentMode
                    }
                    onChange={
                      handleFormChange
                    }
                  >
                    <option value="CASH">
                      Cash
                    </option>

                    <option value="UPI">
                      UPI
                    </option>

                    <option value="BANK">
                      Bank Transfer
                    </option>

                    <option value="CARD">
                      Card
                    </option>

                    <option value="CHEQUE">
                      Cheque
                    </option>
                  </select>
                </div>

                <div className="col-12 mb-3">
                  <label className="form-label">
                    Payment Reference
                  </label>

                  <input
                    className="form-control"
                    name="paymentReference"
                    value={
                      form.paymentReference
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
                    <th>
                      Subtotal
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.subtotal.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Invoice Discount
                    </th>

                    <td className="text-end">
                      - ₹
                      {totals.invoiceDiscount.toFixed(
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
                    <th>
                      Other Charges
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.otherCharges.toFixed(
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

                  <tr>
                    <th>
                      Amount Paid
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.amountPaid.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Balance Due
                    </th>

                    <th className="text-end">
                      ₹
                      {totals.balance.toFixed(
                        2
                      )}
                    </th>
                  </tr>

                  <tr>
                    <th>
                      Payment Status
                    </th>

                    <td className="text-end">
                      {paymentStatus ===
                      "PAID" ? (
                        <span className="badge text-bg-success">
                          Paid
                        </span>
                      ) : paymentStatus ===
                        "PARTIAL" ? (
                        <span className="badge text-bg-warning">
                          Partial
                        </span>
                      ) : (
                        <span className="badge text-bg-danger">
                          Unpaid
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="transaction-action-bar">
        <div className="transaction-action-copy">
          <span>Invoice total</span>
          <strong>₹{totals.grandTotal.toFixed(2)}</strong>
          <small>Balance after this receipt: ₹{totals.balance.toFixed(2)}</small>
        </div>
        <button
          type="button"
          className="btn btn-success btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving Invoice..." : "Post Sales Invoice"}
        </button>
      </div>
    </div>
  );
}

export default Sales;