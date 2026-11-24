import MasterEditorModal from "../components/MasterEditorModal";
import SortableTh, { useSortableRows } from "../components/SortableTh";
import { useEffect, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";

const emptyForm = {
  code: "",
  name: "",
  unitType: "VOLUME",
};

function Units() {
  const { confirm: confirmAction } = useUi();
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUnits();
  }, [showInactive]);

  const loadUnits = async () => {
    try {
      setError("");

      const response = await api.get("/units", {
        params: {
          includeInactive: showInactive,
        },
      });

      setUnits(response.data.units);
    } catch (err) {
      console.error(err);
      setError("Unable to load units.");
    }
  };

  const handleNew = () => {
    setForm(emptyForm);
    setSelectedId(null);
    setEditing(true);
    setShowForm(true);

    setMessage("");
    setError("");
  };

  const handleSelect = (unit) => {
    setSelectedId(unit.id);

    setForm({
      code: unit.code,
      name: unit.name,
      unitType: unit.unit_type,
    });

    setEditing(false);
    setShowForm(true);

    setMessage("");
    setError("");
  };

  const handleEdit = () => {
    if (!selectedId) {
      setError("Please select a unit first.");
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedId);

    if (!selectedUnit?.is_active) {
      setError("Inactive unit cannot be edited. Activate it first.");
      return;
    }

    setEditing(true);
    setMessage("");
    setError("");
  };

  const handleCancel = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setEditing(false);
    setShowForm(false);

    setMessage("");
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "code" ? value.toUpperCase() : value,
    }));
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    if (!form.code.trim()) {
      setError("Unit code is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Unit name is required.");
      return;
    }

    try {
      setSaving(true);

      if (selectedId) {
        await api.put(`/units/${selectedId}`, form);
        setMessage("Unit updated successfully.");
      } else {
        await api.post("/units", form);
        setMessage("Unit created successfully.");
      }

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadUnits();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save unit.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedId) {
      setError("Please select a unit first.");
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedId);

    if (!selectedUnit) {
      setError("Selected unit could not be found.");
      return;
    }

    if (!selectedUnit.is_active) {
      setError("This unit is already inactive.");
      return;
    }

    const confirmed = await confirmAction({
      title: "Deactivate unit?",
      message: `${selectedUnit.code} - ${selectedUnit.name} will no longer be available for new master or transaction entries.`,
      detail: "Existing historical records keep their original unit.",
      confirmLabel: "Deactivate Unit",
      cancelLabel: "Keep Active",
      variant: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await api.patch(`/units/${selectedId}/deactivate`);

      setMessage("Unit deactivated successfully.");

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadUnits();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate unit.");
    }
  };

  const handleActivate = async () => {
    if (!selectedId) {
      setError("Please select a unit first.");
      return;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedId);

    if (!selectedUnit) {
      setError("Selected unit could not be found.");
      return;
    }

    if (selectedUnit.is_active) {
      setError("This unit is already active.");
      return;
    }

    const confirmed = await confirmAction({
      title: "Activate unit?",
      message: `${selectedUnit.code} - ${selectedUnit.name} will become available for new entries.`,
      confirmLabel: "Activate Unit",
      cancelLabel: "Keep Inactive",
      variant: "primary",
    });

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await api.patch(`/units/${selectedId}/activate`);

      setMessage("Unit activated successfully.");

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadUnits();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to activate unit.");
    }
  };

  const selectedUnit = units.find((unit) => unit.id === selectedId);

  const filteredUnits = units.filter((unit) => {
    const text = search.toLowerCase();

    return (
      unit.code.toLowerCase().includes(text) ||
      unit.name.toLowerCase().includes(text) ||
      unit.unit_type.toLowerCase().includes(text)
    );
  });

  const { sortedRows: unitsSorted, sort: tableSort, toggle: toggleSort } = useSortableRows(filteredUnits, "code");

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Units</h2>

        <p className="text-muted mb-0">
          Measurement units used for inventory, formulas and production.
        </p>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="d-flex gap-2 flex-wrap mb-3">
        <button
          type="button"
          className="btn btn-primary"
          data-pro-action="new" onClick={handleNew}
          disabled={editing}
        >
          New
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleEdit}
          disabled={!selectedId || editing || !selectedUnit?.is_active}
        >
          Edit
        </button>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleCancel}
          disabled={!showForm}
        >
          Cancel
        </button>

        <button
          type="button"
          className="btn btn-outline-danger"
          onClick={handleDeactivate}
          disabled={!selectedId || editing || !selectedUnit?.is_active}
        >
          Deactivate
        </button>

        <button
          type="button"
          className="btn btn-outline-success"
          onClick={handleActivate}
          disabled={!selectedId || editing || selectedUnit?.is_active}
        >
          Activate
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search units..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <MasterEditorModal open={showForm} size="lg" title={selectedId ? (editing ? "Edit Unit" : "Unit Details") : "New Unit"} onRequestClose={handleCancel}>
      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="mb-3">
              {selectedId
                ? editing
                  ? "Edit Unit"
                  : "Unit Details"
                : "New Unit"}
            </h5>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label">Code *</label>

                <input
                  type="text"
                  className="form-control"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  maxLength={10}
                  disabled={!editing}
                  autoFocus={editing}
                />
              </div>

              <div className="col-md-5 mb-3">
                <label className="form-label">Name *</label>

                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Unit Type *</label>

                <select
                  className="form-select"
                  name="unitType"
                  value={form.unitType}
                  onChange={handleChange}
                  disabled={!editing}
                >
                  <option value="VOLUME">Volume</option>

                  <option value="WEIGHT">Weight</option>

                  <option value="COUNT">Count</option>
                </select>
              </div>
            </div>

            {!editing && selectedUnit?.is_active && <button type="button" className="btn btn-outline-primary me-2" onClick={handleEdit}>Edit</button>}
            {!editing && selectedUnit?.is_active && <button type="button" className="btn btn-outline-danger me-2" onClick={handleDeactivate}>Deactivate</button>}
            {!editing && selectedUnit && !selectedUnit.is_active && <button type="button" className="btn btn-outline-success me-2" onClick={handleActivate}>Activate</button>}
            <button
              type="button"
              className="btn btn-success"
              data-pro-action="save" onClick={handleSave}
              disabled={!editing || saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

        <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}>Close</button>
      </MasterEditorModal>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Units List</h5>

            <div className="form-check">
              <input
                id="showInactive"
                type="checkbox"
                className="form-check-input"
                checked={showInactive}
                onChange={(event) => {
                  setShowInactive(event.target.checked);

                  setSelectedId(null);
                  setForm(emptyForm);
                  setEditing(false);
                  setShowForm(false);
                }}
              />

              <label className="form-check-label" htmlFor="showInactive">
                Show Inactive
              </label>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <SortableTh field="code" sort={tableSort} onSort={toggleSort}>Code</SortableTh>
                  <SortableTh field="name" sort={tableSort} onSort={toggleSort}>Name</SortableTh>
                  <SortableTh field="unit_type" sort={tableSort} onSort={toggleSort}>Type</SortableTh>
                  <SortableTh field="is_active" sort={tableSort} onSort={toggleSort}>Status</SortableTh>
                </tr>
              </thead>

              <tbody>
                {unitsSorted.map((unit) => (
                  <tr
                    key={unit.id}
                    onClick={() => handleSelect(unit)}
                    style={{
                      cursor: "pointer",
                    }}
                    className={selectedId === unit.id ? "table-primary" : ""}
                  >
                    <td>{unit.code}</td>
                    <td>{unit.name}</td>
                    <td>{unit.unit_type}</td>

                    <td>
                      {unit.is_active ? (
                        <span className="badge text-bg-success">Active</span>
                      ) : (
                        <span className="badge text-bg-secondary">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredUnits.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      No units found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Units;
