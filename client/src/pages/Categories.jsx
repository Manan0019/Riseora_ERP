import { useEffect, useState } from "react";
import api from "../api/api";

const emptyForm = {
  code: "",
  name: "",
};

function Categories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCategories();
  }, [showInactive]);

  const loadCategories = async () => {
    try {
      setError("");

      const response = await api.get("/categories", {
        params: {
          includeInactive: showInactive,
        },
      });

      setCategories(response.data.categories);
    } catch (err) {
      console.error(err);
      setError("Unable to load categories.");
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

  const handleSelect = (category) => {
    setSelectedId(category.id);

    setForm({
      code: category.code,
      name: category.name,
    });

    setEditing(false);
    setShowForm(true);

    setMessage("");
    setError("");
  };

  const handleEdit = () => {
    if (!selectedId) {
      setError("Please select a category first.");
      return;
    }

    const selectedCategory = categories.find(
      (category) => category.id === selectedId
    );

    if (!selectedCategory?.is_active) {
      setError(
        "Inactive category cannot be edited. Activate it first."
      );
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
      setError("Category code is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Category name is required.");
      return;
    }

    try {
      setSaving(true);

      if (selectedId) {
        await api.put(
          `/categories/${selectedId}`,
          form
        );

        setMessage(
          "Category updated successfully."
        );
      } else {
        await api.post("/categories", form);

        setMessage(
          "Category created successfully."
        );
      }

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadCategories();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save category."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedId) {
      setError("Please select a category first.");
      return;
    }

    const selectedCategory = categories.find(
      (category) => category.id === selectedId
    );

    if (!selectedCategory) {
      setError(
        "Selected category could not be found."
      );
      return;
    }

    if (!selectedCategory.is_active) {
      setError(
        "This category is already inactive."
      );
      return;
    }

    const confirmed = window.confirm(
      `Deactivate "${selectedCategory.code} - ${selectedCategory.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await api.patch(
        `/categories/${selectedId}/deactivate`
      );

      setMessage(
        "Category deactivated successfully."
      );

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadCategories();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to deactivate category."
      );
    }
  };

  const handleActivate = async () => {
    if (!selectedId) {
      setError("Please select a category first.");
      return;
    }

    const selectedCategory = categories.find(
      (category) => category.id === selectedId
    );

    if (!selectedCategory) {
      setError(
        "Selected category could not be found."
      );
      return;
    }

    if (selectedCategory.is_active) {
      setError(
        "This category is already active."
      );
      return;
    }

    const confirmed = window.confirm(
      `Activate "${selectedCategory.code} - ${selectedCategory.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await api.patch(
        `/categories/${selectedId}/activate`
      );

      setMessage(
        "Category activated successfully."
      );

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadCategories();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to activate category."
      );
    }
  };

  const selectedCategory = categories.find(
    (category) => category.id === selectedId
  );

  const filteredCategories = categories.filter((category) => {
  const text = search.toLowerCase();

  return (
    category.code.toLowerCase().includes(text) ||
    category.name.toLowerCase().includes(text)
  );
});

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Item Categories</h2>

        <p className="text-muted mb-0">
          Maintain the categories used to classify raw materials, packaging and
          finished goods.
        </p>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {error && <div className="alert alert-danger">{error}</div>}

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
          disabled={!selectedId || editing || !selectedCategory?.is_active}
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
          disabled={!selectedId || editing || !selectedCategory?.is_active}
        >
          Deactivate
        </button>

        <button
          type="button"
          className="btn btn-outline-success"
          onClick={handleActivate}
          disabled={!selectedId || editing || selectedCategory?.is_active}
        >
          Activate
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="mb-3">
              {selectedId
                ? editing
                  ? "Edit Category"
                  : "Category Details"
                : "New Category"}
            </h5>

            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Code *</label>

                <input
                  type="text"
                  className="form-control"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  maxLength={20}
                  disabled={!editing}
                  autoFocus={editing}
                />
              </div>

              <div className="col-md-8 mb-3">
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
            <h5 className="mb-0">Category List</h5>

            <div className="form-check">
              <input
                id="showInactiveCategories"
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

              <label
                className="form-check-label"
                htmlFor="showInactiveCategories"
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
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredCategories.map((category) => (
                  <tr
                    key={category.id}
                    onClick={() => handleSelect(category)}
                    style={{
                      cursor: "pointer",
                    }}
                    className={
                      selectedId === category.id ? "table-primary" : ""
                    }
                  >
                    <td>{category.code}</td>
                    <td>{category.name}</td>

                    <td>
                      {category.is_active ? (
                        <span className="badge text-bg-success">Active</span>
                      ) : (
                        <span className="badge text-bg-secondary">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">
                      No categories found.
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

export default Categories;