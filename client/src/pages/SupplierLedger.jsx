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
    OPENING_PAYMENT: ["Opening Payment", "text-bg-success"],
    OPENING_RECEIPT: ["Opening Receipt", "text-bg-info"],
    PURCHASE: ["Purchase", "text-bg-primary"],
    PAYMENT: ["Payment", "text-bg-success"],
  };
  const [label, cls] = map[type] || [type, "text-bg-secondary"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function SupplierLedger() {
  const today = new Date().toISOString().slice(0, 10);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [paymentForm, setPaymentForm] = useState({ paymentDate: today, amount: "", paymentMode: "CASH", referenceNo: "", notes: "" });
  const [openingSettlementForm, setOpeningSettlementForm] = useState({ settlementDate: today, amount: "", paymentMode: "CASH", referenceNo: "", notes: "" });
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingOpeningSettlement, setSavingOpeningSettlement] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadSuppliers(); }, []);

  async function loadSuppliers() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/supplier-ledger");
      setSuppliers(response.data.suppliers || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load supplier outstanding.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierLedger(supplier, { preserveMessage = false } = {}) {
    try {
      setSelectedSupplier(supplier);
      setDetailsLoading(true);
      setError("");
      if (!preserveMessage) setMessage("");
      const response = await api.get(`/supplier-ledger/${supplier.supplier_id}`);
      setLedgerData(response.data);
      setSelectedPurchaseId("");
      setPaymentForm({ paymentDate: today, amount: "", paymentMode: "CASH", referenceNo: "", notes: "" });
      setOpeningSettlementForm({ settlementDate: today, amount: "", paymentMode: "CASH", referenceNo: "", notes: "" });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load supplier ledger.");
    } finally {
      setDetailsLoading(false);
    }
  }

  const filteredSuppliers = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return suppliers;
    return suppliers.filter((supplier) =>
      (supplier.supplier_code || "").toLowerCase().includes(text) ||
      (supplier.supplier_name || "").toLowerCase().includes(text) ||
      (supplier.phone || "").toLowerCase().includes(text),
    );
  }, [suppliers, search]);

  const totalOutstanding = useMemo(
    () => suppliers.reduce((total, supplier) => total + Number(supplier.outstanding || 0), 0),
    [suppliers],
  );

  const openPurchases = useMemo(() => {
    if (!ledgerData) return [];
    return ledgerData.purchases.filter((purchase) =>
      purchase.status === "POSTED" && Number(purchase.grand_total || 0) - Number(purchase.amount_paid || 0) > 0.000001,
    );
  }, [ledgerData]);

  const selectedPurchase = useMemo(() => {
    if (!ledgerData || !selectedPurchaseId) return null;
    return ledgerData.purchases.find((purchase) => purchase.id === Number(selectedPurchaseId)) || null;
  }, [ledgerData, selectedPurchaseId]);

  const selectedPurchaseBalance = selectedPurchase
    ? Number(selectedPurchase.grand_total || 0) - Number(selectedPurchase.amount_paid || 0)
    : 0;

  const opening = ledgerData?.openingBalance;
  const openingRemaining = Number(opening?.remaining_signed || 0);
  const openingSettlementType = openingRemaining > 0 ? "PAYMENT" : "RECEIPT";

  async function savePayment() {
    if (!selectedPurchaseId) {
      setError("Please select a purchase.");
      return;
    }
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }
    if (amount > selectedPurchaseBalance + 0.000001) {
      setError(`Payment cannot exceed ${money(selectedPurchaseBalance)}.`);
      return;
    }

    try {
      setSavingPayment(true);
      setError("");
      setMessage("");
      const response = await api.post(`/supplier-ledger/purchase/${selectedPurchaseId}/payments`, {
        paymentDate: paymentForm.paymentDate,
        amount,
        paymentMode: paymentForm.paymentMode,
        referenceNo: paymentForm.referenceNo.trim(),
        notes: paymentForm.notes.trim(),
      });
      setMessage(response.data.message || "Supplier payment recorded successfully.");
      await loadSuppliers();
      await loadSupplierLedger(selectedSupplier, { preserveMessage: true });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to record supplier payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function saveOpeningSettlement() {
    if (!selectedSupplier || !opening || Math.abs(openingRemaining) < 0.000001) return;
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
      const response = await api.post(`/opening-balances/suppliers/${selectedSupplier.supplier_id}/settlements`, {
        settlementDate: openingSettlementForm.settlementDate,
        settlementType: openingSettlementType,
        amount,
        paymentMode: openingSettlementForm.paymentMode,
        referenceNo: openingSettlementForm.referenceNo.trim(),
        notes: openingSettlementForm.notes.trim(),
      });
      setMessage(response.data.message || "Opening balance settlement recorded successfully.");
      await loadSuppliers();
      await loadSupplierLedger(selectedSupplier, { preserveMessage: true });
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
          <h2 className="mb-1">Supplier Ledger</h2>
          <p className="text-muted mb-0">Opening balances, purchases, supplier payments and payable balances.</p>
        </div>
        <div className="text-end">
          <div className="text-muted small">Net Supplier Outstanding</div>
          <div className="fw-bold fs-5">{money(totalOutstanding)}</div>
          <div className="small text-muted">Negative values represent supplier advances/debits.</div>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Suppliers</h5><button type="button" className="btn btn-outline-primary btn-sm" onClick={loadSuppliers} disabled={loading}>Refresh</button></div>
          <input className="form-control mb-3" placeholder="Search supplier code, name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light"><tr><th>Code</th><th>Supplier</th><th>Status</th><th>Opening Balance</th><th>Purchases</th><th>Paid</th><th>Outstanding</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="text-center text-muted">Loading suppliers...</td></tr> : filteredSuppliers.map((supplier) => (
                  <tr key={supplier.supplier_id} onClick={() => loadSupplierLedger(supplier)} style={{ cursor: "pointer" }} className={selectedSupplier?.supplier_id === supplier.supplier_id ? "table-primary" : ""}>
                    <td>{supplier.supplier_code}</td><td>{supplier.supplier_name}</td>
                    <td>{Number(supplier.is_active) === 1 ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                    <td>{money(supplier.opening_balance)}</td><td>{money(supplier.total_purchases)}</td><td>{money(supplier.total_paid)}</td>
                    <td><strong>{money(supplier.outstanding)}</strong><div className="small text-muted">{Number(supplier.outstanding || 0) < 0 ? "Supplier Advance" : "Payable"}</div></td>
                  </tr>
                ))}
                {!loading && filteredSuppliers.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No suppliers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedSupplier && (
        <div className="card">
          <div className="card-body">
            {detailsLoading ? <p>Loading supplier ledger...</p> : ledgerData ? (
              <>
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <div><h5 className="mb-1">{ledgerData.supplier.code} - {ledgerData.supplier.name}</h5><div className="text-muted">{Number(ledgerData.supplier.is_active) === 0 ? "Inactive supplier" : "Active supplier"}</div></div>
                  <div className="text-end"><div className="text-muted small">Current Balance</div><div className="fw-bold fs-5">{money(ledgerData.summary.outstanding)}</div><div className="small text-muted">{Number(ledgerData.summary.outstanding || 0) < 0 ? "Supplier Advance / Debit" : "Payable"}</div></div>
                </div>

                <div className="row g-3 mb-4">
                  {[
                    ["Opening Remaining", ledgerData.summary.openingBalance],
                    ["Total Purchases", ledgerData.summary.totalPurchases],
                    ["Purchase Payments", ledgerData.summary.totalPaid],
                    ["Outstanding", ledgerData.summary.outstanding],
                  ].map(([label, value]) => <div className="col-md-3" key={label}><div className="border rounded p-3 h-100"><div className="text-muted small">{label}</div><strong>{money(value)}</strong></div></div>)}
                </div>

                {opening && Number(opening.remaining_amount || 0) > 0 && (
                  <div className="border rounded p-3 mb-4">
                    <h6 className="mb-1">Settle Opening Balance</h6>
                    <div className="text-muted small mb-3">Remaining: <strong>{money(opening.remaining_amount)}</strong> • {opening.remaining_type === "PAYABLE" ? "Pay supplier" : "Receive supplier advance/debit back"}</div>
                    <div className="row g-3">
                      <div className="col-md-2"><label className="form-label">Date</label><input type="date" className="form-control" value={openingSettlementForm.settlementDate} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, settlementDate: e.target.value }))} /></div>
                      <div className="col-md-2"><label className="form-label">Amount</label><input type="number" min="0" max={opening.remaining_amount} step="0.01" className="form-control" value={openingSettlementForm.amount} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, amount: e.target.value }))} /></div>
                      <div className="col-md-2"><label className="form-label">Mode</label><select className="form-select" value={openingSettlementForm.paymentMode} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, paymentMode: e.target.value }))}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></select></div>
                      <div className="col-md-3"><label className="form-label">Reference</label><input className="form-control" value={openingSettlementForm.referenceNo} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, referenceNo: e.target.value }))} /></div>
                      <div className="col-md-3"><label className="form-label">Notes</label><input className="form-control" value={openingSettlementForm.notes} onChange={(e) => setOpeningSettlementForm((c) => ({ ...c, notes: e.target.value }))} /></div>
                    </div>
                    <button type="button" className={`btn mt-3 ${openingSettlementType === "PAYMENT" ? "btn-success" : "btn-info"}`} onClick={saveOpeningSettlement} disabled={savingOpeningSettlement}>
                      {savingOpeningSettlement ? "Saving..." : openingSettlementType === "PAYMENT" ? "Pay Opening Balance" : "Receive Opening Advance"}
                    </button>
                  </div>
                )}

                <h6>Supplier Ledger</h6>
                <div className="table-responsive mb-4"><table className="table table-bordered align-middle"><thead className="table-light"><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Notes</th></tr></thead><tbody>
                  {ledgerData.ledger.map((transaction) => <tr key={transaction.id}><td>{transaction.transactionDate}</td><td>{transactionBadge(transaction.transactionType)}</td><td>{transaction.referenceNo || "-"}</td><td>{Number(transaction.debit || 0) > 0 ? money(transaction.debit) : "-"}</td><td>{Number(transaction.credit || 0) > 0 ? money(transaction.credit) : "-"}</td><td><strong>{money(transaction.balance)}</strong></td><td>{transaction.notes || "-"}</td></tr>)}
                  {ledgerData.ledger.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No supplier transactions found.</td></tr>}
                </tbody></table></div>

                {openPurchases.length > 0 ? (
                  <div className="border rounded p-3 mb-4">
                    <h6 className="mb-3">Record Purchase Payment</h6>
                    <div className="row g-3">
                      <div className="col-md-3"><label className="form-label">Purchase</label><select className="form-select" value={selectedPurchaseId} onChange={(e) => { setSelectedPurchaseId(e.target.value); setPaymentForm((c) => ({ ...c, amount: "" })); }}><option value="">Select purchase</option>{openPurchases.map((purchase) => { const balance = Number(purchase.grand_total || 0) - Number(purchase.amount_paid || 0); return <option key={purchase.id} value={purchase.id}>{purchase.purchase_no} - {money(balance)}</option>; })}</select></div>
                      <div className="col-md-2"><label className="form-label">Date</label><input type="date" className="form-control" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((c) => ({ ...c, paymentDate: e.target.value }))} /></div>
                      <div className="col-md-2"><label className="form-label">Amount</label><input type="number" min="0" max={selectedPurchaseBalance || undefined} step="0.01" className="form-control" value={paymentForm.amount} onChange={(e) => setPaymentForm((c) => ({ ...c, amount: e.target.value }))} disabled={!selectedPurchaseId} /></div>
                      <div className="col-md-2"><label className="form-label">Mode</label><select className="form-select" value={paymentForm.paymentMode} onChange={(e) => setPaymentForm((c) => ({ ...c, paymentMode: e.target.value }))}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option></select></div>
                      <div className="col-md-3"><label className="form-label">Reference</label><input className="form-control" value={paymentForm.referenceNo} onChange={(e) => setPaymentForm((c) => ({ ...c, referenceNo: e.target.value }))} /></div>
                      <div className="col-12"><label className="form-label">Notes</label><input className="form-control" value={paymentForm.notes} onChange={(e) => setPaymentForm((c) => ({ ...c, notes: e.target.value }))} /></div>
                    </div>
                    {selectedPurchase && <div className="form-text mt-2">Selected purchase outstanding: {money(selectedPurchaseBalance)}</div>}
                    <button type="button" className="btn btn-success mt-3" onClick={savePayment} disabled={savingPayment || !selectedPurchaseId}>{savingPayment ? "Saving..." : "Record Payment"}</button>
                  </div>
                ) : (
                  <div className="alert alert-secondary">No posted purchase invoice currently has an unpaid balance. Opening-balance settlements, if any, are handled separately above.</div>
                )}

                <h6>Purchase Summary</h6>
                <div className="table-responsive mb-4"><table className="table table-bordered"><thead className="table-light"><tr><th>Purchase</th><th>Date</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>
                  {ledgerData.purchases.map((purchase) => { const balance = purchase.status === "POSTED" ? Number(purchase.grand_total || 0) - Number(purchase.amount_paid || 0) : 0; return <tr key={purchase.id} className={purchase.status === "CANCELLED" ? "table-secondary" : ""}><td>{purchase.purchase_no}</td><td>{purchase.purchase_date}</td><td>{purchase.due_date || "-"}</td><td>{money(purchase.grand_total)}</td><td>{money(purchase.amount_paid)}</td><td>{money(balance)}</td><td>{purchase.status} / {purchase.payment_status}</td></tr>; })}
                </tbody></table></div>

                <h6>Payment History</h6>
                <div className="table-responsive"><table className="table table-bordered"><thead className="table-light"><tr><th>Date</th><th>Purchase</th><th>Amount</th><th>Mode</th><th>Reference</th></tr></thead><tbody>
                  {ledgerData.payments.map((payment) => <tr key={payment.id}><td>{payment.payment_date}</td><td>{payment.purchase_no}</td><td>{money(payment.amount)}</td><td>{payment.payment_mode}</td><td>{payment.reference_no || "-"}</td></tr>)}
                  {ledgerData.payments.length === 0 && <tr><td colSpan={5} className="text-center text-muted">No purchase payments recorded.</td></tr>}
                </tbody></table></div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierLedger;
