import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
}).format(Number(value || 0));

function transactionBadge(type) {
  const map = {
    OPENING_BALANCE: ["Opening Balance", "text-bg-dark"],
    OPENING_RECEIPT: ["Opening Receipt", "text-bg-success"],
    OPENING_REFUND: ["Opening Refund", "text-bg-info"],
    INVOICE: ["Invoice", "text-bg-primary"],
    PAYMENT: ["Payment", "text-bg-success"],
    CREDIT_NOTE: ["Credit Note", "text-bg-warning"],
    REFUND: ["Refund", "text-bg-info"],
  };
  const [label, cls] = map[type] || [type, "text-bg-secondary"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function CustomerLedger() {
  const today = new Date().toISOString().slice(0, 10);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingOpeningSettlement, setSavingOpeningSettlement] = useState(false);
  const [openingSettlementForm, setOpeningSettlementForm] = useState({
    settlementDate: today,
    amount: "",
    paymentMode: "CASH",
    referenceNo: "",
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadCustomers(); }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/customer-ledger");
      setCustomers(response.data.customers || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load customer outstanding.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerLedger(customer, { preserveMessage = false } = {}) {
    try {
      setSelectedCustomer(customer);
      setDetailsLoading(true);
      setError("");
      if (!preserveMessage) setMessage("");
      const response = await api.get(`/customer-ledger/${customer.customer_id}`);
      setLedgerData(response.data);
      setOpeningSettlementForm({
        settlementDate: today,
        amount: "",
        paymentMode: "CASH",
        referenceNo: "",
        notes: "",
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load customer ledger.");
    } finally {
      setDetailsLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return customers;
    return customers.filter((customer) =>
      (customer.customer_code || "").toLowerCase().includes(text) ||
      (customer.customer_name || "").toLowerCase().includes(text) ||
      (customer.phone || "").toLowerCase().includes(text),
    );
  }, [customers, search]);

  const totalOutstanding = useMemo(
    () => customers.reduce((total, customer) => total + Number(customer.outstanding || 0), 0),
    [customers],
  );

  const opening = ledgerData?.openingBalance;
  const openingRemaining = Number(opening?.remaining_signed || 0);
  const openingSettlementType = openingRemaining > 0 ? "RECEIPT" : "REFUND";

  async function saveOpeningSettlement() {
    if (!selectedCustomer || !opening || Math.abs(openingRemaining) < 0.000001) return;
    const amount = Number(openingSettlementForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Settlement amount must be greater than zero.");
      return;
    }
    if (amount > Math.abs(openingRemaining) + 0.000001) {
      setError(`Settlement cannot exceed ${money(Math.abs(openingRemaining))}.`);
      return;
    }

    try {
      setSavingOpeningSettlement(true);
      setError("");
      setMessage("");
      const response = await api.post(
        `/opening-balances/customers/${selectedCustomer.customer_id}/settlements`,
        {
          settlementDate: openingSettlementForm.settlementDate,
          settlementType: openingSettlementType,
          amount,
          paymentMode: openingSettlementForm.paymentMode,
          referenceNo: openingSettlementForm.referenceNo.trim(),
          notes: openingSettlementForm.notes.trim(),
        },
      );
      setMessage(response.data.message || "Opening balance settlement recorded successfully.");
      await loadCustomers();
      await loadCustomerLedger(selectedCustomer, { preserveMessage: true });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to record opening balance settlement.");
    } finally {
      setSavingOpeningSettlement(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Customer Ledger</h2>
          <p className="text-muted mb-0">Opening balances, sales, payments, credit notes, refunds and customer outstanding.</p>
        </div>
        <div className="text-end">
          <div className="text-muted small">Net Customer Outstanding</div>
          <div className="fw-bold fs-5">{money(totalOutstanding)}</div>
          <div className="small text-muted">Negative values represent customer credit/advance.</div>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Customers</h5>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadCustomers} disabled={loading}>Refresh</button>
          </div>

          <input className="form-control mb-3" placeholder="Search customer code, name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th><th>Customer</th><th>Status</th><th>Opening Balance</th><th>Net Sales</th><th>Net Paid</th><th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-muted">Loading customers...</td></tr>
                ) : filteredCustomers.map((customer) => (
                  <tr
                    key={customer.customer_id}
                    onClick={() => loadCustomerLedger(customer)}
                    style={{ cursor: "pointer" }}
                    className={selectedCustomer?.customer_id === customer.customer_id ? "table-primary" : ""}
                  >
                    <td>{customer.customer_code}</td>
                    <td>{customer.customer_name}</td>
                    <td>{Number(customer.is_active) === 1 ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                    <td>{money(customer.opening_balance)}</td>
                    <td>{money(customer.total_sales)}</td>
                    <td>{money(customer.total_paid)}</td>
                    <td><strong>{money(customer.outstanding)}</strong><div className="small text-muted">{Number(customer.outstanding || 0) < 0 ? "Customer Credit" : "Receivable"}</div></td>
                  </tr>
                ))}
                {!loading && filteredCustomers.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No customers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedCustomer && (
        <div className="card">
          <div className="card-body">
            {detailsLoading ? <p>Loading customer ledger...</p> : ledgerData ? (
              <>
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <div>
                    <h5 className="mb-1">{ledgerData.customer.code} - {ledgerData.customer.name}</h5>
                    <div className="text-muted">{ledgerData.customer.customer_type} {Number(ledgerData.customer.is_active) === 0 ? "• Inactive" : ""}</div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted small">Current Balance</div>
                    <div className="fw-bold fs-5">{money(ledgerData.summary.outstanding)}</div>
                    <div className="small text-muted">{Number(ledgerData.summary.outstanding || 0) < 0 ? "Customer Credit / Advance" : "Receivable"}</div>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  {[
                    ["Opening Remaining", ledgerData.summary.openingBalance],
                    ["Gross Sales", ledgerData.summary.totalSales],
                    ["Credit Notes", ledgerData.summary.totalCredits],
                    ["Net Sales", ledgerData.summary.netSales],
                    ["Payments", ledgerData.summary.totalPayments],
                    ["Refunds", ledgerData.summary.totalRefunds],
                    ["Net Paid", ledgerData.summary.netPaid],
                    ["Outstanding", ledgerData.summary.outstanding],
                  ].map(([label, value]) => (
                    <div className="col-md-3" key={label}><div className="border rounded p-3 h-100"><div className="text-muted small">{label}</div><strong>{money(value)}</strong></div></div>
                  ))}
                </div>

                {opening && Number(opening.remaining_amount || 0) > 0 && (
                  <div className="border rounded p-3 mb-4">
                    <h6 className="mb-1">Settle Opening Balance</h6>
                    <div className="text-muted small mb-3">
                      Remaining: <strong>{money(opening.remaining_amount)}</strong> • {opening.remaining_type === "RECEIVABLE" ? "Receive money from customer" : "Refund customer opening advance/credit"}
                    </div>
                    <div className="row g-3">
                      <div className="col-md-2"><label className="form-label">Date</label><input type="date" className="form-control" value={openingSettlementForm.settlementDate} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, settlementDate: e.target.value }))} /></div>
                      <div className="col-md-2"><label className="form-label">Amount</label><input type="number" min="0" max={opening.remaining_amount} step="0.01" className="form-control" value={openingSettlementForm.amount} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, amount: e.target.value }))} /></div>
                      <div className="col-md-2"><label className="form-label">Mode</label><select className="form-select" value={openingSettlementForm.paymentMode} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, paymentMode: e.target.value }))}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></select></div>
                      <div className="col-md-3"><label className="form-label">Reference</label><input className="form-control" value={openingSettlementForm.referenceNo} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, referenceNo: e.target.value }))} /></div>
                      <div className="col-md-3"><label className="form-label">Notes</label><input className="form-control" value={openingSettlementForm.notes} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, notes: e.target.value }))} /></div>
                    </div>
                    <button type="button" className={`btn mt-3 ${openingSettlementType === "RECEIPT" ? "btn-success" : "btn-warning"}`} onClick={saveOpeningSettlement} disabled={savingOpeningSettlement}>
                      {savingOpeningSettlement ? "Saving..." : openingSettlementType === "RECEIPT" ? "Receive Opening Balance" : "Refund Opening Credit"}
                    </button>
                  </div>
                )}

                <h6>Customer Ledger</h6>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light"><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Notes</th></tr></thead>
                    <tbody>
                      {ledgerData.ledger.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{transaction.transactionDate}</td><td>{transactionBadge(transaction.transactionType)}</td><td>{transaction.referenceNo || "-"}</td>
                          <td>{Number(transaction.debit || 0) > 0 ? money(transaction.debit) : "-"}</td><td>{Number(transaction.credit || 0) > 0 ? money(transaction.credit) : "-"}</td>
                          <td><strong>{money(transaction.balance)}</strong></td><td>{transaction.notes || "-"}</td>
                        </tr>
                      ))}
                      {ledgerData.ledger.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No customer transactions found.</td></tr>}
                    </tbody>
                  </table>
                </div>

                <h6>Invoice Summary</h6>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered"><thead className="table-light"><tr><th>Invoice</th><th>Date</th><th>Due Date</th><th>Original Total</th><th>Credits</th><th>Effective Total</th><th>Net Paid</th><th>Balance</th><th>Status</th></tr></thead>
                    <tbody>{ledgerData.invoices.map((invoice) => <tr key={invoice.id} className={invoice.status === "CANCELLED" ? "table-secondary" : ""}><td>{invoice.invoice_no}</td><td>{invoice.invoice_date}</td><td>{invoice.due_date || "-"}</td><td>{money(invoice.grand_total)}</td><td>{money(invoice.credited_amount)}</td><td>{money(invoice.effective_total)}</td><td>{money(invoice.net_paid)}</td><td>{money(invoice.balance_amount)}</td><td>{invoice.status} / {invoice.payment_status}</td></tr>)}</tbody>
                  </table>
                </div>

                <div className="row g-4">
                  <div className="col-xl-4"><h6>Credit Notes</h6><div className="table-responsive"><table className="table table-bordered table-sm"><thead><tr><th>Date</th><th>Credit Note</th><th>Amount</th></tr></thead><tbody>{ledgerData.creditNotes.map((entry) => <tr key={entry.id}><td>{entry.credit_note_date}</td><td>{entry.credit_note_no}</td><td>{money(entry.grand_total)}</td></tr>)}{ledgerData.creditNotes.length === 0 && <tr><td colSpan={3} className="text-center text-muted">None</td></tr>}</tbody></table></div></div>
                  <div className="col-xl-4"><h6>Payments</h6><div className="table-responsive"><table className="table table-bordered table-sm"><thead><tr><th>Date</th><th>Invoice</th><th>Amount</th></tr></thead><tbody>{ledgerData.payments.map((entry) => <tr key={entry.id}><td>{entry.payment_date}</td><td>{entry.invoice_no}</td><td>{money(entry.amount)}</td></tr>)}{ledgerData.payments.length === 0 && <tr><td colSpan={3} className="text-center text-muted">None</td></tr>}</tbody></table></div></div>
                  <div className="col-xl-4"><h6>Refunds</h6><div className="table-responsive"><table className="table table-bordered table-sm"><thead><tr><th>Date</th><th>Refund</th><th>Amount</th></tr></thead><tbody>{ledgerData.refunds.map((entry) => <tr key={entry.id}><td>{entry.refund_date}</td><td>{entry.refund_no}</td><td>{money(entry.amount)}</td></tr>)}{ledgerData.refunds.length === 0 && <tr><td colSpan={3} className="text-center text-muted">None</td></tr>}</tbody></table></div></div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerLedger;
