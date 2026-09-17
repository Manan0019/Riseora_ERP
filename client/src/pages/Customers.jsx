import { useEffect, useState } from "react";
import api from "../api/api";

const emptyForm = {
  code: "",
  name: "",
  phone: "",
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

function Customers() {
  const [customers, setCustomers] =
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
    loadCustomers();
  }, [showInactive]);

  const loadCustomers = async () => {
    try {
      setError("");

      const response = await api.get(
        "/customers",
        {
          params: {
            includeInactive:
              showInactive,
          },
        }
      );

      setCustomers(
        response.data.customers
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load customers."
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

  const handleSelect = (customer) => {
    setSelectedId(customer.id);

    setForm({
      code: customer.code || "",
      name: customer.name || "",

      phone: customer.phone || "",
      email: customer.email || "",
      gstin: customer.gstin || "",

      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      pincode: customer.pincode || "",

      customerType:
        customer.customer_type ||
        "RETAIL",

      creditDays:
        String(
          customer.credit_days ?? 0
        ),

      creditLimit:
        String(
          customer.credit_limit ?? 0
        ),

      notes: customer.notes || "",
    });

    setEditing(false);
    setShowForm(true);

    setMessage("");
    setError("");
  };

  const handleEdit = () => {
    if (!selectedId) {
      setError(
        "Please select a customer first."
      );
      return;
    }

    const selectedCustomer =
      customers.find(
        (customer) =>
          customer.id === selectedId
      );

    if (!selectedCustomer?.is_active) {
      setError(
        "Inactive customer cannot be edited. Activate it first."
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
        "Customer code is required."
      );
      return;
    }

    if (!form.name.trim()) {
      setError(
        "Customer name is required."
      );
      return;
    }

    if (
      Number(form.creditDays) < 0
    ) {
      setError(
        "Credit days cannot be negative."
      );
      return;
    }

    if (
      Number(form.creditLimit) < 0
    ) {
      setError(
        "Credit limit cannot be negative."
      );
      return;
    }

    try {
      setSaving(true);

      if (selectedId) {
        await api.put(
          `/customers/${selectedId}`,
          form
        );

        setMessage(
          "Customer updated successfully."
        );
      } else {
        await api.post(
          "/customers",
          form
        );

        setMessage(
          "Customer created successfully."
        );
      }

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadCustomers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save customer."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate =
    async () => {
      if (!selectedId) {
        setError(
          "Please select a customer first."
        );
        return;
      }

      const customer =
        customers.find(
          (item) =>
            item.id === selectedId
        );

      if (!customer?.is_active) {
        setError(
          "This customer is already inactive."
        );
        return;
      }

      const confirmed =
        window.confirm(
          `Deactivate "${customer.code} - ${customer.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setMessage("");
        setError("");

        await api.patch(
          `/customers/${selectedId}/deactivate`
        );

        setMessage(
          "Customer deactivated successfully."
        );

        setSelectedId(null);
        setForm(emptyForm);
        setEditing(false);
        setShowForm(false);

        await loadCustomers();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to deactivate customer."
        );
      }
    };

  const handleActivate =
    async () => {
      if (!selectedId) {
        setError(
          "Please select a customer first."
        );
        return;
      }

      const customer =
        customers.find(
          (item) =>
            item.id === selectedId
        );

      if (!customer) {
        return;
      }

      const confirmed =
        window.confirm(
          `Activate "${customer.code} - ${customer.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setMessage("");
        setError("");

        await api.patch(
          `/customers/${selectedId}/activate`
        );

        setMessage(
          "Customer activated successfully."
        );

        setSelectedId(null);
        setForm(emptyForm);
        setEditing(false);
        setShowForm(false);

        await loadCustomers();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to activate customer."
        );
      }
    };

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.id === selectedId
    );

  const filteredCustomers = customers.filter((customer) => {
    const text = search.toLowerCase();

    return (
      customer.code.toLowerCase().includes(text) ||
      customer.name.toLowerCase().includes(text) ||
      (customer.phone || "").toLowerCase().includes(text) ||
      (customer.gstin || "").toLowerCase().includes(text) ||
      (customer.city || "").toLowerCase().includes(text) ||
      (customer.customer_type || "").toLowerCase().includes(text)
    );
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Customers</h2>

        <p className="text-muted mb-0">
          Maintain retail, wholesale and distributor customers.
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
          disabled={!selectedId || editing || !selectedCustomer?.is_active}
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
          disabled={!selectedId || editing || !selectedCustomer?.is_active}
        >
          Deactivate
        </button>

        <button
          className="btn btn-outline-success"
          onClick={handleActivate}
          disabled={!selectedId || editing || selectedCustomer?.is_active}
        >
          Activate
        </button>
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search customers..."
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
                  ? "Edit Customer"
                  : "Customer Details"
                : "New Customer"}
            </h5>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label">Customer Code *</label>

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
                <label className="form-label">Customer Name *</label>

                <input
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Customer Type</label>

                <select
                  className="form-select"
                  name="customerType"
                  value={form.customerType}
                  onChange={handleChange}
                  disabled={!editing}
                >
                  <option value="RETAIL">Retail</option>

                  <option value="WHOLESALE">Wholesale</option>

                  <option value="DISTRIBUTOR">Distributor</option>
                </select>
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

              <div className="col-md-3 mb-3">
                <label className="form-label">Credit Days</label>

                <input
                  type="number"
                  min="0"
                  className="form-control"
                  name="creditDays"
                  value={form.creditDays}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label">Credit Limit</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  name="creditLimit"
                  value={form.creditLimit}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-6 mb-3">
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
            <h5 className="mb-0">Customer List</h5>

            <div className="form-check">
              <input
                id="showInactiveCustomers"
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
                htmlFor="showInactiveCustomers"
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
                  <th>Phone</th>
                  <th>Credit Days</th>
                  <th>Credit Limit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => handleSelect(customer)}
                    style={{
                      cursor: "pointer",
                    }}
                    className={
                      selectedId === customer.id ? "table-primary" : ""
                    }
                  >
                    <td>{customer.code}</td>

                    <td>{customer.name}</td>

                    <td>{customer.customer_type}</td>

                    <td>{customer.phone || "-"}</td>

                    <td>{customer.credit_days}</td>

                    <td>₹{Number(customer.credit_limit).toFixed(2)}</td>

                    <td>
                      {customer.is_active ? (
                        <span className="badge text-bg-success">Active</span>
                      ) : (
                        <span className="badge text-bg-secondary">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      No customers found.
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

export default Customers;