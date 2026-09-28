import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import MasterEditorModal from "../components/MasterEditorModal";
import { sameForm, toTitleCase } from "../utils/textFormat";
import { useUi } from "../context/UiContext";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  partyName: "",
  lendDate: today(),
  returnDate: "",
  amount: "",
  interestAmount: "0",
  principalReturned: "0",
  interestPaid: "0",
  notes: "",
});

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function Investments() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const baselineRef = useRef(emptyForm());

  useEffect(() => {
    loadData();
  }, [showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/investments", {
        params: { includeInactive: showInactive },
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

  const current = investments.find((entry) => entry.id === selectedId);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return investments;
    return investments.filter((entry) =>
      [entry.party_name, entry.lend_date, entry.return_date, entry.notes, entry.investment_status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text)),
    );
  }, [investments, search]);

  const openNew = () => {
    const next = emptyForm();
    baselineRef.current = next;
    setForm(next);
    setSelectedId(null);
    setEditing(true);
    setModalOpen(true);
    setMessage("");
    setError("");
  };

  const openEntry = (entry) => {
    const next = {
      partyName: entry.party_name || "",
      lendDate: entry.lend_date || "",
      returnDate: entry.return_date || "",
      amount: String(entry.amount ?? ""),
      interestAmount: String(entry.interest_amount ?? 0),
      principalReturned: String(entry.principal_returned ?? 0),
      interestPaid: String(entry.interest_paid ?? 0),
      notes: entry.notes || "",
    };
    baselineRef.current = next;
    setForm(next);
    setSelectedId(entry.id);
    setEditing(false);
    setModalOpen(true);
    setMessage("");
    setError("");
  };

  const isDirty = editing && !sameForm(form, baselineRef.current);

  const closeModal = async () => {
    if (isDirty) {
      const discard = await confirmAction({
        title: "Discard investment changes?",
        message: "You have unsaved changes in this investment entry.",
        detail: "Discard closes the window without saving those changes.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Continue Editing",
        variant: "warning",
      });
      if (!discard) return;
    }
    setModalOpen(false);
    setEditing(false);
    setSelectedId(null);
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const titleCaseField = (field) => {
    setForm((currentForm) => ({ ...currentForm, [field]: toTitleCase(currentForm[field]) }));
  };

  const validate = () => {
    if (!form.partyName.trim()) return "Party / person name is required.";
    if (!form.lendDate) return "Lend date is required.";
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      return "Investment amount must be greater than zero.";
    }
    if (Number(form.interestAmount || 0) < 0) return "Interest amount cannot be negative.";
    if (Number(form.principalReturned || 0) < 0) return "Principal returned cannot be negative.";
    if (Number(form.interestPaid || 0) < 0) return "Interest paid cannot be negative.";
    if (Number(form.principalReturned || 0) > Number(form.amount || 0)) {
      return "Principal returned cannot exceed the investment amount.";
    }
    if (Number(form.interestPaid || 0) > Number(form.interestAmount || 0)) {
      return "Interest paid cannot exceed the interest amount.";
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
      const payload = { ...form, partyName: toTitleCase(form.partyName) };
      let response;
      if (selectedId) {
        response = await api.put(`/investments/${selectedId}`, payload);
      } else {
        response = await api.post("/investments", payload);
      }

      const saved = response.data.investment;
      const next = {
        partyName: saved.party_name || "",
        lendDate: saved.lend_date || "",
        returnDate: saved.return_date || "",
        amount: String(saved.amount ?? ""),
        interestAmount: String(saved.interest_amount ?? 0),
        principalReturned: String(saved.principal_returned ?? 0),
        interestPaid: String(saved.interest_paid ?? 0),
        notes: saved.notes || "",
      };
      baselineRef.current = next;
      setForm(next);
      setSelectedId(saved.id);
      setMessage(selectedId ? "Investment updated successfully." : "Investment saved successfully.");
      toastSuccess(selectedId ? "Investment updated successfully." : "Investment saved successfully.");
      await loadData();

      if (closeAfterSave) {
        setModalOpen(false);
        setEditing(false);
        setSelectedId(null);
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

  const changeActive = async (activate) => {
    if (!selectedId || !current) return;
    const confirmed = await confirmAction({
      title: activate ? "Activate investment entry?" : "Deactivate investment entry?",
      message: `${current.party_name} · ${money(current.amount)}`,
      detail: activate
        ? "The entry will again be included in active investment totals."
        : "Historical data is preserved, but the entry will be excluded from active investment totals.",
      confirmLabel: activate ? "Activate" : "Deactivate",
      cancelLabel: "Keep Unchanged",
      variant: activate ? "primary" : "warning",
    });
    if (!confirmed) return;
    try {
      await api.patch(`/investments/${selectedId}/${activate ? "activate" : "deactivate"}`);
      toastSuccess(activate ? "Investment activated." : "Investment deactivated.");
      setModalOpen(false);
      setSelectedId(null);
      setEditing(false);
      await loadData();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to update investment status.";
      setError(errorMessage);
      toastError(errorMessage);
    }
  };

  const outstandingPrincipal = Math.max(0, Number(form.amount || 0) - Number(form.principalReturned || 0));
  const outstandingInterest = Math.max(0, Number(form.interestAmount || 0) - Number(form.interestPaid || 0));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="mb-1">Investment</h2>
          <p className="text-muted mb-0">Track money lent, principal returns, optional interest and outstanding balances separately.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Investment</button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="finance-summary-grid mb-4">
        <div className="finance-summary-card"><span>Total Lent</span><strong>{money(summary.invested)}</strong></div>
        <div className="finance-summary-card"><span>Principal Returned</span><strong>{money(summary.principalReturned)}</strong></div>
        <div className="finance-summary-card"><span>Principal Outstanding</span><strong>{money(summary.outstandingPrincipal)}</strong></div>
        <div className="finance-summary-card"><span>Interest Paid</span><strong>{money(summary.interestPaid)}</strong></div>
        <div className="finance-summary-card"><span>Interest Outstanding</span><strong>{money(summary.outstandingInterest)}</strong></div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <h5 className="mb-0">Investment Register</h5>
            <div className="form-check">
              <input id="showInactiveInvestments" type="checkbox" className="form-check-input" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              <label className="form-check-label" htmlFor="showInactiveInvestments">Show Inactive</label>
            </div>
          </div>
          <input className="form-control mb-3" placeholder="Search party, date, status or notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light"><tr><th>Party / Person</th><th>Lend Date</th><th>Return Date</th><th>Amount</th><th>Interest</th><th>Principal Returned</th><th>Interest Paid</th><th>Outstanding</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="text-center text-muted">Loading investments...</td></tr> : filtered.map((entry) => (
                  <tr key={entry.id} className="master-row-clickable" onClick={() => openEntry(entry)}>
                    <td>{entry.party_name}</td><td>{entry.lend_date}</td><td>{entry.return_date || "-"}</td>
                    <td>{money(entry.amount)}</td><td>{money(entry.interest_amount)}</td><td>{money(entry.principal_returned)}</td><td>{money(entry.interest_paid)}</td>
                    <td><strong>{money(entry.outstanding_amount)}</strong>{Number(entry.outstanding_interest || 0) > 0 && <div className="small text-muted">Interest: {money(entry.outstanding_interest)}</div>}</td>
                    <td>{Number(entry.is_active) !== 1 ? <span className="badge text-bg-secondary">Inactive</span> : entry.investment_status === "CLOSED" ? <span className="badge text-bg-success">Closed</span> : <span className="badge text-bg-warning">Open</span>}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={9} className="text-center text-muted">No investment entries found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MasterEditorModal
        open={modalOpen}
        title={selectedId ? (editing ? "Edit Investment" : "Investment Details") : "New Investment"}
        subtitle="Principal and interest are tracked separately for clarity."
        onRequestClose={closeModal}
        footer={(
          <>
            <div className="me-auto d-flex gap-2 flex-wrap">
              {selectedId && current && Number(current.is_active) === 1 && !editing && <button type="button" className="btn btn-outline-danger" onClick={() => changeActive(false)}>Deactivate</button>}
              {selectedId && current && Number(current.is_active) !== 1 && <button type="button" className="btn btn-outline-success" onClick={() => changeActive(true)}>Activate</button>}
            </div>
            {!editing && selectedId && current && Number(current.is_active) === 1 ? (
              <><button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Close</button><button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button></>
            ) : (
              <><button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Cancel</button><button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button><button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button></>
            )}
          </>
        )}
      >
        <div className="row">
          <div className="col-md-6 mb-3"><label className="form-label">Party / Person *</label><input className="form-control" name="partyName" value={form.partyName} onChange={change} onBlur={() => titleCaseField("partyName")} disabled={!editing} spellCheck autoFocus={editing} /></div>
          <div className="col-md-3 mb-3"><label className="form-label">Lend Date *</label><input type="date" className="form-control" name="lendDate" value={form.lendDate} onChange={change} disabled={!editing} /></div>
          <div className="col-md-3 mb-3"><label className="form-label">Return Date</label><input type="date" className="form-control" name="returnDate" value={form.returnDate} onChange={change} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Principal Amount *</label><div className="input-group"><span className="input-group-text">₹</span><input type="number" min="0" step="0.01" className="form-control" name="amount" value={form.amount} onChange={change} disabled={!editing} /></div></div>
          <div className="col-md-4 mb-3"><label className="form-label">Interest Amount <span className="text-muted">(optional)</span></label><div className="input-group"><span className="input-group-text">₹</span><input type="number" min="0" step="0.01" className="form-control" name="interestAmount" value={form.interestAmount} onChange={change} disabled={!editing} /></div></div>
          <div className="col-md-4 mb-3"><label className="form-label">Principal Returned</label><div className="input-group"><span className="input-group-text">₹</span><input type="number" min="0" step="0.01" className="form-control" name="principalReturned" value={form.principalReturned} onChange={change} disabled={!editing} /></div></div>
          <div className="col-md-4 mb-3"><label className="form-label">Interest Paid</label><div className="input-group"><span className="input-group-text">₹</span><input type="number" min="0" step="0.01" className="form-control" name="interestPaid" value={form.interestPaid} onChange={change} disabled={!editing} /></div></div>
          <div className="col-md-4 mb-3"><label className="form-label">Principal Outstanding</label><div className="form-control finance-readonly">{money(outstandingPrincipal)}</div></div>
          <div className="col-md-4 mb-3"><label className="form-label">Interest Outstanding</label><div className="form-control finance-readonly">{money(outstandingInterest)}</div></div>
          <div className="col-12 mb-3"><label className="form-label">Notes</label><textarea className="form-control" rows="3" name="notes" value={form.notes} onChange={change} disabled={!editing} spellCheck /></div>
        </div>
      </MasterEditorModal>
    </div>
  );
}

export default Investments;
