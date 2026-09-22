import { useEffect, useMemo, useState } from "react";

import api from "../api/api";

function SalesRegister() {
  const today = new Date().toISOString().slice(0, 10);

  const [invoices, setInvoices] = useState([]);

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [detailsLoading, setDetailsLoading] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: today,
    amount: "",
    paymentMode: "CASH",
    referenceNo: "",
    notes: "",
  });

  const [savingPayment, setSavingPayment] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [returnForm, setReturnForm] = useState(null);

  const [returnLoading, setReturnLoading] = useState(false);

  const [savingReturn, setSavingReturn] = useState(false);

  const [refundForm, setRefundForm] = useState({
    refundDate: today,
    amount: "",
    refundMode: "CASH",
    referenceNo: "",
    notes: "",
  });

  const [savingRefund, setSavingRefund] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/sales");

      setInvoices(response.data.invoices || []);
    } catch (err) {
      console.error(err);

      setError("Unable to load sales register.");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceDetails = async (id) => {
    try {
      setDetailsLoading(true);

      setError("");
      setMessage("");

      const response = await api.get(`/sales/${id}`);

      setSelectedInvoice(response.data.invoice);

      setPaymentForm({
        paymentDate: today,

        amount: "",

        paymentMode: "CASH",

        referenceNo: "",

        notes: "",
      });

      setReturnForm(null);

      setRefundForm({
        refundDate: today,
        amount: "",
        refundMode: "CASH",
        referenceNo: "",
        notes: "",
      });
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message || "Unable to load invoice details.",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) {
      return invoices;
    }

    return invoices.filter(
      (invoice) =>
        (invoice.invoice_no || "").toLowerCase().includes(text) ||
        (invoice.customer_name || "").toLowerCase().includes(text),
    );
  }, [invoices, search]);

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;

    setPaymentForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const savePayment = async () => {
    if (!selectedInvoice) {
      return;
    }

    const amount = Number(paymentForm.amount);

    if (amount <= 0) {
      setError("Payment amount must be greater than zero.");

      return;
    }

    const balance = Number(selectedInvoice.balance_amount || 0);

    if (amount > balance) {
      setError(
        `Payment cannot exceed outstanding balance of ₹${balance.toFixed(2)}.`,
      );

      return;
    }

    try {
      setSavingPayment(true);

      setError("");
      setMessage("");

      await api.post(`/sales/${selectedInvoice.id}/payments`, {
        paymentDate: paymentForm.paymentDate,

        amount,

        paymentMode: paymentForm.paymentMode,

        referenceNo: paymentForm.referenceNo.trim(),

        notes: paymentForm.notes.trim(),
      });

      setMessage("Payment recorded successfully.");

      await loadInvoices();

      await loadInvoiceDetails(selectedInvoice.id);
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.message || "Unable to record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice) {
      return;
    }

    if (selectedInvoice.status === "CANCELLED") {
      setError("This invoice is already cancelled.");

      return;
    }

    if (Number(selectedInvoice.amount_paid || 0) > 0) {
      setError(
        "This invoice has received payment and cannot be cancelled directly.",
      );

      return;
    }

    const confirmed = window.confirm(
      `Cancel ${selectedInvoice.invoice_no}? Sold stock will be returned to inventory.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await api.patch(`/sales/${selectedInvoice.id}/cancel`);

      setMessage("Sales invoice cancelled successfully.");

      setSelectedInvoice(null);

      await loadInvoices();
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.message || "Unable to cancel invoice.");
    }
  };

  const startReturn =
  async () => {
    if (
      !selectedInvoice
    ) {
      return;
    }

    try {
      setReturnLoading(true);
      setError("");
      setMessage("");

      const response =
        await api.get(
          `/sales/${selectedInvoice.id}/returnable`
        );

      const invoice =
        response.data.invoice;

      setReturnForm({
        creditNoteDate:
          today,

        reason:
          "",

        notes:
          "",

        invoice,

        items:
          invoice.items.map(
            (item) => ({
              salesItemId:
                item.sales_item_id,

              itemCode:
                item.item_code,

              itemName:
                item.item_name,

              unitCode:
                item.unit_code,

              soldQuantity:
                Number(
                  item.quantity ||
                    0
                ),

              alreadyReturned:
                Number(
                  item.returned_quantity ||
                    0
                ),

              returnableQuantity:
                Number(
                  item.returnable_quantity ||
                    0
                ),

              returnQuantity:
                "",
            })
          ),
      });
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data
          ?.message ||
          "Unable to start sales return."
      );
    } finally {
      setReturnLoading(false);
    }
  };

  const changeReturnQuantity =
  (
    index,
    value
  ) => {
    setReturnForm(
      (current) => ({
        ...current,

        items:
          current.items.map(
            (
              item,
              itemIndex
            ) =>
              itemIndex ===
              index
                ? {
                    ...item,

                    returnQuantity:
                      value,
                  }
                : item
          ),
      })
    );
  };

  const saveReturn =
  async () => {
    if (
      !selectedInvoice ||
      !returnForm
    ) {
      return;
    }

    if (
      !returnForm.reason.trim()
    ) {
      setError(
        "Return reason is required."
      );

      return;
    }

    const returnedItems =
      returnForm.items
        .filter(
          (item) =>
            Number(
              item.returnQuantity ||
                0
            ) > 0
        )
        .map(
          (item) => ({
            salesItemId:
              item.salesItemId,

            quantity:
              Number(
                item.returnQuantity
              ),
          })
        );

    if (
      returnedItems.length ===
      0
    ) {
      setError(
        "Enter return quantity for at least one product."
      );

      return;
    }

    for (
      const item of
        returnForm.items
    ) {
      const qty =
        Number(
          item.returnQuantity ||
            0
        );

      if (
        qty >
        item.returnableQuantity
      ) {
        setError(
          `${item.itemName}: return quantity cannot exceed ${item.returnableQuantity.toFixed(
            3
          )}.`
        );

        return;
      }
    }

    try {
      setSavingReturn(true);
      setError("");
      setMessage("");

      const response =
        await api.post(
          `/sales/${selectedInvoice.id}/credit-note`,
          {
            creditNoteDate:
              returnForm.creditNoteDate,

            reason:
              returnForm.reason.trim(),

            notes:
              returnForm.notes.trim(),

            items:
              returnedItems,
          }
        );

      const result =
        response.data.creditNote;

      if (
        Number(
          result.refundDue ||
            0
        ) > 0
      ) {
        setMessage(
          `${result.creditNoteNo} created successfully. Refund due: ₹${Number(
            result.refundDue
          ).toFixed(2)}.`
        );
      } else {
        setMessage(
          `${result.creditNoteNo} created successfully.`
        );
      }

      setReturnForm(
        null
      );

      await loadInvoices();

      await loadInvoiceDetails(
        selectedInvoice.id
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data
          ?.message ||
          "Unable to create credit note."
      );
    } finally {
      setSavingReturn(false);
    }
  };

  const handleRefundChange = (event) => {
    const { name, value } = event.target;
    setRefundForm((current) => ({ ...current, [name]: value }));
  };

  const saveRefund = async () => {
    if (!selectedInvoice) return;

    const amount = Number(refundForm.amount);
    const refundDue = Number(selectedInvoice.refund_due || 0);

    if (!refundForm.refundDate) {
      setError("Refund date is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Refund amount must be greater than zero.");
      return;
    }

    if (amount > refundDue) {
      setError(`Refund cannot exceed refund due of ₹${refundDue.toFixed(2)}.`);
      return;
    }

    try {
      setSavingRefund(true);
      setError("");
      setMessage("");

      const response = await api.post(`/sales/${selectedInvoice.id}/refunds`, {
        refundDate: refundForm.refundDate,
        amount,
        refundMode: refundForm.refundMode,
        referenceNo: refundForm.referenceNo.trim(),
        notes: refundForm.notes.trim(),
      });

      setMessage(`${response.data.refund.refundNo} recorded successfully.`);
      await loadInvoices();
      await loadInvoiceDetails(selectedInvoice.id);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to record refund.");
    } finally {
      setSavingRefund(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Sales Register</h2>

          <p className="text-muted mb-0">
            Review invoices, COGS, profitability and customer payments.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={loadInvoices}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {error && <div className="alert alert-danger">{error}</div>}

      {/* SALES REGISTER */}
      <div className="card mb-4">
        <div className="card-body">
          <input
            type="text"
            className="form-control mb-3"
            placeholder="Search invoice or customer..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Invoice</th>

                  <th>Date</th>

                  <th>Customer</th>

                  <th>Effective Total</th>

                  <th>Net Paid</th>

                  <th>Balance</th>

                  <th>Payment Status</th>

                  <th>Invoice Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted">
                      Loading invoices...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredInvoices.map((invoice) => {
                      const balance =
                        Number(invoice.balance_amount || 0);

                      return (
                        <tr
                          key={invoice.id}
                          onClick={() => loadInvoiceDetails(invoice.id)}
                          style={{
                            cursor: "pointer",
                          }}
                          className={
                            selectedInvoice?.id === invoice.id
                              ? "table-primary"
                              : invoice.status === "CANCELLED"
                                ? "table-secondary"
                                : ""
                          }
                        >
                          <td>{invoice.invoice_no}</td>

                          <td>{invoice.invoice_date}</td>

                          <td>{invoice.customer_name}</td>

                          <td>
                            ₹{Number(
                              invoice.effective_invoice_total ??
                                invoice.grand_total ??
                                0,
                            ).toFixed(2)}
                          </td>

                          <td>
                            ₹{Number(
                              invoice.net_amount_paid ?? invoice.amount_paid ?? 0,
                            ).toFixed(2)}
                          </td>

                          <td>₹{balance.toFixed(2)}</td>

                          <td>
                            {invoice.status === "CANCELLED" ? (
                              <span className="badge text-bg-secondary">
                                Cancelled
                              </span>
                            ) : invoice.payment_status === "PAID" ? (
                              <span className="badge text-bg-success">
                                Paid
                              </span>
                            ) : invoice.payment_status === "REFUND_DUE" ? (
                              <span className="badge text-bg-info">
                                Refund Due
                              </span>
                            ) : invoice.payment_status === "PARTIAL" ? (
                              <span className="badge text-bg-warning">
                                Partial
                              </span>
                            ) : (
                              <span className="badge text-bg-danger">
                                Unpaid
                              </span>
                            )}
                          </td>

                          <td>{invoice.status}</td>
                        </tr>
                      );
                    })}

                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-muted">
                          No sales invoices found.
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

      {/* INVOICE DETAILS */}
      {selectedInvoice && (
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex gap-2">
                {selectedInvoice.status !== "CANCELLED" && (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={startReturn}
                    disabled={returnLoading}
                  >
                    {returnLoading ? "Loading..." : "Return / Credit Note"}
                  </button>
                )}

                {selectedInvoice.status !== "CANCELLED" &&
                  Number(selectedInvoice.amount_paid || 0) === 0 && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={handleCancelInvoice}
                    >
                      Cancel Invoice
                    </button>
                  )}
              </div>
            </div>

            {selectedInvoice.status !== "CANCELLED" &&
              Number(selectedInvoice.amount_paid || 0) > 0 && (
                <div className="alert alert-warning">
                  Payment has been received on this invoice. Use refund / credit
                  note flow instead of direct cancellation.
                </div>
              )}

            {selectedInvoice.status !== "CANCELLED" &&
              Number(selectedInvoice.refund_due || 0) > 0 && (
                <div className="alert alert-info">
                  Refund due to customer: <strong>₹{Number(
                    selectedInvoice.refund_due || 0,
                  ).toFixed(2)}</strong>
                </div>
              )}

            {selectedInvoice.status === "CANCELLED" && (
              <div className="alert alert-secondary">
                This invoice has been cancelled. Its sales stock movement has
                been reversed.
              </div>
            )}

            {detailsLoading ? (
              <p>Loading invoice details...</p>
            ) : (
              <>
                {/* BASIC INVOICE SUMMARY */}
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Invoice</div>

                      <div className="fw-semibold">
                        {selectedInvoice.invoice_no}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-3">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Customer</div>

                      <div className="fw-semibold">
                        {selectedInvoice.customer_name}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-2">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Effective Total</div>

                      <div className="fw-semibold">
                        ₹{Number(
                          selectedInvoice.effective_invoice_total ??
                            selectedInvoice.grand_total ??
                            0,
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-2">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Net Paid</div>

                      <div className="fw-semibold">
                        ₹{Number(
                          selectedInvoice.net_amount_paid ??
                            selectedInvoice.amount_paid ??
                            0,
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-2">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small">Balance</div>

                      <div className="fw-semibold">
                        ₹
                        {(selectedInvoice.status === "CANCELLED"
                          ? 0
                          : Number(selectedInvoice.balance_amount || 0)
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PROFITABILITY */}
                {selectedInvoice.status === "POSTED" && (
                  <>
                    <h6 className="mb-3">Sales Profitability</h6>

                    <div className="row g-3 mb-4">
                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Net Sales</div>

                          <div className="fw-bold fs-5">
                            ₹{Number(selectedInvoice.net_sales || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">COGS</div>

                          <div className="fw-bold fs-5">
                            ₹
                            {Number(selectedInvoice.total_cogs || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Gross Profit</div>

                          <div className="fw-bold fs-5">
                            ₹
                            {Number(selectedInvoice.gross_profit || 0).toFixed(
                              2,
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-3">
                        <div className="border rounded p-3 h-100">
                          <div className="text-muted small">Gross Margin</div>

                          <div className="fw-bold fs-5">
                            {Number(
                              selectedInvoice.gross_margin_percent || 0,
                            ).toFixed(2)}
                            %
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* INVOICE ITEMS */}
                <h6>Invoice Items</h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>

                        <th>Qty</th>

                        <th>Unit</th>

                        <th>Rate</th>

                        <th>Discount</th>

                        <th>Net Sales</th>

                        <th>COGS / Unit</th>

                        <th>COGS</th>

                        <th>Gross Profit</th>

                        <th>Margin %</th>

                        <th>GST</th>

                        <th>Line Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedInvoice.items?.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div>{item.item_name}</div>

                            <small className="text-muted">
                              {item.item_code}
                            </small>
                          </td>

                          <td>{Number(item.quantity || 0).toFixed(3)}</td>

                          <td>{item.unit_code}</td>

                          <td>₹{Number(item.rate || 0).toFixed(2)}</td>

                          <td>
                            ₹{Number(item.discount_amount || 0).toFixed(2)}
                          </td>

                          <td>
                            ₹{Number(item.taxable_amount || 0).toFixed(2)}
                          </td>

                          <td>
                            ₹{Number(item.cogs_unit_cost || 0).toFixed(2)}
                          </td>

                          <td>₹{Number(item.cogs_amount || 0).toFixed(2)}</td>

                          <td>₹{Number(item.gross_profit || 0).toFixed(2)}</td>

                          <td>
                            {Number(item.gross_margin_percent || 0).toFixed(2)}%
                          </td>

                          <td>{Number(item.gst_rate || 0).toFixed(2)}%</td>

                          <td>₹{Number(item.line_total || 0).toFixed(2)}</td>
                        </tr>
                      ))}

                      {(!selectedInvoice.items ||
                        selectedInvoice.items.length === 0) && (
                        <tr>
                          <td colSpan={12} className="text-center text-muted">
                            No invoice items found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {returnForm && (
                  <div className="border rounded p-3 mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <h6 className="mb-1">Sales Return / Credit Note</h6>

                        <div className="text-muted small">
                          Invoice {selectedInvoice.invoice_no}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-close"
                        onClick={() => setReturnForm(null)}
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-3 mb-3">
                        <label className="form-label">Credit Note Date</label>

                        <input
                          type="date"
                          className="form-control"
                          value={returnForm.creditNoteDate}
                          onChange={(event) =>
                            setReturnForm((current) => ({
                              ...current,

                              creditNoteDate: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="col-md-4 mb-3">
                        <label className="form-label">Return Reason *</label>

                        <input
                          type="text"
                          className="form-control"
                          value={returnForm.reason}
                          onChange={(event) =>
                            setReturnForm((current) => ({
                              ...current,

                              reason: event.target.value,
                            }))
                          }
                          placeholder="Damaged / customer return / wrong item..."
                        />
                      </div>

                      <div className="col-md-5 mb-3">
                        <label className="form-label">Notes</label>

                        <input
                          type="text"
                          className="form-control"
                          value={returnForm.notes}
                          onChange={(event) =>
                            setReturnForm((current) => ({
                              ...current,

                              notes: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="table-responsive mb-3">
                      <table className="table table-bordered align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Product</th>

                            <th>Sold</th>

                            <th>Already Returned</th>

                            <th>Available to Return</th>

                            <th>Return Qty</th>

                            <th>Unit</th>
                          </tr>
                        </thead>

                        <tbody>
                          {returnForm.items.map((item, index) => (
                            <tr key={item.salesItemId}>
                              <td>
                                {item.itemCode}
                                {" - "}
                                {item.itemName}
                              </td>

                              <td>{item.soldQuantity.toFixed(3)}</td>

                              <td>{item.alreadyReturned.toFixed(3)}</td>

                              <td>{item.returnableQuantity.toFixed(3)}</td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.returnableQuantity}
                                  step="0.001"
                                  className="form-control"
                                  value={item.returnQuantity}
                                  disabled={item.returnableQuantity <= 0}
                                  onChange={(event) =>
                                    changeReturnQuantity(
                                      index,
                                      event.target.value,
                                    )
                                  }
                                />
                              </td>

                              <td>{item.unitCode}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={saveReturn}
                        disabled={savingReturn}
                      >
                        {savingReturn ? "Posting..." : "Post Credit Note"}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setReturnForm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* CREDIT NOTES */}
                <h6>Credit Note History</h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Credit Note</th>
                        <th>Reason</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.credit_notes?.map((credit) => (
                        <tr key={credit.id}>
                          <td>{credit.credit_note_date}</td>
                          <td>{credit.credit_note_no}</td>
                          <td>{credit.reason}</td>
                          <td>₹{Number(credit.grand_total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(!selectedInvoice.credit_notes ||
                        selectedInvoice.credit_notes.length === 0) && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted">
                            No credit notes recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* REFUNDS */}
                <h6>Refund History</h6>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Refund No.</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.refunds?.map((refund) => (
                        <tr key={refund.id}>
                          <td>{refund.refund_date}</td>
                          <td>{refund.refund_no}</td>
                          <td>₹{Number(refund.amount || 0).toFixed(2)}</td>
                          <td>{refund.refund_mode}</td>
                          <td>{refund.reference_no || "-"}</td>
                        </tr>
                      ))}
                      {(!selectedInvoice.refunds ||
                        selectedInvoice.refunds.length === 0) && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">
                            No refunds recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAYMENT HISTORY */}
                <h6>Payment History</h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>

                        <th>Amount</th>

                        <th>Mode</th>

                        <th>Reference</th>

                        <th>Notes</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedInvoice.payments?.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.payment_date}</td>

                          <td>₹{Number(payment.amount || 0).toFixed(2)}</td>

                          <td>{payment.payment_mode}</td>

                          <td>{payment.reference_no || "-"}</td>

                          <td>{payment.notes || "-"}</td>
                        </tr>
                      ))}

                      {(!selectedInvoice.payments ||
                        selectedInvoice.payments.length === 0) && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">
                            No payments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedInvoice.status !== "CANCELLED" &&
                  Number(selectedInvoice.refund_due || 0) > 0 && (
                    <div className="border rounded p-3 mb-4">
                      <h6 className="mb-3">Record Customer Refund</h6>
                      <div className="row">
                        <div className="col-md-3 mb-3">
                          <label className="form-label">Date</label>
                          <input
                            type="date"
                            className="form-control"
                            name="refundDate"
                            value={refundForm.refundDate}
                            onChange={handleRefundChange}
                          />
                        </div>
                        <div className="col-md-3 mb-3">
                          <label className="form-label">Amount</label>
                          <input
                            type="number"
                            min="0"
                            max={selectedInvoice.refund_due}
                            step="0.01"
                            className="form-control"
                            name="amount"
                            value={refundForm.amount}
                            onChange={handleRefundChange}
                          />
                          <div className="form-text">
                            Refund due: ₹{Number(selectedInvoice.refund_due || 0).toFixed(2)}
                          </div>
                        </div>
                        <div className="col-md-3 mb-3">
                          <label className="form-label">Mode</label>
                          <select
                            className="form-select"
                            name="refundMode"
                            value={refundForm.refundMode}
                            onChange={handleRefundChange}
                          >
                            <option value="CASH">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="BANK">Bank Transfer</option>
                            <option value="CARD">Card</option>
                            <option value="CHEQUE">Cheque</option>
                          </select>
                        </div>
                        <div className="col-md-3 mb-3">
                          <label className="form-label">Reference</label>
                          <input
                            className="form-control"
                            name="referenceNo"
                            value={refundForm.referenceNo}
                            onChange={handleRefundChange}
                          />
                        </div>
                        <div className="col-12 mb-3">
                          <label className="form-label">Notes</label>
                          <input
                            className="form-control"
                            name="notes"
                            value={refundForm.notes}
                            onChange={handleRefundChange}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-warning"
                        onClick={saveRefund}
                        disabled={savingRefund}
                      >
                        {savingRefund ? "Saving..." : "Record Refund"}
                      </button>
                    </div>
                  )}

                {/* RECEIVE PAYMENT */}
                {selectedInvoice.status !== "CANCELLED" &&
                  Number(selectedInvoice.balance_amount || 0) > 0 && (
                    <div className="border rounded p-3">
                      <h6 className="mb-3">Receive Payment</h6>

                      <div className="row">
                        <div className="col-md-3 mb-3">
                          <label className="form-label">Date</label>

                          <input
                            type="date"
                            className="form-control"
                            name="paymentDate"
                            value={paymentForm.paymentDate}
                            onChange={handlePaymentChange}
                          />
                        </div>

                        <div className="col-md-3 mb-3">
                          <label className="form-label">Amount</label>

                          <input
                            type="number"
                            min="0"
                            max={selectedInvoice.balance_amount}
                            step="0.01"
                            className="form-control"
                            name="amount"
                            value={paymentForm.amount}
                            onChange={handlePaymentChange}
                          />

                          <div className="form-text">
                            Outstanding: ₹
                            {Number(
                              selectedInvoice.balance_amount || 0,
                            ).toFixed(2)}
                          </div>
                        </div>

                        <div className="col-md-3 mb-3">
                          <label className="form-label">Mode</label>

                          <select
                            className="form-select"
                            name="paymentMode"
                            value={paymentForm.paymentMode}
                            onChange={handlePaymentChange}
                          >
                            <option value="CASH">Cash</option>

                            <option value="UPI">UPI</option>

                            <option value="BANK">Bank Transfer</option>

                            <option value="CARD">Card</option>

                            <option value="CHEQUE">Cheque</option>
                          </select>
                        </div>

                        <div className="col-md-3 mb-3">
                          <label className="form-label">Reference</label>

                          <input
                            className="form-control"
                            name="referenceNo"
                            value={paymentForm.referenceNo}
                            onChange={handlePaymentChange}
                            placeholder="UPI / bank / cheque reference"
                          />
                        </div>

                        <div className="col-12 mb-3">
                          <label className="form-label">Notes</label>

                          <input
                            className="form-control"
                            name="notes"
                            value={paymentForm.notes}
                            onChange={handlePaymentChange}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={savePayment}
                        disabled={savingPayment}
                      >
                        {savingPayment ? "Saving..." : "Receive Payment"}
                      </button>
                    </div>
                  )}

                {selectedInvoice.status !== "CANCELLED" &&
                  Number(selectedInvoice.balance_amount || 0) === 0 &&
                  Number(selectedInvoice.refund_due || 0) === 0 && (
                    <div className="alert alert-success mb-0">
                      This invoice is fully paid.
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesRegister;
