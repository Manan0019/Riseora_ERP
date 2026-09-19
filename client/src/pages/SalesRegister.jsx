import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";

function SalesRegister() {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const [invoices, setInvoices] =
    useState([]);

  const [selectedInvoice, setSelectedInvoice] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [paymentForm, setPaymentForm] =
    useState({
      paymentDate: today,
      amount: "",
      paymentMode: "CASH",
      referenceNo: "",
      notes: "",
    });

  const [savingPayment, setSavingPayment] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get("/sales");

      setInvoices(
        response.data.invoices || []
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load sales register."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceDetails =
    async (id) => {
      try {
        setDetailsLoading(true);
        setError("");
        setMessage("");

        const response =
          await api.get(
            `/sales/${id}`
          );

        setSelectedInvoice(
          response.data.invoice
        );

        setPaymentForm({
          paymentDate: today,
          amount: "",
          paymentMode: "CASH",
          referenceNo: "",
          notes: "",
        });
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load invoice details."
        );
      } finally {
        setDetailsLoading(false);
      }
    };

  const filteredInvoices =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return invoices;
      }

      return invoices.filter(
        (invoice) =>
          (
            invoice.invoice_no ||
            ""
          )
            .toLowerCase()
            .includes(text) ||
          (
            invoice.customer_name ||
            ""
          )
            .toLowerCase()
            .includes(text)
      );
    }, [invoices, search]);

  const handlePaymentChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setPaymentForm(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };

  const savePayment =
    async () => {
      if (!selectedInvoice) {
        return;
      }

      const amount =
        Number(
          paymentForm.amount
        );

      if (amount <= 0) {
        setError(
          "Payment amount must be greater than zero."
        );

        return;
      }

      try {
        setSavingPayment(true);
        setError("");
        setMessage("");

        await api.post(
          `/sales/${selectedInvoice.id}/payments`,
          {
            paymentDate:
              paymentForm.paymentDate,

            amount,

            paymentMode:
              paymentForm.paymentMode,

            referenceNo:
              paymentForm.referenceNo.trim(),

            notes:
              paymentForm.notes.trim(),
          }
        );

        setMessage(
          "Payment recorded successfully."
        );

        await loadInvoices();

        await loadInvoiceDetails(
          selectedInvoice.id
        );
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data?.message ||
            "Unable to record payment."
        );
      } finally {
        setSavingPayment(false);
      }
    };

const handleCancelInvoice =
  async () => {
    if (!selectedInvoice) {
      return;
    }

    if (
      selectedInvoice.status ===
      "CANCELLED"
    ) {
      setError(
        "This invoice is already cancelled."
      );

      return;
    }

    if (
      Number(
        selectedInvoice.amount_paid ||
          0
      ) > 0
    ) {
      setError(
        "This invoice has received payment and cannot be cancelled directly."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Cancel ${selectedInvoice.invoice_no}? Sold stock will be returned to inventory.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await api.patch(
        `/sales/${selectedInvoice.id}/cancel`
      );

      setMessage(
        "Sales invoice cancelled successfully."
      );

      setSelectedInvoice(null);

      await loadInvoices();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to cancel invoice."
      );
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Sales Register</h2>

          <p className="text-muted mb-0">
            Review invoices and collect customer payments.
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
                  <th>Total</th>
                  <th>Paid</th>
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
                        Number(invoice.grand_total || 0) -
                        Number(invoice.amount_paid || 0);

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

                          <td>₹{Number(invoice.grand_total).toFixed(2)}</td>

                          <td>₹{Number(invoice.amount_paid).toFixed(2)}</td>

                          <td>₹{balance.toFixed(2)}</td>

                          <td>
                            {invoice.payment_status === "PAID" ? (
                              <span className="badge text-bg-success">
                                Paid
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

      {selectedInvoice && (
        <div className="card">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Invoice Details</h5>

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

            {selectedInvoice.status !== "CANCELLED" &&
              Number(selectedInvoice.amount_paid || 0) > 0 && (
                <div className="alert alert-warning">
                  Payment has been received on this invoice. Use refund / credit
                  note flow instead of direct cancellation.
                </div>
              )}

            {detailsLoading ? (
              <p>Loading invoice details...</p>
            ) : (
              <>
                <div className="row mb-4">
                  <div className="col-md-3">
                    <strong>Invoice</strong>

                    <div>{selectedInvoice.invoice_no}</div>
                  </div>

                  <div className="col-md-3">
                    <strong>Customer</strong>

                    <div>{selectedInvoice.customer_name}</div>
                  </div>

                  <div className="col-md-2">
                    <strong>Total</strong>

                    <div>₹{Number(selectedInvoice.grand_total).toFixed(2)}</div>
                  </div>

                  <div className="col-md-2">
                    <strong>Paid</strong>

                    <div>₹{Number(selectedInvoice.amount_paid).toFixed(2)}</div>
                  </div>

                  <div className="col-md-2">
                    <strong>Balance</strong>

                    <div>
                      ₹{Number(selectedInvoice.balance_amount).toFixed(2)}
                    </div>
                  </div>
                </div>

                <h6>Invoice Items</h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>GST</th>
                        <th>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.item_code} - {item.item_name}
                          </td>

                          <td>{item.quantity}</td>

                          <td>{item.unit_code}</td>

                          <td>₹{Number(item.rate).toFixed(2)}</td>

                          <td>{item.gst_rate}%</td>

                          <td>₹{Number(item.line_total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h6>Payment History</h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Reference</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedInvoice.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.payment_date}</td>

                          <td>₹{Number(payment.amount).toFixed(2)}</td>

                          <td>{payment.payment_mode}</td>

                          <td>{payment.reference_no || "-"}</td>
                        </tr>
                      ))}

                      {selectedInvoice.payments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted">
                            No payments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedInvoice.status !== "CANCELLED" &&
                  Number(selectedInvoice.balance_amount) > 0 && (
                    <div className="border rounded p-3">
                      <h6>Receive Payment</h6>

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
                            step="0.01"
                            className="form-control"
                            name="amount"
                            value={paymentForm.amount}
                            onChange={handlePaymentChange}
                          />
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesRegister;