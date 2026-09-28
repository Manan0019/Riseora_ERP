import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";
import IndiaLocationFields from "../components/IndiaLocationFields";
import MasterEditorModal from "../components/MasterEditorModal";
import { normalizeTitleCaseFields, sameForm, toTitleCase } from "../utils/textFormat";

const emptyForm = {
  name: "",
  contactPerson: "",
  phone: "",
  alternatePhone: "",
  email: "",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  paymentTermsDays: "0",
  notes: "",
};

function mapSupplier(supplier) {
  return {
    name: supplier?.name || "",
    contactPerson: supplier?.contact_person || "",
    phone: supplier?.phone || "",
    alternatePhone: supplier?.alternate_phone || "",
    email: supplier?.email || "",
    gstin: supplier?.gstin || "",
    address: supplier?.address || "",
    city: supplier?.city || "",
    state: supplier?.state || "",
    pincode: supplier?.pincode || "",
    paymentTermsDays: String(supplier?.payment_terms_days ?? 0),
    notes: supplier?.notes || "",
  };
}

function Suppliers() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadSuppliers(); }, [showInactive]);

  async function loadSuppliers() {
    try {
      setError("");
      const response = await api.get("/suppliers", { params: { includeInactive: showInactive } });
      setSuppliers(response.data.suppliers);
    } catch (err) {
      console.error(err);
      setError("Unable to load suppliers.");
    }
  }

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedId);
  const dirty = editing && !sameForm(form, originalForm);

  const filteredSuppliers = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contact_person, supplier.phone, supplier.alternate_phone, supplier.gstin, supplier.city]
        .some((value) => String(value || "").toLowerCase().includes(text)),
    );
  }, [suppliers, search]);

  function openNew() {
    setSelectedId(null);
    setForm(emptyForm);
    setOriginalForm(emptyForm);
    setEditing(true);
    setModalOpen(true);
    setError("");
  }

  function openSupplier(supplier) {
    const mapped = mapSupplier(supplier);
    setSelectedId(supplier.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }

  async function requestClose() {
    if (dirty) {
      const discard = await confirmAction({
        title: "Discard supplier changes?",
        message: "This supplier has unsaved changes.",
        detail: "Choose Discard Changes to close without saving, or Continue Editing to return to the popup.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Continue Editing",
        variant: "warning",
      });
      if (!discard) return;
    }
    setModalOpen(false);
    setEditing(false);
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
    const payload = normalizeTitleCaseFields(form, ["name", "contactPerson", "city", "state"]);
    if (!payload.name.trim()) { setError("Supplier name is required."); return; }
    if (Number(payload.paymentTermsDays) < 0) { setError("Payment terms cannot be negative."); return; }

    try {
      setSaving(true);
      const response = selectedId
        ? await api.put(`/suppliers/${selectedId}`, payload)
        : await api.post("/suppliers", payload);

      const saved = response.data.supplier;
      const mapped = mapSupplier(saved);
      setSelectedId(saved.id);
      setForm(mapped);
      setOriginalForm(mapped);
      setEditing(!closeAfter);
      await loadSuppliers();
      toastSuccess(selectedId ? "Supplier updated successfully." : "Supplier created successfully.", "Supplier saved");
      if (closeAfter) setModalOpen(false);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to save supplier.";
      setError(message);
      toastError(message, "Supplier not saved");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const supplier = suppliers.find((item) => item.id === selectedId) || selectedSupplier;
    if (!supplier) return;
    const activating = !supplier.is_active;
    const confirmed = await confirmAction({
      title: activating ? "Activate supplier?" : "Deactivate supplier?",
      message: activating
        ? `${supplier.name} will become available for new purchases.`
        : `${supplier.name} will no longer be available for new purchases.`,
      detail: "Historical purchases, payments and ledger records remain unchanged.",
      confirmLabel: activating ? "Activate Supplier" : "Deactivate Supplier",
      cancelLabel: "Keep Unchanged",
      variant: activating ? "primary" : "warning",
    });
    if (!confirmed) return;

    try {
      await api.patch(`/suppliers/${supplier.id}/${activating ? "activate" : "deactivate"}`);
      await loadSuppliers();
      setModalOpen(false);
      toastSuccess(`Supplier ${activating ? "activated" : "deactivated"} successfully.`);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to update supplier status.";
      setError(message);
      toastError(message);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Suppliers</h2>
          <p className="text-muted mb-0">Maintain suppliers without exposing internal ERP codes.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Supplier</button>
      </div>

      {error && !modalOpen && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <input className="form-control" style={{ maxWidth: 520 }} placeholder="Search supplier name, phone, GSTIN or city..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="form-check">
              <input id="showInactiveSuppliers" type="checkbox" className="form-check-input" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              <label className="form-check-label" htmlFor="showInactiveSuppliers">Show Inactive</label>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light"><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Alternate No.</th><th>GSTIN</th><th>Terms</th><th>Status</th></tr></thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="row-clickable" onClick={() => openSupplier(supplier)}>
                    <td><strong>{supplier.name}</strong></td>
                    <td>{supplier.contact_person || "-"}</td>
                    <td>{supplier.phone || "-"}</td>
                    <td>{supplier.alternate_phone || "-"}</td>
                    <td>{supplier.gstin || "-"}</td>
                    <td>{supplier.payment_terms_days} days</td>
                    <td>{supplier.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && <tr><td colSpan={7} className="text-center text-muted">No suppliers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MasterEditorModal
        open={modalOpen}
        title={selectedId ? (editing ? "Edit Supplier" : "Supplier Details") : "New Supplier"}
        subtitle="Internal supplier codes are created automatically and are not shown to the owner."
        onRequestClose={requestClose}
        footer={
          <>
            <div className="master-modal-footer-group">
              {selectedId && <button type="button" className={selectedSupplier?.is_active ? "btn btn-outline-danger" : "btn btn-outline-success"} onClick={toggleActive}>{selectedSupplier?.is_active ? "Deactivate" : "Activate"}</button>}
            </div>
            <div className="master-modal-footer-group">
              {!editing && selectedId && selectedSupplier?.is_active && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
              {editing && <button type="button" className="btn btn-outline-secondary" onClick={requestClose}>Cancel</button>}
              {editing && <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button>}
              {editing && <button type="button" className="btn btn-success" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button>}
              {!editing && <button type="button" className="btn btn-primary" onClick={requestClose}>OK</button>}
            </div>
          </>
        }
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="row">
          <div className="col-md-7 mb-3"><label className="form-label">Supplier Name *</label><input spellCheck className="form-control" name="name" value={form.name} onChange={handleChange} onBlur={() => titleField("name")} disabled={!editing} autoFocus={editing} /></div>
          <div className="col-md-5 mb-3"><label className="form-label">Contact Person</label><input spellCheck className="form-control" name="contactPerson" value={form.contactPerson} onChange={handleChange} onBlur={() => titleField("contactPerson")} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Phone</label><input className="form-control" name="phone" value={form.phone} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Alternate Number</label><input className="form-control" name="alternatePhone" value={form.alternatePhone} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Email</label><input type="email" className="form-control" name="email" value={form.email} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">GSTIN</label><input className="form-control" name="gstin" value={form.gstin} onChange={handleChange} disabled={!editing} maxLength={15} /></div>
          <div className="col-md-8 mb-3"><label className="form-label">Address</label><input spellCheck className="form-control" name="address" value={form.address} onChange={handleChange} disabled={!editing} /></div>
          <IndiaLocationFields form={form} setForm={setForm} disabled={!editing} />
          <div className="col-md-4 mb-3"><label className="form-label">Payment Terms (Days)</label><input type="number" min="0" className="form-control" name="paymentTermsDays" value={form.paymentTermsDays} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-8 mb-3"><label className="form-label">Notes</label><input spellCheck className="form-control" name="notes" value={form.notes} onChange={handleChange} disabled={!editing} /></div>
        </div>
      </MasterEditorModal>
    </div>
  );
}

export default Suppliers;
