import { useEffect, useState } from "react";
import api from "../api/api";

const emptyForm = {
  name: "",
  legalName: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
  gstin: "",
};

function Company() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      setLoading(true);

      const response = await api.get("/company");

      const company = response.data.company;

      if (company) {
        setForm({
          name: company.name || "",
          legalName: company.legal_name || "",
          address: company.address || "",
          city: company.city || "",
          state: company.state || "",
          pincode: company.pincode || "",
          phone: company.phone || "",
          email: company.email || "",
          gstin: company.gstin || "",
        });
      }
    } catch {
      setError("Unable to load company details.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!form.name.trim()) {
      setError("Company name is required.");
      return;
    }

    try {
      setSaving(true);

      await api.put("/company", form);

      setMessage("Company details saved successfully.");
      await loadCompany();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save company details."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>Loading company details...</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Company Settings</h2>
        <p className="text-muted mb-0">
          Maintain the company's basic business information.
        </p>
      </div>

      <div
        className="card"
        style={{ maxWidth: "900px" }}
      >
        <div className="card-body">
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

          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">
                  Company Name *
                </label>

                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label">
                  Legal Name
                </label>

                <input
                  type="text"
                  className="form-control"
                  name="legalName"
                  value={form.legalName}
                  onChange={handleChange}
                />
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">
                  Address
                </label>

                <textarea
                  className="form-control"
                  name="address"
                  rows="3"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  City
                </label>

                <input
                  className="form-control"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  State
                </label>

                <input
                  className="form-control"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  PIN Code
                </label>

                <input
                  className="form-control"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Phone
                </label>

                <input
                  className="form-control"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Email
                </label>

                <input
                  type="email"
                  className="form-control"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  GSTIN
                </label>

                <input
                  className="form-control text-uppercase"
                  name="gstin"
                  value={form.gstin}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      gstin: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>

            <div className="border-top pt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Company"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Company;