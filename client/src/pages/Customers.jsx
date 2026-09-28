import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useUi } from "../context/UiContext";
import IndiaLocationFields from "../components/IndiaLocationFields";
import MasterEditorModal from "../components/MasterEditorModal";
import { normalizeTitleCaseFields, sameForm, toTitleCase } from "../utils/textFormat";

const emptyForm = {
  name: "",
  phone: "",
  alternatePhone: "",
  email: "",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  customerType: "RETAIL",
  creditDays: "0",
  creditLimit: "0",
  notes: "",
};

function mapCustomer(customer) {
  return {
    name: customer?.name || "",
    phone: customer?.phone || "",
    alternatePhone: customer?.alternate_phone || "",
    email: customer?.email || "",
    gstin: customer?.gstin || "",
    address: customer?.address || "",
    city: customer?.city || "",
    state: customer?.state || "",
    pincode: customer?.pincode || "",
    customerType: customer?.customer_type || "RETAIL",
    creditDays: String(customer?.credit_days ?? 0),
    creditLimit: String(customer?.credit_limit ?? 0),
    notes: customer?.notes || "",
  };
}

function Customers() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadCustomers(); }, [showInactive]);

  useEffect(() => {
    const recordId = Number(searchParams.get("record"));
    if (!recordId || customers.length === 0 || selectedId === recordId) return;

    const customer = customers.find((entry) => Number(entry.id) === recordId);
    if (!customer) {
      if (!showInactive) setShowInactive(true);
      return;
    }

    const mapped = mapCustomer(customer);
    setSelectedId(customer.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }, [customers, searchParams, selectedId, showInactive]);

  async function loadCustomers() {
    try {
      setError("");
      const response = await api.get("/customers", { params: { includeInactive: showInactive } });
      setCustomers(response.data.customers);
    } catch (err) {
      console.error(err);
      setError("Unable to load customers.");
    }
  }

  const selectedCustomer = customers.find((customer) => customer.id === selectedId);
  const dirty = editing && !sameForm(form, originalForm);

  const filteredCustomers = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.alternate_phone, customer.gstin, customer.city, customer.customer_type]
        .some((value) => String(value || "").toLowerCase().includes(text)),
    );
  }, [customers, search]);

  function clearRecordQuery() {
    if (!searchParams.has("record")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("record");
    setSearchParams(next, { replace: true });
  }

  function openNew() {
    clearRecordQuery();
    setSelectedId(null);
    setForm(emptyForm);
    setOriginalForm(emptyForm);
    setEditing(true);
    setModalOpen(true);
    setError("");
  }

  function openCustomer(customer) {
    clearRecordQuery();
    const mapped = mapCustomer(customer);
    setSelectedId(customer.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }

  async function requestClose() {
    if (dirty) {
      const discard = await confirmAction({
        title: "Discard customer changes?",
        message: "This customer has unsaved changes.",
        detail: "Choose Discard Changes to close without saving, or Continue Editing to return to the popup.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Continue Editing",
        variant: "warning",
      });
      if (!discard) return;
    }
    setModalOpen(false);
    setEditing(false);
    clearRecordQuery();
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === "gstin" ? value.toUpperCase() : value }));
  }

  function titleField(field) {
    setForm((current) => ({ ...current, [field]: toTitleCase(current[field]) }));
  }

  async function save(closeAfter) {
    setError("");
    const payload = normalizeTitleCaseFields(form, ["name", "city", "state"]);
    if (!payload.name.trim()) { setError("Customer name is required."); return; }
    if (Number(payload.creditDays) < 0) { setError("Credit days cannot be negative."); return; }
    if (Number(payload.creditLimit) < 0) { setError("Credit limit cannot be negative."); return; }

    try {
      setSaving(true);
      const response = selectedId
        ? await api.put(`/customers/${selectedId}`, payload)
        : await api.post("/customers", payload);
      const saved = response.data.customer;
      const mapped = mapCustomer(saved);
      setSelectedId(saved.id);
      setForm(mapped);
      setOriginalForm(mapped);
      setEditing(!closeAfter);
      await loadCustomers();
      toastSuccess(selectedId ? "Customer updated successfully." : "Customer created successfully.", "Customer saved");
      if (closeAfter) {
        setModalOpen(false);
        clearRecordQuery();
      }
    } catch (err) {
      const message = err.response?.data?.message || "Unable to save customer.";
      setError(message);
      toastError(message, "Customer not saved");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const customer = customers.find((item) => item.id === selectedId) || selectedCustomer;
    if (!customer) return;
    const activating = !customer.is_active;
    const confirmed = await confirmAction({
      title: activating ? "Activate customer?" : "Deactivate customer?",
      message: activating
        ? `${customer.name} will become available for new sales.`
        : `${customer.name} will no longer be available for new sales.`,
      detail: "Historical invoices and ledger records remain unchanged.",
      confirmLabel: activating ? "Activate Customer" : "Deactivate Customer",
      cancelLabel: "Keep Unchanged",
      variant: activating ? "primary" : "warning",
    });
    if (!confirmed) return;

    try {
      await api.patch(`/customers/${customer.id}/${activating ? "activate" : "deactivate"}`);
      await loadCustomers();
      setModalOpen(false);
      clearRecordQuery();
      toastSuccess(`Customer ${activating ? "activated" : "deactivated"} successfully.`);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to update customer status.";
      setError(message);
      toastError(message);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div><h2 className="mb-1">Customers</h2><p className="text-muted mb-0">Maintain retail, wholesale and distributor customers without visible ERP IDs.</p></div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Customer</button>
      </div>

      {error && !modalOpen && <div className="alert alert-danger">{error}</div>}

      <div className="card"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
          <input className="form-control" style={{ maxWidth: 520 }} placeholder="Search customer name, phone, GSTIN or city..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="form-check"><input id="showInactiveCustomers" type="checkbox" className="form-check-input" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /><label className="form-check-label" htmlFor="showInactiveCustomers">Show Inactive</label></div>
        </div>
        <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
          <thead className="table-light"><tr><th>Name</th><th>Type</th><th>Phone</th><th>Alternate No.</th><th>GSTIN</th><th>Credit Days</th><th>Credit Limit</th><th>Status</th></tr></thead>
          <tbody>
            {filteredCustomers.map((customer) => <tr key={customer.id} className="row-clickable" data-workspace-path={`/customers?record=${customer.id}`} data-workspace-title={customer.name} onClick={() => openCustomer(customer)}>
              <td><strong>{customer.name}</strong></td><td>{customer.customer_type}</td><td>{customer.phone || "-"}</td><td>{customer.alternate_phone || "-"}</td><td>{customer.gstin || "-"}</td><td>{customer.credit_days}</td><td>₹{Number(customer.credit_limit || 0).toFixed(2)}</td><td>{customer.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
            </tr>)}
            {filteredCustomers.length === 0 && <tr><td colSpan={8} className="text-center text-muted">No customers found.</td></tr>}
          </tbody>
        </table></div>
      </div></div>

      <MasterEditorModal
        open={modalOpen}
        title={selectedId ? (editing ? "Edit Customer" : "Customer Details") : "New Customer"}
        subtitle="Internal customer IDs/codes are generated automatically and are not shown to the owner."
        onRequestClose={requestClose}
        footer={<><div className="master-modal-footer-group">{selectedId && <button type="button" className={selectedCustomer?.is_active ? "btn btn-outline-danger" : "btn btn-outline-success"} onClick={toggleActive}>{selectedCustomer?.is_active ? "Deactivate" : "Activate"}</button>}</div><div className="master-modal-footer-group">{!editing && selectedId && selectedCustomer?.is_active && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}{editing && <button type="button" className="btn btn-outline-secondary" onClick={requestClose}>Cancel</button>}{editing && <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button>}{editing && <button type="button" className="btn btn-success" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button>}{!editing && <button type="button" className="btn btn-primary" onClick={requestClose}>OK</button>}</div></>}
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="row">
          <div className="col-md-7 mb-3"><label className="form-label">Customer Name *</label><input spellCheck className="form-control" name="name" value={form.name} onChange={handleChange} onBlur={() => titleField("name")} disabled={!editing} autoFocus={editing} /></div>
          <div className="col-md-5 mb-3"><label className="form-label">Customer Type</label><select className="form-select" name="customerType" value={form.customerType} onChange={handleChange} disabled={!editing}><option value="RETAIL">Retail</option><option value="WHOLESALE">Wholesale</option><option value="DISTRIBUTOR">Distributor</option></select></div>
          <div className="col-md-4 mb-3"><label className="form-label">Phone</label><input className="form-control" name="phone" value={form.phone} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Alternate Number</label><input className="form-control" name="alternatePhone" value={form.alternatePhone} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Email</label><input type="email" className="form-control" name="email" value={form.email} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">GSTIN</label><input className="form-control" name="gstin" value={form.gstin} onChange={handleChange} disabled={!editing} maxLength={15} /></div>
          <div className="col-md-8 mb-3"><label className="form-label">Address</label><input spellCheck className="form-control" name="address" value={form.address} onChange={handleChange} disabled={!editing} /></div>
          <IndiaLocationFields form={form} setForm={setForm} disabled={!editing} />
          <div className="col-md-3 mb-3"><label className="form-label">Credit Days</label><input type="number" min="0" className="form-control" name="creditDays" value={form.creditDays} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-3 mb-3"><label className="form-label">Credit Limit</label><input type="number" min="0" step="0.01" className="form-control" name="creditLimit" value={form.creditLimit} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-6 mb-3"><label className="form-label">Notes</label><input spellCheck className="form-control" name="notes" value={form.notes} onChange={handleChange} disabled={!editing} /></div>
        </div>
      </MasterEditorModal>
    </div>
  );
}

export default Customers;
