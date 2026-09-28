import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useUi } from "../context/UiContext";
import MasterEditorModal from "../components/MasterEditorModal";
import { sameForm, toTitleCase } from "../utils/textFormat";

const emptyForm = { code: "", name: "", inventoryRole: "CONS" };

function mapCategory(category) {
  return {
    code: category?.code || "",
    name: category?.name || "",
    inventoryRole: category?.inventory_role || "CONS",
  };
}

function Categories() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadCategories(); }, [showInactive]);

  useEffect(() => {
    const recordId = Number(searchParams.get("record"));
    if (!recordId || categories.length === 0 || selectedId === recordId) return;

    const category = categories.find((item) => Number(item.id) === recordId);
    if (!category) {
      if (!showInactive) setShowInactive(true);
      return;
    }

    const mapped = mapCategory(category);
    setSelectedId(category.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }, [categories, searchParams, selectedId, showInactive]);

  async function loadCategories() {
    try {
      setError("");
      const response = await api.get("/categories", { params: { includeInactive: showInactive } });
      setCategories(response.data.categories);
    } catch (err) {
      console.error(err);
      setError("Unable to load categories.");
    }
  }

  const selectedCategory = categories.find((category) => category.id === selectedId);
  const existingHasItems = Number(selectedCategory?.item_count || 0) > 0;
  const dirty = editing && !sameForm(form, originalForm);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return categories;
    return categories.filter((category) =>
      [category.code, category.name, category.inventory_role]
        .some((value) => String(value || "").toLowerCase().includes(text)),
    );
  }, [categories, search]);

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

  function openCategory(category) {
    clearRecordQuery();
    const mapped = mapCategory(category);
    setSelectedId(category.id);
    setForm(mapped);
    setOriginalForm(mapped);
    setEditing(false);
    setModalOpen(true);
    setError("");
  }

  async function requestClose() {
    if (dirty) {
      const discard = await confirmAction({
        title: "Discard category changes?",
        message: "This category has unsaved changes.",
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
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "code" ? value.toUpperCase() : value,
    }));
  }

  async function save(closeAfter) {
    setError("");

    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name: toTitleCase(form.name),
    };

    if (!payload.code) {
      setError("Category code is required.");
      return;
    }
    if (!payload.name) {
      setError("Category name is required.");
      return;
    }

    try {
      setSaving(true);
      const wasExisting = Boolean(selectedId);
      const response = wasExisting
        ? await api.put(`/categories/${selectedId}`, payload)
        : await api.post("/categories", payload);

      const saved = response.data.category;
      const mapped = mapCategory(saved);
      setSelectedId(saved.id);
      setForm(mapped);
      setOriginalForm(mapped);
      setEditing(!closeAfter);
      await loadCategories();
      toastSuccess(
        wasExisting ? "Category updated successfully." : "Category created successfully.",
        "Category saved",
      );

      if (closeAfter) {
        setModalOpen(false);
        clearRecordQuery();
      }
    } catch (err) {
      const message = err.response?.data?.message || "Unable to save category.";
      setError(message);
      toastError(message, "Category not saved");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const category = categories.find((item) => item.id === selectedId) || selectedCategory;
    if (!category) return;

    const activating = !category.is_active;
    const confirmed = await confirmAction({
      title: activating ? "Activate category?" : "Deactivate category?",
      message: activating
        ? `${category.name} will become available for item setup.`
        : `${category.name} will be unavailable for new item setup.`,
      detail: "Existing item/history links are never deleted.",
      confirmLabel: activating ? "Activate Category" : "Deactivate Category",
      cancelLabel: "Keep Unchanged",
      variant: activating ? "primary" : "warning",
    });

    if (!confirmed) return;

    try {
      await api.patch(`/categories/${category.id}/${activating ? "activate" : "deactivate"}`);
      await loadCategories();
      setModalOpen(false);
      clearRecordQuery();
      toastSuccess(`Category ${activating ? "activated" : "deactivated"} successfully.`);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to update category status.";
      setError(message);
      toastError(message);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Item Categories</h2>
          <p className="text-muted mb-0">
            Category code and name can be corrected without disconnecting existing items.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>+ New Category</button>
      </div>

      {error && !modalOpen && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <input
              className="form-control"
              style={{ maxWidth: 520 }}
              placeholder="Search categories..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="form-check">
              <input
                id="showInactiveCategories"
                type="checkbox"
                className="form-check-input"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="showInactiveCategories">Show Inactive</label>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr><th>Code</th><th>Name</th><th>Inventory Role</th><th>Items</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map((category) => (
                  <tr
                    key={category.id}
                    className="row-clickable"
                    data-workspace-path={`/categories?record=${category.id}`} data-workspace-title={category.name}
                    onClick={() => openCategory(category)}
                  >
                    <td>{category.code}</td>
                    <td><strong>{category.name}</strong></td>
                    <td>{category.inventory_role}</td>
                    <td>{category.item_count ?? 0}</td>
                    <td>
                      {category.is_active
                        ? <span className="badge text-bg-success">Active</span>
                        : <span className="badge text-bg-secondary">Inactive</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted">No categories found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MasterEditorModal
        open={modalOpen}
        title={selectedId ? (editing ? "Edit Category" : "Category Details") : "New Category"}
        subtitle={
          selectedId
            ? "Code and name are editable. Existing items stay linked by the category's internal ID."
            : "Create a new item category."
        }
        onRequestClose={requestClose}
        footer={
          <>
            <div className="master-modal-footer-group">
              {selectedId && (
                <button
                  type="button"
                  className={selectedCategory?.is_active ? "btn btn-outline-danger" : "btn btn-outline-success"}
                  onClick={toggleActive}
                >
                  {selectedCategory?.is_active ? "Deactivate" : "Activate"}
                </button>
              )}
            </div>
            <div className="master-modal-footer-group">
              {!editing && selectedId && selectedCategory?.is_active && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
              )}
              {editing && <button type="button" className="btn btn-outline-secondary" onClick={requestClose}>Cancel</button>}
              {editing && (
                <button type="button" className="btn btn-outline-primary" disabled={saving} onClick={() => save(false)}>
                  {saving ? "Saving..." : "Apply"}
                </button>
              )}
              {editing && (
                <button type="button" className="btn btn-success" disabled={saving} onClick={() => save(true)}>
                  {saving ? "Saving..." : "OK"}
                </button>
              )}
              {!editing && <button type="button" className="btn btn-primary" onClick={requestClose}>OK</button>}
            </div>
          </>
        }
      >
        {error && <div className="alert alert-danger">{error}</div>}

        {selectedId && existingHasItems && (
          <div className="master-readonly-note mb-3">
            This category is used by {selectedCategory.item_count} item(s). You may change the
            <strong> Code</strong> and <strong>Name</strong>. Inventory Role stays locked because it controls
            manufacturing, stock and sales behaviour.
          </div>
        )}

        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label">Code *</label>
            <input
              className="form-control"
              name="code"
              value={form.code}
              onChange={handleChange}
              disabled={!editing}
              maxLength={20}
              autoFocus={editing}
            />
          </div>

          <div className="col-md-5 mb-3">
            <label className="form-label">Category Name *</label>
            <input
              spellCheck
              className="form-control"
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={() => setForm((current) => ({ ...current, name: toTitleCase(current.name) }))}
              disabled={!editing}
            />
          </div>

          <div className="col-md-3 mb-3">
            <label className="form-label">Inventory Role *</label>
            <select
              className="form-select"
              name="inventoryRole"
              value={form.inventoryRole}
              onChange={handleChange}
              disabled={!editing || (Boolean(selectedId) && existingHasItems)}
            >
              <option value="RAW">Raw Material</option>
              <option value="PACK">Packaging</option>
              <option value="FG">Finished Good</option>
              <option value="CONS">Consumable / Other</option>
            </select>
          </div>
        </div>
      </MasterEditorModal>
    </div>
  );
}

export default Categories;
