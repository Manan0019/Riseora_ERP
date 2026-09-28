import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useUi } from "../context/UiContext";
import MasterEditorModal from "../components/MasterEditorModal";
import { sameForm, toTitleCase } from "../utils/textFormat";

const emptyForm = {
  code: "",
  name: "",
  categoryId: "",
  baseUnitId: "",
  reorderLevel: "0",
  trackLot: false,
  trackExpiry: false,
  density: "",
  defaultSellingPrice: "0",
  targetMarginPercent: "0",
  hsnCode: "",
  defaultGstRate: "0",
  notes: "",
};

function mapItem(item) {
  return {
    code: item?.code || "",
    name: item?.name || "",
    categoryId: String(item?.category_id || ""),
    baseUnitId: String(item?.base_unit_id || ""),
    reorderLevel: String(item?.reorder_level ?? 0),
    trackLot: Boolean(item?.track_lot),
    trackExpiry: Boolean(item?.track_expiry),
    density: item?.density == null ? "" : String(item.density),
    defaultSellingPrice: String(item?.default_selling_price ?? 0),
    targetMarginPercent: String(item?.target_margin_percent ?? 0),
    hsnCode: item?.hsn_code || "",
    defaultGstRate: String(item?.default_gst_rate ?? 0),
    notes: item?.notes || "",
  };
}

function Items() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadItems(); }, [showInactive]);
  useEffect(() => { loadLookups(); }, []);

  useEffect(() => {
    const recordId = Number(searchParams.get("record"));
    if (!recordId || items.length === 0 || selectedId === recordId) return;

    const item = items.find((entry) => Number(entry.id) === recordId);
    if (!item) {
      if (!showInactive) setShowInactive(true);
      return;
    }

    const mapped = mapItem(item);
    setSelectedId(item.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }, [items, searchParams, selectedId, showInactive]);

  async function loadItems() {
    try {
      setError("");
      const response = await api.get("/items", { params: { includeInactive: showInactive } });
      setItems(response.data.items);
    } catch (err) {
      console.error(err);
      setError("Unable to load items.");
    }
  }

  async function loadLookups() {
    try {
      const [categoryResponse, unitResponse] = await Promise.all([api.get("/categories"), api.get("/units")]);
      setCategories(categoryResponse.data.categories);
      setUnits(unitResponse.data.units);
    } catch (err) {
      console.error(err);
      setError("Unable to load categories or units.");
    }
  }

  const selectedItem = items.find((item) => item.id === selectedId);
  const dirty = editing && !sameForm(form, originalForm);

  const filteredItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) =>
      [item.code, item.name, item.category_name, item.unit_code, item.hsn_code]
        .some((value) => String(value || "").toLowerCase().includes(text)),
    );
  }, [items, search]);

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

  function openItem(item) {
    clearRecordQuery();
    const mapped = mapItem(item);
    setSelectedId(item.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }

  async function requestClose() {
    if (dirty) {
      const discard = await confirmAction({
        title: "Discard item changes?",
        message: "This item has unsaved changes.",
        detail: "Choose Discard Changes to close the popup, or Continue Editing to keep working.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Continue Editing",
        variant: "warning",
      });
      if (!discard) return;
    }
    setModalOpen(false);
    setEditing(false);
    setError("");
    clearRecordQuery();
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : (name === "code" || name === "hsnCode") ? value.toUpperCase() : value,
    }));
  }

  function validate(payload) {
    if (!payload.code.trim()) return "Item code is required.";
    if (!payload.name.trim()) return "Item name is required.";
    if (!payload.categoryId) return "Category is required.";
    if (!payload.baseUnitId) return "Base unit is required.";
    if (Number(payload.reorderLevel) < 0) return "Reorder level cannot be negative.";
    if (payload.density && Number(payload.density) <= 0) return "Density must be greater than zero.";
    if (Number(payload.defaultSellingPrice || 0) < 0) return "Default selling price cannot be negative.";
    if (Number(payload.targetMarginPercent || 0) < 0 || Number(payload.targetMarginPercent || 0) >= 100) return "Target margin must be between 0 and less than 100 percent.";
    if (Number(payload.defaultGstRate || 0) < 0 || Number(payload.defaultGstRate || 0) > 100) return "Default GST rate must be between 0 and 100 percent.";
    return null;
  }

  async function save(closeAfter) {
    setError("");
    const payload = { ...form, name: toTitleCase(form.name) };
    const validationError = validate(payload);
    if (validationError) { setError(validationError); return; }

    try {
      setSaving(true);
      const response = selectedId
        ? await api.put(`/items/${selectedId}`, payload)
        : await api.post("/items", payload);
      const saved = response.data.item;
      const fullSaved = {
        ...(selectedId ? selectedItem : {}),
        ...saved,
      };
      const mapped = mapItem(fullSaved);
      setSelectedId(saved.id);
      setForm(mapped);
      setOriginalForm(mapped);
      setEditing(!closeAfter);
      await loadItems();
      toastSuccess(selectedId ? "Item updated successfully." : "Item created successfully.", "Item saved");
      if (closeAfter) {
        setModalOpen(false);
        clearRecordQuery();
      }
    } catch (err) {
      const message = err.response?.data?.message || "Unable to save item.";
      setError(message);
      toastError(message, "Item not saved");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const item = items.find((entry) => entry.id === selectedId) || selectedItem;
    if (!item) return;
    const activating = !item.is_active;
    const confirmed = await confirmAction({
      title: activating ? "Activate item?" : "Deactivate item?",
      message: activating ? `${item.name} will become available for new transactions.` : `${item.name} will be hidden from new transactions.`,
      detail: activating ? "Existing history remains unchanged." : "The server will block deactivation if stock or active formula dependencies make it unsafe.",
      confirmLabel: activating ? "Activate Item" : "Deactivate Item",
      cancelLabel: "Keep Unchanged",
      variant: activating ? "primary" : "warning",
    });
    if (!confirmed) return;

    try {
      await api.patch(`/items/${item.id}/${activating ? "activate" : "deactivate"}`);
      await loadItems();
      setModalOpen(false);
      clearRecordQuery();
      toastSuccess(`Item ${activating ? "activated" : "deactivated"} successfully.`);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to update item status.";
      setError(message);
      toastError(message);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Item Master</h2>
          <p className="text-muted mb-0">Search the full item list and edit an item in a popup without losing your scroll position.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Item</button>
      </div>

      {error && !modalOpen && <div className="alert alert-danger">{error}</div>}

      <div className="card"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
          <input className="form-control" style={{ maxWidth: 620 }} placeholder="Search item name, code, category, unit or HSN..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="form-check"><input id="showInactiveItems" type="checkbox" className="form-check-input" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /><label className="form-check-label" htmlFor="showInactiveItems">Show Inactive</label></div>
        </div>

        <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
          <thead className="table-light"><tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>HSN</th><th>GST %</th><th>Reorder</th><th>Sale Price</th><th>Target Margin</th><th>Lot</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {filteredItems.map((item) => <tr key={item.id} className="row-clickable" data-workspace-path={`/items?record=${item.id}`} data-workspace-title={item.name} onClick={() => openItem(item)}>
              <td>{item.code}</td><td><strong>{item.name}</strong></td><td>{item.category_name}</td><td>{item.unit_code}</td><td>{item.hsn_code || "-"}</td><td>{Number(item.default_gst_rate || 0).toFixed(2)}%</td><td>{item.reorder_level}</td><td>₹{Number(item.default_selling_price || 0).toFixed(2)}</td><td>{Number(item.target_margin_percent || 0).toFixed(2)}%</td><td>{item.track_lot ? "Yes" : "No"}</td><td>{item.track_expiry ? "Yes" : "No"}</td><td>{item.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
            </tr>)}
            {filteredItems.length === 0 && <tr><td colSpan={12} className="text-center text-muted">No items found.</td></tr>}
          </tbody>
        </table></div>
      </div></div>

      <MasterEditorModal
        open={modalOpen}
        size="xl"
        title={selectedId ? (editing ? `Edit Item — ${selectedItem?.name || form.name}` : `Item Details — ${selectedItem?.name || form.name}`) : "New Item"}
        subtitle="Right-click a misspelled word for suggestions. Item names are normalized to title case when saved."
        onRequestClose={requestClose}
        footer={<><div className="master-modal-footer-group">{selectedId && <button type="button" className={selectedItem?.is_active ? "btn btn-outline-danger" : "btn btn-outline-success"} onClick={toggleActive}>{selectedItem?.is_active ? "Deactivate" : "Activate"}</button>}</div><div className="master-modal-footer-group">{!editing && selectedId && selectedItem?.is_active && <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}{editing && <button type="button" className="btn btn-outline-secondary" onClick={requestClose}>Cancel</button>}{editing && <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button>}{editing && <button type="button" className="btn btn-success" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button>}{!editing && <button type="button" className="btn btn-primary" onClick={requestClose}>OK</button>}</div></>}
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="row">
          <div className="col-md-3 mb-3"><label className="form-label">Item Code *</label><input className="form-control" name="code" value={form.code} onChange={handleChange} disabled={!editing} maxLength={30} /></div>
          <div className="col-md-5 mb-3"><label className="form-label">Item Name *</label><input spellCheck className="form-control" name="name" value={form.name} onChange={handleChange} onBlur={() => setForm((current) => ({ ...current, name: toTitleCase(current.name) }))} disabled={!editing} autoFocus={editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Category *</label><select className="form-select" name="categoryId" value={form.categoryId} onChange={handleChange} disabled={!editing}><option value="">Select Category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} [{category.inventory_role || "CONS"}]</option>)}</select></div>
          <div className="col-md-4 mb-3"><label className="form-label">Base Unit *</label><select className="form-select" name="baseUnitId" value={form.baseUnitId} onChange={handleChange} disabled={!editing}><option value="">Select Unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>)}</select></div>
          <div className="col-md-4 mb-3"><label className="form-label">Reorder Level</label><input type="number" min="0" step="0.001" className="form-control" name="reorderLevel" value={form.reorderLevel} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Density (g/mL)</label><input type="number" min="0" step="0.0001" className="form-control" name="density" value={form.density} onChange={handleChange} disabled={!editing} placeholder="Optional" /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Default Selling Price</label><div className="input-group"><span className="input-group-text">₹</span><input type="number" min="0" step="0.01" className="form-control" name="defaultSellingPrice" value={form.defaultSellingPrice} onChange={handleChange} disabled={!editing} /></div></div>
          <div className="col-md-4 mb-3"><label className="form-label">Target Gross Margin %</label><input type="number" min="0" max="99.99" step="0.01" className="form-control" name="targetMarginPercent" value={form.targetMarginPercent} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">HSN Code</label><input className="form-control" name="hsnCode" value={form.hsnCode} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-4 mb-3"><label className="form-label">Default GST %</label><input type="number" min="0" max="100" step="0.01" className="form-control" name="defaultGstRate" value={form.defaultGstRate} onChange={handleChange} disabled={!editing} /></div>
          <div className="col-md-3 mb-3"><div className="form-check mt-4"><input id="modalTrackLot" type="checkbox" className="form-check-input" name="trackLot" checked={form.trackLot} onChange={handleChange} disabled={!editing} /><label className="form-check-label" htmlFor="modalTrackLot">Track Batch / Lot</label></div></div>
          <div className="col-md-3 mb-3"><div className="form-check mt-4"><input id="modalTrackExpiry" type="checkbox" className="form-check-input" name="trackExpiry" checked={form.trackExpiry} onChange={handleChange} disabled={!editing} /><label className="form-check-label" htmlFor="modalTrackExpiry">Track Expiry</label></div></div>
          <div className="col-md-6 mb-3"><label className="form-label">Notes</label><input spellCheck className="form-control" name="notes" value={form.notes} onChange={handleChange} disabled={!editing} /></div>
        </div>
      </MasterEditorModal>
    </div>
  );
}

export default Items;
