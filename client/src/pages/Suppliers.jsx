import { useEffect, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";

const emptyForm = {
  code: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  paymentTermsDays: "0",
  notes: "",
};

function Suppliers() {
  const { confirm: confirmAction } = useUi();
  const [suppliers, setSuppliers] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [selectedId, setSelectedId] =
    useState(null);

  const [editing, setEditing] =
    useState(false);

  const [showForm, setShowForm] =
    useState(false);

  const [showInactive, setShowInactive] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSuppliers();
  }, [showInactive]);

  const loadSuppliers = async () => {
    try {
      setError("");

      const response = await api.get(
        "/suppliers",
        {
          params: {
            includeInactive:
              showInactive,
          },
        }
      );

      setSuppliers(
        response.data.suppliers
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load suppliers."
      );
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

  const handleSelect = (supplier) => {
    setSelectedId(supplier.id);

    setForm({
      code: supplier.code || "",
      name: supplier.name || "",

      contactPerson:
        supplier.contact_person || "",

      phone: supplier.phone || "",
      email: supplier.email || "",
      gstin: supplier.gstin || "",

      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      pincode: supplier.pincode || "",

      paymentTermsDays:
        String(
          supplier.payment_terms_days ??
            0
        ),

      notes: supplier.notes || "",
    });

    setEditing(false);
    setShowForm(true);

    setMessage("");
    setError("");
  };

  const handleEdit = () => {
    if (!selectedId) {
      setError(
        "Please select a supplier first."
      );
      return;
    }

    const selectedSupplier =
      suppliers.find(
        (supplier) =>
          supplier.id === selectedId
      );

    if (!selectedSupplier?.is_active) {
      setError(
        "Inactive supplier cannot be edited. Activate it first."
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
    const { name, value } =
      event.target;

    let newValue = value;

    if (
      name === "code" ||
      name === "gstin"
    ) {
      newValue =
        value.toUpperCase();
    }

    setForm((current) => ({
      ...current,
      [name]: newValue,
    }));
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    if (!form.code.trim()) {
      setError(
        "Supplier code is required."
      );
      return;
    }

    if (!form.name.trim()) {
      setError(
        "Supplier name is required."
      );
      return;
    }

    if (
      Number(
        form.paymentTermsDays
      ) < 0
    ) {
      setError(
        "Payment terms cannot be negative."
      );
      return;
    }

    try {
      setSaving(true);

      if (selectedId) {
        await api.put(
          `/suppliers/${selectedId}`,
          form
        );

        setMessage(
          "Supplier updated successfully."
        );
      } else {
        await api.post(
          "/suppliers",
          form
        );

        setMessage(
          "Supplier created successfully."
        );
      }

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadSuppliers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save supplier."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate =
    async () => {
      if (!selectedId) {
        setError(
          "Please select a supplier first."
        );
        return;
      }

      const supplier =
        suppliers.find(
          (item) =>
            item.id === selectedId
        );

      if (!supplier?.is_active) {
        setError(
          "This supplier is already inactive."
        );
        return;
      }

      const confirmed = await confirmAction({
        title: "Deactivate supplier?",
        message: `${supplier.code} - ${supplier.name} will no longer be available for new purchases.`,
        detail: "Historical purchases, payments and ledger entries remain unchanged.",
        confirmLabel: "Deactivate Supplier",
        cancelLabel: "Keep Active",
        variant: "warning",
      });

      if (!confirmed) {
        return;
      }

      try {
        setMessage("");
        setError("");

        await api.patch(
          `/suppliers/${selectedId}/deactivate`
        );

        setMessage(
          "Supplier deactivated successfully."
        );

        handleCancel();
        await loadSuppliers();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to deactivate supplier."
        );
      }
    };

  const handleActivate =
    async () => {
      if (!selectedId) {
        setError(
          "Please select a supplier first."
        );
        return;
      }

      const supplier =
        suppliers.find(
          (item) =>
            item.id === selectedId
        );

      if (!supplier) {
        return;
      }

      const confirmed = await confirmAction({
        title: "Activate supplier?",
        message: `${supplier.code} - ${supplier.name} will become available for new purchases.`,
        confirmLabel: "Activate Supplier",
        cancelLabel: "Keep Inactive",
        variant: "primary",
      });

      if (!confirmed) {
        return;
      }

      try {
        setMessage("");
        setError("");

        await api.patch(
          `/suppliers/${selectedId}/activate`
        );

        setMessage(
          "Supplier activated successfully."
        );

        handleCancel();
        await loadSuppliers();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to activate supplier."
        );
      }
    };

  const selectedSupplier =
    suppliers.find(
      (supplier) =>
        supplier.id === selectedId
    );

  const filteredSuppliers = suppliers.filter((supplier) => {
  const text = search.toLowerCase();

  return (
    supplier.code.toLowerCase().includes(text) ||
    supplier.name.toLowerCase().includes(text) ||
    (supplier.contact_person || "").toLowerCase().includes(text) ||
    (supplier.phone || "").toLowerCase().includes(text) ||
    (supplier.gstin || "").toLowerCase().includes(text) ||
    (supplier.city || "").toLowerCase().includes(text)
  );
});

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Suppliers</h2>

        <p className="text-muted mb-0">
          Maintain suppliers used for raw material and packaging purchases.
        </p>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="d-flex gap-2 flex-wrap mb-3">
        <button
          className="btn btn-primary"
          onClick={handleNew}
          disabled={editing}
        >
          New
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleEdit}
          disabled={!selectedId || editing || !selectedSupplier?.is_active}
        >
          Edit
        </button>

        <button
          className="btn btn-outline-secondary"
          onClick={handleCancel}
          disabled={!showForm}
        >
          Cancel
        </button>

        <button
          className="btn btn-outline-danger"
          onClick={handleDeactivate}
          disabled={!selectedId || editing || !selectedSupplier?.is_active}
        >
          Deactivate
        </button>

        <button
          className="btn btn-outline-success"
          onClick={handleActivate}
          disabled={!selectedId || editing || selectedSupplier?.is_active}
        >
          Activate
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search suppliers..."
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
                  ? "Edit Supplier"
                  : "Supplier Details"
                : "New Supplier"}
            </h5>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label">Supplier Code *</label>

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
                <label className="form-label">Supplier Name *</label>

                <input
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Contact Person</label>

                <input
                  className="form-control"
                  name="contactPerson"
                  value={form.contactPerson}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Phone</label>

                <input
                  className="form-control"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Email</label>

                <input
                  type="email"
                  className="form-control"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">GSTIN</label>

                <input
                  className="form-control"
                  name="gstin"
                  value={form.gstin}
                  onChange={handleChange}
                  disabled={!editing}
                  maxLength={15}
                />
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">Address</label>

                <textarea
                  className="form-control"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  disabled={!editing}
                  rows="2"
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">City</label>

                <input
                  className="form-control"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">State</label>

                <input
                  className="form-control"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">PIN Code</label>

                <input
                  className="form-control"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Payment Terms (Days)</label>

                <input
                  type="number"
                  min="0"
                  className="form-control"
                  name="paymentTermsDays"
                  value={form.paymentTermsDays}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-8 mb-3">
                <label className="form-label">Notes</label>

                <input
                  className="form-control"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>
            </div>

            <button
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
            <h5 className="mb-0">Supplier List</h5>

            <div className="form-check">
              <input
                id="showInactiveSuppliers"
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
                htmlFor="showInactiveSuppliers"
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
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>GSTIN</th>
                  <th>Terms</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    onClick={() => handleSelect(supplier)}
                    style={{
                      cursor: "pointer",
                    }}
                    className={
                      selectedId === supplier.id ? "table-primary" : ""
                    }
                  >
                    <td>{supplier.code}</td>

                    <td>{supplier.name}</td>

                    <td>{supplier.contact_person || "-"}</td>

                    <td>{supplier.phone || "-"}</td>

                    <td>{supplier.gstin || "-"}</td>

                    <td>{supplier.payment_terms_days} days</td>

                    <td>
                      {supplier.is_active ? (
                        <span className="badge text-bg-success">Active</span>
                      ) : (
                        <span className="badge text-bg-secondary">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      No suppliers found.
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

export default Suppliers;