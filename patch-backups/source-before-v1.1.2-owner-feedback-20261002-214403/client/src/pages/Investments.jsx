import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import MasterEditorModal from "../components/MasterEditorModal";
import { sameForm, toTitleCase } from "../utils/textFormat";
import { useUi } from "../context/UiContext";
import SmartDateInput from "../components/SmartDateInput";

function localToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyForm = () => ({
  partyName: "",
  lendDate: localToday(),
  amount: "",
  interestRateMonthly: "0",
  notes: ""
});

const emptyPayment = () => ({
  paymentDate: localToday(),
  paymentType: "INTEREST",
  amount: "",
  paymentAccount: "",
  notes: ""
});

const money = (value) =>
`₹${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const percent = (value) => `${Number(value || 0).toFixed(2)}%`;

function Investments() {
  const {
    confirm: confirmAction,
    success: toastSuccess,
    error: toastError
  } = useUi();

  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [paymentForm, setPaymentForm] = useState(emptyPayment());
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const baselineRef = useRef(emptyForm());

  useEffect(() => {
    loadData();
  }, [showInactive]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/investments", {
        params: { includeInactive: showInactive }
      });
      setInvestments(response.data.investments || []);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load investments.");
    } finally {
      setLoading(false);
    }
  };

  const formFromInvestment = (entry) => ({
    partyName: entry?.party_name || "",
    lendDate: entry?.lend_date || "",
    amount: String(entry?.amount ?? ""),
    interestRateMonthly: String(entry?.interest_rate_monthly ?? 0),
    notes: entry?.notes || ""
  });

  const loadDetails = async (id, { quiet = false } = {}) => {
    try {
      if (!quiet) setDetailLoading(true);
      const response = await api.get(`/investments/${id}`);
      const nextDetail = {
        investment: response.data.investment,
        payments: response.data.payments || []
      };
      setDetail(nextDetail);
      return nextDetail;
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to load investment details.";
      setError(errorMessage);
      toastError(errorMessage);
      return null;
    } finally {
      if (!quiet) setDetailLoading(false);
    }
  };

  const current =
  detail?.investment || investments.find((entry) => entry.id === selectedId) || null;

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return investments;
    return investments.filter((entry) =>
    [
    entry.party_name,
    entry.lend_date,
    entry.last_payment_date,
    entry.cleared_date,
    entry.notes,
    entry.investment_status].

    filter(Boolean).
    some((value) => String(value).toLowerCase().includes(text))
    );
  }, [investments, search]);

  const openNew = () => {
    const next = emptyForm();
    baselineRef.current = next;
    setForm(next);
    setPaymentForm(emptyPayment());
    setSelectedId(null);
    setDetail(null);
    setEditing(true);
    setModalOpen(true);
    setMessage("");
    setError("");
  };

  const openEntry = async (entry) => {
    setSelectedId(entry.id);
    setDetail({ investment: entry, payments: [] });
    const next = formFromInvestment(entry);
    baselineRef.current = next;
    setForm(next);
    setPaymentForm(emptyPayment());
    setEditing(false);
    setModalOpen(true);
    setMessage("");
    setError("");

    const loaded = await loadDetails(entry.id);
    if (loaded?.investment) {
      const loadedForm = formFromInvestment(loaded.investment);
      baselineRef.current = loadedForm;
      setForm(loadedForm);
      setPaymentForm((currentPayment) => ({
        ...currentPayment,
        paymentType:
        Number(loaded.investment.outstanding_interest || 0) > 0.000001 ?
        "INTEREST" :
        "PRINCIPAL"
      }));
    }
  };

  const isDirty = editing && !sameForm(form, baselineRef.current);

  const closeModal = async () => {
    if (isDirty) {
      const discard = await confirmAction({
        title: "Discard investment changes?",
        message: "You have unsaved changes in this investment entry.",
        detail: "Discard closes the popup without saving those changes.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Continue Editing",
        variant: "warning"
      });
      if (!discard) return;
    }

    setModalOpen(false);
    setEditing(false);
    setSelectedId(null);
    setDetail(null);
    setPaymentForm(emptyPayment());
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const changePayment = (event) => {
    const { name, value } = event.target;
    setPaymentForm((currentPayment) => ({ ...currentPayment, [name]: value }));
  };

  const titleCaseField = (field) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: toTitleCase(currentForm[field])
    }));
  };

  const validate = () => {
    if (!form.partyName.trim()) return "Person / lender name is required.";
    if (!form.lendDate) return "Borrow date is required.";
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      return "Principal amount must be greater than zero.";
    }
    const rate = Number(form.interestRateMonthly || 0);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return "Monthly interest rate must be between 0 and 100 percent.";
    }
    return null;
  };

  const save = async (closeAfterSave) => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return false;
    }

    try {
      setSaving(true);
      setError("");
      const payload = {
        ...form,
        partyName: toTitleCase(form.partyName)
      };

      let response;
      const updating = Boolean(selectedId);
      if (updating) {
        response = await api.put(`/investments/${selectedId}`, payload);
      } else {
        response = await api.post("/investments", payload);
      }

      const saved = response.data.investment;
      const next = formFromInvestment(saved);
      baselineRef.current = next;
      setForm(next);
      setSelectedId(saved.id);
      setEditing(false);
      setMessage(updating ? "Investment updated successfully." : "Investment saved successfully.");
      toastSuccess(updating ? "Investment updated successfully." : "Investment saved successfully.");
      await loadData();

      if (closeAfterSave) {
        setModalOpen(false);
        setSelectedId(null);
        setDetail(null);
      } else {
        await loadDetails(saved.id, { quiet: true });
      }
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to save investment.";
      setError(errorMessage);
      toastError(errorMessage);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const recordPayment = async () => {
    if (!selectedId || !current) return;

    const amount = Number(paymentForm.amount || 0);
    if (!paymentForm.paymentDate) {
      setError("Payment / return date is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    try {
      setPaymentSaving(true);
      setError("");
      const response = await api.post(`/investments/${selectedId}/payments`, paymentForm);
      setDetail({
        investment: response.data.investment,
        payments: response.data.payments || []
      });
      setPaymentForm({
        ...emptyPayment(),
        paymentType:
        Number(response.data.investment?.outstanding_interest || 0) > 0.000001 ?
        "INTEREST" :
        "PRINCIPAL"
      });
      toastSuccess(
        response.data.investment?.investment_status === "CLEARED" ?
        "Payment recorded. This investment is now fully cleared." :
        "Payment / return recorded successfully."
      );
      await loadData();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to record payment / return.";
      setError(errorMessage);
      toastError(errorMessage);
    } finally {
      setPaymentSaving(false);
    }
  };

  const fillFullDue = () => {
    const due =
    paymentForm.paymentType === "INTEREST" ?
    Number(current?.outstanding_interest || 0) :
    Number(current?.outstanding_amount || 0);
    setPaymentForm((value) => ({ ...value, amount: due > 0 ? due.toFixed(2) : "" }));
  };

  const changeActive = async (activate) => {
    if (!selectedId || !current) return;
    const confirmed = await confirmAction({
      title: activate ? "Activate investment entry?" : "Deactivate investment entry?",
      message: `${current.party_name} · ${money(current.amount)}`,
      detail: activate ?
      "The entry will again be included in active borrowing totals." :
      "Historical details and payment history are preserved, but the entry will be excluded from active totals.",
      confirmLabel: activate ? "Activate" : "Deactivate",
      cancelLabel: "Keep Unchanged",
      variant: activate ? "primary" : "warning"
    });
    if (!confirmed) return;

    try {
      await api.patch(`/investments/${selectedId}/${activate ? "activate" : "deactivate"}`);
      toastSuccess(activate ? "Investment activated." : "Investment deactivated.");
      setModalOpen(false);
      setSelectedId(null);
      setDetail(null);
      setEditing(false);
      await loadData();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to update investment status.";
      setError(errorMessage);
      toastError(errorMessage);
    }
  };

  const hasPayments = Boolean(detail?.payments?.length);
  const termsLocked = editing && selectedId && hasPayments;
  const canRecordPayment =
  selectedId &&
  current &&
  Number(current.is_active) === 1 &&
  current.investment_status !== "CLEARED" &&
  !editing;

  const paymentDue =
  paymentForm.paymentType === "INTEREST" ?
  Number(current?.outstanding_interest || 0) :
  Number(current?.outstanding_amount || 0);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="mb-1">Investment</h2>
          <p className="text-muted mb-0">
            Track business money borrowed from people, monthly simple interest, principal returns and interest payments.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Investment</button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="finance-summary-grid mb-4">
        <div className="finance-summary-card"><span>Total Principal Borrowed</span><strong>{money(summary.principalBorrowed)}</strong></div>
        <div className="finance-summary-card"><span>Principal Repaid</span><strong>{money(summary.principalReturned)}</strong></div>
        <div className="finance-summary-card"><span>Principal Due</span><strong>{money(summary.outstandingPrincipal)}</strong></div>
        <div className="finance-summary-card"><span>Accrued Interest</span><strong>{money(summary.accruedInterest)}</strong></div>
        <div className="finance-summary-card"><span>Interest Paid</span><strong>{money(summary.interestPaid)}</strong></div>
        <div className="finance-summary-card"><span>Interest Due</span><strong>{money(summary.outstandingInterest)}</strong></div>
        <div className="finance-summary-card finance-summary-emphasis"><span>Total Due</span><strong>{money(summary.totalDue)}</strong></div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <h5 className="mb-0">Investment / Borrowing Register</h5>
            <div className="form-check">
              <input
                id="showInactiveInvestments"
                type="checkbox"
                className="form-check-input"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)} />
              
              <label className="form-check-label" htmlFor="showInactiveInvestments">Show Inactive</label>
            </div>
          </div>

          <input
            className="form-control mb-3"
            placeholder="Search person, borrow date, status or notes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)} />
          

          <div className="table-responsive riseora-sticky-table">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Borrowed From</th>
                  <th>Borrow Date</th>
                  <th>Principal</th>
                  <th>Interest / Month</th>
                  <th>Principal Due</th>
                  <th>Interest Due</th>
                  <th>Total Due</th>
                  <th>Last Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ?
                <tr><td colSpan={9} className="text-center text-muted">Loading investments...</td></tr> :
                filtered.map((entry) =>
                <tr
                  key={entry.id}
                  className="master-row-clickable"
                  onClick={() => openEntry(entry)}>
                  
                    <td><strong>{entry.party_name}</strong></td>
                    <td>{entry.lend_date}</td>
                    <td>{money(entry.amount)}</td>
                    <td>{Number(entry.interest_rate_monthly || 0) > 0 ? percent(entry.interest_rate_monthly) : "No Interest"}</td>
                    <td>{money(entry.outstanding_amount)}</td>
                    <td>{money(entry.outstanding_interest)}</td>
                    <td><strong>{money(entry.total_due)}</strong></td>
                    <td>{entry.last_payment_date || "-"}</td>
                    <td>
                      {Number(entry.is_active) !== 1 ?
                    <span className="badge text-bg-secondary">Inactive</span> :
                    entry.investment_status === "CLEARED" ?
                    <span className="badge text-bg-success">Cleared</span> :

                    <span className="badge text-bg-warning">Open</span>
                    }
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 &&
                <tr><td colSpan={9} className="text-center text-muted">No investment entries found.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MasterEditorModal
        open={modalOpen}
        size="xl"
        title={selectedId ? editing ? "Edit Investment / Borrowing" : "Investment Details" : "New Investment / Borrowing"}
        subtitle="Monthly simple interest only — unpaid interest never earns interest."
        onRequestClose={closeModal}
        footer={
        <>
            <div className="me-auto d-flex gap-2 flex-wrap">
              {selectedId && current && Number(current.is_active) === 1 && !editing &&
            <button type="button" className="btn btn-outline-danger" onClick={() => changeActive(false)}>Deactivate</button>
            }
              {selectedId && current && Number(current.is_active) !== 1 && !editing &&
            <button type="button" className="btn btn-outline-success" onClick={() => changeActive(true)}>Activate</button>
            }
            </div>

            {!editing && selectedId ?
          <>
                <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Close</button>
                {current && Number(current.is_active) === 1 &&
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
            }
              </> :

          <>
                <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button>
              </>
          }
          </>
        }>
        
        {detailLoading && selectedId ?
        <div className="text-center text-muted py-5">Loading investment details...</div> :

        <>
            <div className="row">
              <div className="col-md-5 mb-3">
                <label className="form-label">Person / Lender *</label>
                <input
                className="form-control"
                name="partyName"
                value={form.partyName}
                onChange={change}
                onBlur={() => titleCaseField("partyName")}
                disabled={!editing}
                spellCheck />
              
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label">Borrow Date *</label>
                <SmartDateInput

                className="form-control"
                name="lendDate"
                value={form.lendDate}
                onChange={change}
                disabled={!editing || termsLocked} />
              
              </div>

              <div className="col-md-2 mb-3">
                <label className="form-label">Principal Amount *</label>
                <div className="input-group">
                  <span className="input-group-text">₹</span>
                  <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  name="amount"
                  value={form.amount}
                  onChange={change}
                  disabled={!editing || termsLocked} />
                
                </div>
              </div>

              <div className="col-md-2 mb-3">
                <label className="form-label">Interest % / Month</label>
                <div className="input-group">
                  <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="form-control"
                  name="interestRateMonthly"
                  value={form.interestRateMonthly}
                  onChange={change}
                  disabled={!editing || termsLocked} />
                
                  <span className="input-group-text">%</span>
                </div>
                <div className="form-text">Optional. Enter 0 for interest-free borrowing.</div>
              </div>

              {termsLocked &&
            <div className="col-12 mb-3">
                  <div className="master-readonly-note">
                    Borrow date, principal and interest rate are protected after the first payment so old interest/payment history cannot change. Person name and notes can still be corrected.
                  </div>
                </div>
            }

              <div className="col-12 mb-3">
                <label className="form-label">Notes</label>
                <textarea
                className="form-control"
                rows="2"
                name="notes"
                value={form.notes}
                onChange={change}
                disabled={!editing}
                spellCheck />
              
              </div>
            </div>

            {selectedId && current && !editing &&
          <>
                <div className="investment-detail-grid mb-4">
                  <div><span>Original Principal</span><strong>{money(current.amount)}</strong></div>
                  <div><span>Principal Repaid</span><strong>{money(current.principal_returned)}</strong></div>
                  <div><span>Principal Due</span><strong>{money(current.outstanding_amount)}</strong></div>
                  <div><span>Monthly Simple Interest</span><strong>{percent(current.interest_rate_monthly)}</strong></div>
                  <div><span>Interest Periods Accrued</span><strong>{current.interest_periods_accrued || 0}</strong></div>
                  <div><span>Accrued Interest</span><strong>{money(current.accrued_interest)}</strong></div>
                  <div><span>Interest Paid</span><strong>{money(current.interest_paid)}</strong></div>
                  <div><span>Interest Due</span><strong>{money(current.outstanding_interest)}</strong></div>
                  <div className="investment-total-due"><span>Total Due</span><strong>{money(current.total_due)}</strong></div>
                  <div><span>Next Interest Date</span><strong>{current.next_interest_date || "-"}</strong></div>
                  <div><span>Last Payment Date</span><strong>{current.last_payment_date || "-"}</strong></div>
                  <div><span>Cleared Date</span><strong>{current.cleared_date || "-"}</strong></div>
                </div>

                {canRecordPayment &&
            <section className="investment-payment-panel mb-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                      <div>
                        <h5 className="mb-1">Record Return / Payment</h5>
                        <p className="text-muted mb-0 small">Record each principal return or interest payment separately so the complete history stays visible.</p>
                      </div>
                      <div className="investment-payment-due">
                        Available due: <strong>{money(paymentDue)}</strong>
                      </div>
                    </div>

                    <div className="row g-3">
                      <div className="col-md-2">
                        <label className="form-label">Payment Date *</label>
                        <SmartDateInput className="form-control" name="paymentDate" value={paymentForm.paymentDate} onChange={changePayment} />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Pay Towards *</label>
                        <select className="form-select" name="paymentType" value={paymentForm.paymentType} onChange={changePayment}>
                          <option value="INTEREST" disabled={Number(current.outstanding_interest || 0) <= 0.000001}>Interest</option>
                          <option value="PRINCIPAL" disabled={Number(current.outstanding_amount || 0) <= 0.000001}>Principal</option>
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Amount *</label>
                        <div className="input-group">
                          <span className="input-group-text">₹</span>
                          <input type="number" min="0" step="0.01" className="form-control" name="amount" value={paymentForm.amount} onChange={changePayment} />
                        </div>
                        <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={fillFullDue}>Use full due</button>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Payment Account</label>
                        <input className="form-control" name="paymentAccount" value={paymentForm.paymentAccount} onChange={changePayment} placeholder="Cash / Current Account / Bank" spellCheck />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Notes</label>
                        <input className="form-control" name="notes" value={paymentForm.notes} onChange={changePayment} spellCheck />
                      </div>
                    </div>

                    <button type="button" className="btn btn-success mt-3" onClick={recordPayment} disabled={paymentSaving}>
                      {paymentSaving ? "Recording..." : "Record Payment / Return"}
                    </button>
                  </section>
            }

                {current.investment_status === "CLEARED" &&
            <div className="alert alert-success">
                    Fully cleared. Principal due and payable interest are both zero{current.cleared_date ? ` as of ${current.cleared_date}` : ""}.
                  </div>
            }

                <section>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="mb-0">Return / Payment History</h5>
                    <span className="text-muted small">{detail?.payments?.length || 0} transaction(s)</span>
                  </div>
                  <div className="table-responsive investment-history-table">
                    <table className="table table-bordered align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Date</th><th>Type</th><th>Amount</th><th>Payment Account</th><th>Notes</th></tr>
                      </thead>
                      <tbody>
                        {(detail?.payments || []).map((payment) =>
                    <tr key={payment.id}>
                            <td>{payment.payment_date}</td>
                            <td>
                              <span className={`badge ${payment.payment_type === "INTEREST" ? "text-bg-warning" : "text-bg-primary"}`}>
                                {payment.payment_type === "INTEREST" ? "Interest Payment" : "Principal Return"}
                              </span>
                            </td>
                            <td><strong>{money(payment.amount)}</strong></td>
                            <td>{payment.payment_account || "-"}</td>
                            <td>{payment.notes || "-"}</td>
                          </tr>
                    )}
                        {(detail?.payments || []).length === 0 &&
                    <tr><td colSpan={5} className="text-center text-muted">No return or payment has been recorded yet.</td></tr>
                    }
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
          }
          </>
        }
      </MasterEditorModal>
    </div>);

}

export default Investments;
