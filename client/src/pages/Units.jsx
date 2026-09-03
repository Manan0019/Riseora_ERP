import { useEffect, useState } from "react";
import api from "../api/api";

const emptyForm = {
  code: "",
  name: "",
  unitType: "VOLUME",
};

function Units() {
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

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

    const selectedUnit = units.find(
      (unit) => unit.id === selectedId
    );

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
      [name]:
        name === "code"
          ? value.toUpperCase()
          : value,
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
      setError(
        err.response?.data?.message ||
          "Unable to save unit."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedId) {
      setError("Please select a unit first.");
      return;
    }

    const selectedUnit = units.find(
      (unit) => unit.id === selectedId
    );

    if (!selectedUnit) {
      setError("Selected unit could not be found.");
      return;
    }

    if (!selectedUnit.is_active) {
      setError("This unit is already inactive.");
      return;
    }

    const confirmed = window.confirm(
      `Deactivate "${selectedUnit.code} - ${selectedUnit.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await api.patch(
        `/units/${selectedId}/deactivate`
      );

      setMessage("Unit deactivated successfully.");

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadUnits();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to deactivate unit."
      );
    }
  };

  const handleActivate = async () => {
    if (!selectedId) {
      setError("Please select a unit first.");
      return;
    }

    const selectedUnit = units.find(
      (unit) => unit.id === selectedId
    );

    if (!selectedUnit) {
      setError("Selected unit could not be found.");
      return;
    }

    if (selectedUnit.is_active) {
      setError("This unit is already active.");
      return;
    }

    const confirmed = window.confirm(
      `Activate "${selectedUnit.code} - ${selectedUnit.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await api.patch(
        `/units/${selectedId}/activate`
      );

      setMessage("Unit activated successfully.");

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadUnits();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to activate unit."
      );
    }
  };

  const selectedUnit = units.find(
    (unit) => unit.id === selectedId
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Units</h2>

        <p className="text-muted mb-0">
          Measurement units used for inventory, formulas and production.
        </p>
      </div>

      {message && (
        <div className="alert alert-success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="d-flex gap-2 flex-wrap mb-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleNew}
          disabled={editing}
        >
          New
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleEdit}
          disabled={
            !selectedId ||
            editing ||
            !selectedUnit?.is_active
          }
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
          disabled={
            !selectedId ||
            editing ||
            !selectedUnit?.is_active
          }
        >
          Deactivate
        </button>

        <button
          type="button"
          className="btn btn-outline-success"
          onClick={handleActivate}
          disabled={
            !selectedId ||
            editing ||
            selectedUnit?.is_active
          }
        >
          Activate
        </button>
      </div>

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
                <label className="form-label">
                  Code *
                </label>

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
                <label className="form-label">
                  Name *
                </label>

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
                <label className="form-label">
                  Unit Type *
                </label>

                <select
                  className="form-select"
                  name="unitType"
                  value={form.unitType}
                  onChange={handleChange}
                  disabled={!editing}
                >
                  <option value="VOLUME">
                    Volume
                  </option>

                  <option value="WEIGHT">
                    Weight
                  </option>

                  <option value="COUNT">
                    Count
                  </option>
                </select>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-success"
              onClick={handleSave}
              disabled={!editing || saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Units List
            </h5>

            <div className="form-check">
              <input
                id="showInactive"
                type="checkbox"
                className="form-check-input"
                checked={showInactive}
                onChange={(event) => {
                  setShowInactive(
                    event.target.checked
                  );

                  setSelectedId(null);
                  setForm(emptyForm);
                  setEditing(false);
                  setShowForm(false);
                }}
              />

              <label
                className="form-check-label"
                htmlFor="showInactive"
              >
                Show Inactive
              </label>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {units.map((unit) => (
                  <tr
                    key={unit.id}
                    onClick={() =>
                      handleSelect(unit)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                    className={
                      selectedId === unit.id
                        ? "table-primary"
                        : ""
                    }
                  >
                    <td>{unit.code}</td>
                    <td>{unit.name}</td>
                    <td>{unit.unit_type}</td>

                    <td>
                      {unit.is_active ? (
                        <span className="badge text-bg-success">
                          Active
                        </span>
                      ) : (
                        <span className="badge text-bg-secondary">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {units.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center text-muted"
                    >
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