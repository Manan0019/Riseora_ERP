import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import MasterEditorModal from "../components/MasterEditorModal";
import { sameForm, toTitleCase } from "../utils/textFormat";
import { useUi } from "../context/UiContext";
import SmartDateInput from "../components/SmartDateInput";

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ upadDate: today(), personName: "", amount: "", notes: "" });
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Upad() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [entries, setEntries] = useState([]);
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

  useEffect(() => {loadData();}, [showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/upad", { params: { includeInactive: showInactive } });
      setEntries(response.data.entries || []);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load Upad entries.");
    } finally {setLoading(false);}
  };

  const current = entries.find((entry) => entry.id === selectedId);
  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return entries;
    return entries.filter((entry) => [entry.person_name, entry.upad_date, entry.notes].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [entries, search]);

  const openNew = () => {
    const next = emptyForm();baselineRef.current = next;setForm(next);setSelectedId(null);setEditing(true);setModalOpen(true);setMessage("");setError("");
  };
  const openEntry = (entry) => {
    const next = { upadDate: entry.upad_date || "", personName: entry.person_name || "", amount: String(entry.amount ?? ""), notes: entry.notes || "" };
    baselineRef.current = next;setForm(next);setSelectedId(entry.id);setEditing(false);setModalOpen(true);setMessage("");setError("");
  };
  const isDirty = editing && !sameForm(form, baselineRef.current);
  const closeModal = async () => {
    if (isDirty) {
      const discard = await confirmAction({ title: "Discard Upad changes?", message: "You have unsaved changes in this Upad entry.", detail: "Discard closes the window without saving those changes.", confirmLabel: "Discard Changes", cancelLabel: "Continue Editing", variant: "warning" });
      if (!discard) return;
    }
    setModalOpen(false);setEditing(false);setSelectedId(null);
  };
  const change = (event) => {const { name, value } = event.target;setForm((currentForm) => ({ ...currentForm, [name]: value }));};

  const save = async (closeAfterSave) => {
    if (!form.upadDate) {setError("Upad date is required.");return false;}
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {setError("Upad amount must be greater than zero.");return false;}
    try {
      setSaving(true);setError("");
      const payload = { ...form, personName: toTitleCase(form.personName) };
      const response = selectedId ? await api.put(`/upad/${selectedId}`, payload) : await api.post("/upad", payload);
      const saved = response.data.entry;
      const next = { upadDate: saved.upad_date || "", personName: saved.person_name || "", amount: String(saved.amount ?? ""), notes: saved.notes || "" };
      baselineRef.current = next;setForm(next);setSelectedId(saved.id);
      setMessage(selectedId ? "Upad entry updated successfully." : "Upad entry saved successfully.");
      toastSuccess(selectedId ? "Upad entry updated successfully." : "Upad entry saved successfully.");
      await loadData();
      if (closeAfterSave) {setModalOpen(false);setEditing(false);setSelectedId(null);}
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to save Upad entry.";setError(errorMessage);toastError(errorMessage);return false;
    } finally {setSaving(false);}
  };

  const changeActive = async (activate) => {
    if (!selectedId || !current) return;
    const confirmed = await confirmAction({ title: activate ? "Activate Upad entry?" : "Deactivate Upad entry?", message: `${current.person_name || "Upad"} · ${money(current.amount)}`, detail: activate ? "The amount will again be deducted in the Upad summary." : "The entry is retained for history but excluded from the active Upad deduction.", confirmLabel: activate ? "Activate" : "Deactivate", cancelLabel: "Keep Unchanged", variant: activate ? "primary" : "warning" });
    if (!confirmed) return;
    try {
      await api.patch(`/upad/${selectedId}/${activate ? "activate" : "deactivate"}`);
      toastSuccess(activate ? "Upad entry activated." : "Upad entry deactivated.");
      setModalOpen(false);setSelectedId(null);setEditing(false);await loadData();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Unable to update Upad status.";setError(errorMessage);toastError(errorMessage);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3 flex-wrap">
        <div><h2 className="mb-1">Upad</h2><p className="text-muted mb-0">Record Upad separately and see its deduction from sales without altering posted invoices, GST or stock.</p></div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Upad</button>
      </div>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="finance-summary-grid mb-4">
        <div className="finance-summary-card"><span>Sales</span><strong>{money(summary.totalSales)}</strong></div>
        <div className="finance-summary-card"><span>Less: Upad</span><strong>{money(summary.totalUpad)}</strong></div>
        <div className="finance-summary-card"><span>Sales After Upad</span><strong>{money(summary.netSalesAfterUpad)}</strong></div>
      </div>
      <div className="alert alert-secondary">Upad is a management adjustment only. It does not rewrite sales invoices, tax values, customer ledgers or inventory.</div>
      <div className="card"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3"><h5 className="mb-0">Upad Register</h5><div className="form-check"><input id="showInactiveUpad" type="checkbox" className="form-check-input" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /><label className="form-check-label" htmlFor="showInactiveUpad">Show Inactive</label></div></div>
        <input className="form-control mb-3" placeholder="Search person, date or notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="table-responsive"><table className="table table-bordered table-hover align-middle"><thead className="table-light"><tr><th>Date</th><th>Person / Reference</th><th>Amount</th><th>Notes</th><th>Status</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={5} className="text-center text-muted">Loading Upad entries...</td></tr> : filtered.map((entry) => <tr key={entry.id} className="master-row-clickable" onClick={() => openEntry(entry)}><td>{entry.upad_date}</td><td>{entry.person_name || "-"}</td><td><strong>{money(entry.amount)}</strong></td><td>{entry.notes || "-"}</td><td>{Number(entry.is_active) === 1 ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td></tr>)}
          {!loading && filtered.length === 0 && <tr><td colSpan={5} className="text-center text-muted">No Upad entries found.</td></tr>}
        </tbody></table></div>
      </div></div>

      <MasterEditorModal open={modalOpen} title={selectedId ? editing ? "Edit Upad" : "Upad Details" : "New Upad"} subtitle="Upad reduces the management sales summary only; original invoices remain unchanged." onRequestClose={closeModal} footer={<><div className="me-auto d-flex gap-2 flex-wrap">{selectedId && current && Number(current.is_active) === 1 && !editing && <button type="button" className="btn btn-outline-danger" onClick={() => changeActive(false)}>Deactivate</button>}{selectedId && current && Number(current.is_active) !== 1 && <button type="button" className="btn btn-outline-success" onClick={() => changeActive(true)}>Activate</button>}</div>{!editing && selectedId && current && Number(current.is_active) === 1 ? <><button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Close</button><button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button></> : <><button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Cancel</button><button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button><button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button></>}</>}>
        <div className="row"><div className="col-md-4 mb-3"><label className="form-label">Date *</label><SmartDateInput className="form-control" name="upadDate" value={form.upadDate} onChange={change} disabled={!editing} /></div><div className="col-md-5 mb-3"><label className="form-label">Person / Reference</label><input className="form-control" name="personName" value={form.personName} onChange={change} onBlur={() => setForm((f) => ({ ...f, personName: toTitleCase(f.personName) }))} disabled={!editing} spellCheck autoFocus={editing} /></div><div className="col-md-3 mb-3"><label className="form-label">Amount *</label><div className="input-group"><span className="input-group-text">₹</span><input type="number" min="0" step="0.01" className="form-control" name="amount" value={form.amount} onChange={change} disabled={!editing} /></div></div><div className="col-12 mb-3"><label className="form-label">Notes</label><textarea className="form-control" rows="3" name="notes" value={form.notes} onChange={change} disabled={!editing} spellCheck /></div></div>
      </MasterEditorModal>
    </div>);

}

export default Upad;
