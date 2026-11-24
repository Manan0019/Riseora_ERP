import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useUi } from "../context/UiContext";
import { useWorkspaceTab } from "../context/WorkspaceTabContext";
import MasterEditorModal from "../components/MasterEditorModal";
import SortableTh, { useSortableRows } from "../components/SortableTh";
import { sameForm, toTitleCase } from "../utils/textFormat";
import { clearInvalidField } from "../utils/entryValidation";

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
  const { active: workspaceTabActive, markClean: markWorkspaceTabClean } = useWorkspaceTab();
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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [customCode, setCustomCode] = useState(false);
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState({});

  useEffect(() => { if (workspaceTabActive) loadItems(); }, [showInactive, workspaceTabActive]);
  useEffect(() => { if (workspaceTabActive) loadLookups(); }, [workspaceTabActive]);

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
    setInvalidFields({});
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

  useEffect(() => {
    if (!modalOpen || !editing || selectedId || !form.categoryId || customCode) return;
    let ignore = false;
    const categoryId = form.categoryId;
    api.get("/items/next-code", { params: { categoryId } }).then((response) => {
      if (!ignore) setForm((current) => current.categoryId === categoryId ? { ...current, code: response.data.code } : current);
    }).catch((err) => {
      if (!ignore) toastError(err.response?.data?.message || "Unable to generate item code.");
    });
    return () => { ignore = true; };
  }, [form.categoryId, modalOpen, editing, selectedId, customCode]);

  const selectedItem = items.find((item) => item.id === selectedId);
  const dirty = editing && !sameForm(form, originalForm);

  const filteredItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    const selectedCategoryId = categoryFilter ? Number(categoryFilter) : null;

    return items.filter((item) => {
      if (selectedCategoryId != null && Number(item.category_id) !== selectedCategoryId) return false;
      if (!text) return true;

      return [item.name, item.category_name, item.unit_code, item.hsn_code]
        .some((value) => String(value || "").toLowerCase().includes(text));
    });
  }, [items, search, categoryFilter]);

  const { sortedRows: sortedItems, sort: itemSort, toggle: sortItems } = useSortableRows(filteredItems, "name");

  const selectedFilterCategory = categoryFilter
    ? categories.find((category) => Number(category.id) === Number(categoryFilter))
    : null;

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
    setCustomCode(false);
    setOriginalForm(emptyForm);
    setEditing(true);
    setModalOpen(true);
    setInvalidFields({});
    setError("");
  }

  function openItem(item) {
    clearRecordQuery();
    const mapped = mapItem(item);
    setSelectedId(item.id);
    setForm(mapped);
    setCustomCode(true);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setInvalidFields({});
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
    clearInvalidField(setInvalidFields, name);
    if (name === "code") setCustomCode(Boolean(value.trim()));
    if (name === "categoryId" && !selectedId) setCustomCode(false);
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : (name === "code" || name === "hsnCode") ? value.toUpperCase() : value,
    }));
  }

  function validate(payload) {
    const issues = [];
    const fail = (field, message) => issues.push({ field, message });
    if (!payload.code.trim() && selectedId) fail("code", "Item code is required.");
    if (!payload.name.trim()) fail("name", "Item name is required.");
    if (!payload.categoryId) fail("categoryId", "Category is required.");
    if (!payload.baseUnitId) fail("baseUnitId", "Base unit is required.");
    if (Number(payload.reorderLevel) < 0) fail("reorderLevel", "Reorder level cannot be negative.");
    if (payload.density && Number(payload.density) <= 0) fail("density", "Density must be greater than zero.");
    if (Number(payload.defaultSellingPrice || 0) < 0) fail("defaultSellingPrice", "Default selling price cannot be negative.");
    if (Number(payload.targetMarginPercent || 0) < 0 || Number(payload.targetMarginPercent || 0) >= 100) fail("targetMarginPercent", "Target margin must be between 0 and less than 100 percent.");
    if (Number(payload.defaultGstRate || 0) < 0 || Number(payload.defaultGstRate || 0) > 100) fail("defaultGstRate", "Default GST rate must be between 0 and 100 percent.");
    return issues;
  }

  async function save(closeAfter) {
    setError("");
    const payload = { ...form, name: toTitleCase(form.name) };
    const issues = validate(payload);
    if (issues.length) {
      setInvalidFields(Object.fromEntries(issues.map(({ field }) => [field, true])));
      setError(issues[0].message);
      toastError(issues[0].message, "Check item details");
      return;
    }
    setInvalidFields({});

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
      markWorkspaceTabClean();
      setInvalidFields({});
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
      markWorkspaceTabClean();
      setInvalidFields({});
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
          <p className="text-muted mb-0">Edit any item, including the preloaded Excel catalogue. Item code, name, price, HSN, GST and density are editable; base unit/category remain locked after business transactions.</p>
        </div>
        <button type="button" className="btn btn-primary" data-pro-action="new" onClick={openNew}>+ New Item</button>
      </div>

      {error && !modalOpen && <div className="alert alert-danger">{error}</div>}

      <div className="card"><div className="card-body">
        <div className="item-list-toolbar mb-3">
          <input
            className="form-control item-list-search"
            placeholder="Search item name, category, unit or HSN..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="item-category-filter">
            <label className="form-label mb-1" htmlFor="itemCategoryFilter">Category</label>
            <select
              id="itemCategoryFilter"
              className="form-select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="form-check item-inactive-filter">
            <input id="showInactiveItems" type="checkbox" className="form-check-input" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            <label className="form-check-label" htmlFor="showInactiveItems">Show Inactive</label>
          </div>
        </div>
        <div className="item-filter-summary" aria-live="polite">
          Showing {filteredItems.length} of {items.length} item{items.length === 1 ? "" : "s"}
          {selectedFilterCategory ? ` in ${selectedFilterCategory.name}` : ""}
          {search.trim() ? ` matching “${search.trim()}”` : ""}.
        </div>

        <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
          <thead className="table-light"><tr><SortableTh field="code" sort={itemSort} onSort={sortItems}>Code</SortableTh><SortableTh field="name" sort={itemSort} onSort={sortItems}>Name</SortableTh><SortableTh field="category_name" sort={itemSort} onSort={sortItems}>Category</SortableTh><SortableTh field="unit_code" sort={itemSort} onSort={sortItems}>Unit</SortableTh><SortableTh field="hsn_code" sort={itemSort} onSort={sortItems}>HSN</SortableTh><SortableTh field="default_gst_rate" sort={itemSort} onSort={sortItems}>GST %</SortableTh><SortableTh field="reorder_level" sort={itemSort} onSort={sortItems}>Reorder</SortableTh><SortableTh field="default_selling_price" sort={itemSort} onSort={sortItems}>Sale Price</SortableTh><SortableTh field="target_margin_percent" sort={itemSort} onSort={sortItems}>Target Margin</SortableTh><SortableTh field="track_lot" sort={itemSort} onSort={sortItems}>Lot</SortableTh><SortableTh field="track_expiry" sort={itemSort} onSort={sortItems}>Expiry</SortableTh><SortableTh field="is_active" sort={itemSort} onSort={sortItems}>Status</SortableTh><th>Action</th></tr></thead>
          <tbody>
            {sortedItems.map((item) => <tr key={item.id} className="row-clickable" data-workspace-path={`/items?record=${item.id}`} data-workspace-title={item.name} onClick={() => openItem(item)}>
              <td>{item.code}</td><td><strong>{item.name}</strong></td><td>{item.category_name}</td><td>{item.unit_code}</td><td>{item.hsn_code || "-"}</td><td>{Number(item.default_gst_rate || 0).toFixed(2)}%</td><td>{item.reorder_level}</td><td>₹{Number(item.default_selling_price || 0).toFixed(2)}</td><td>{Number(item.target_margin_percent || 0).toFixed(2)}%</td><td>{item.track_lot ? "Yes" : "No"}</td><td>{item.track_expiry ? "Yes" : "No"}</td><td>{item.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
              <td><button type="button" className="btn btn-sm btn-outline-primary" onClick={(event) => { event.stopPropagation(); openItem(item); setEditing(true); }} aria-label={`Edit ${item.name}`}>Edit</button></td>
            </tr>)}
            {filteredItems.length === 0 && <tr><td colSpan={13} className="text-center text-muted">No items found.</td></tr>}
          </tbody>
        </table></div>
      </div></div>

      <MasterEditorModal
        open={modalOpen}
        invalidFields={invalidFields}
        size="xl"
        title={selectedId ? (editing ? `Edit Item — ${selectedItem?.name || form.name}` : `Item Details — ${selectedItem?.name || form.name}`) : "New Item"}
        subtitle="Right-click a misspelled word for suggestions. Item names are normalized to title case when saved."
        onRequestClose={requestClose}
        footer={<><div className="master-modal-footer-group">{selectedId && <button type="button" className={selectedItem?.is_active ? "btn btn-outline-danger" : "btn btn-outline-success"} onClick={toggleActive}>{selectedItem?.is_active ? "Deactivate" : "Activate"}</button>}</div><div className="master-modal-footer-group">{!editing && selectedId && selectedItem?.is_active && <button type="button" className="btn btn-secondary" data-pro-action="edit" onClick={() => setEditing(true)}>Edit</button>}{editing && <button type="button" className="btn btn-outline-secondary" onClick={requestClose}>Cancel</button>}{editing && <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Apply"}</button>}{editing && <button type="button" className="btn btn-success" disabled={saving} data-pro-action="save" onClick={() => save(true)}>{saving ? "Saving..." : "OK"}</button>}{!editing && <button type="button" className="btn btn-primary" onClick={requestClose}>OK</button>}</div></>}
      >
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="row">
          <div className="col-md-3 mb-3"><label className="form-label">Item Code (Auto / Editable)</label><input className="form-control" name="code" value={form.code} onChange={handleChange} disabled={!editing} maxLength={30} /></div>
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
