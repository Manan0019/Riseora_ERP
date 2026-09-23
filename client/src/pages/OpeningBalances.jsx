import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function OpeningBalances() {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState("CUSTOMER");
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    openingDate: today,
    balanceType: "DEBIT",
    amount: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSetup({ keepSelection = true } = {}) {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/opening-balances");
      const nextCustomers = response.data.customers || [];
      const nextSuppliers = response.data.suppliers || [];
      setCustomers(nextCustomers);
      setSuppliers(nextSuppliers);

      if (keepSelection && selected) {
        const source = mode === "CUSTOMER" ? nextCustomers : nextSuppliers;
        const refreshed = source.find((entry) => entry.id === selected.id);
        if (refreshed) selectParty(refreshed, mode);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load opening balances.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSetup({ keepSelection: false });
  }, []);

  const rows = mode === "CUSTOMER" ? customers : suppliers;

  const filteredRows = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) =>
      (row.code || "").toLowerCase().includes(text) ||
      (row.name || "").toLowerCase().includes(text),
    );
  }, [rows, search]);

  function selectParty(row, partyMode = mode) {
    setSelected(row);
    const opening = row.opening_balance;
    setForm({
      openingDate: opening?.opening_date || today,
      balanceType:
        opening?.balance_type || (partyMode === "CUSTOMER" ? "DEBIT" : "CREDIT"),
      amount: opening ? String(Number(opening.amount || 0)) : "",
      notes: opening?.notes || "",
    });
    setMessage("");
    setError("");
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setSearch("");
    setSelected(null);
    setMessage("");
    setError("");
    setForm({
      openingDate: today,
      balanceType: nextMode === "CUSTOMER" ? "DEBIT" : "CREDIT",
      amount: "",
      notes: "",
    });
  }

  async function saveOpeningBalance() {
    if (!selected) return;
    const amount = Number(form.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Opening balance must be a valid non-negative amount.");
      return;
    }
    if (!form.openingDate) {
      setError("Opening date is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const path = mode === "CUSTOMER"
        ? `/opening-balances/customers/${selected.id}`
        : `/opening-balances/suppliers/${selected.id}`;
      const response = await api.put(path, {
        openingDate: form.openingDate,
        balanceType: form.balanceType,
        amount,
        notes: form.notes.trim(),
      });
      setMessage(response.data.message || "Opening balance saved successfully.");
      await loadSetup({ keepSelection: true });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to save opening balance.");
    } finally {
      setSaving(false);
    }
  }

  function signedLabel(opening) {
    if (!opening || Number(opening.remaining_amount || 0) <= 0) return "Settled / Nil";
    if (mode === "CUSTOMER") {
      return opening.remaining_type === "RECEIVABLE" ? "Customer owes Riseora" : "Customer advance / credit";
    }
    return opening.remaining_type === "PAYABLE" ? "Riseora owes supplier" : "Supplier advance / debit";
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Opening Party Balances</h2>
          <p className="text-muted mb-0">
            Bring pre-ERP customer receivables/advances and supplier payables/advances into Riseora.
          </p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={() => loadSetup()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="alert alert-warning">
        <strong>Opening balance is only for amounts that existed before Riseora ERP went live.</strong>{" "}
        Use Opening Stock for inventory. Use normal invoices, purchases, payments and refunds for transactions created after go-live.
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="btn-group mb-3" role="group">
        <button type="button" className={`btn ${mode === "CUSTOMER" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => changeMode("CUSTOMER")}>Customers</button>
        <button type="button" className={`btn ${mode === "SUPPLIER" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => changeMode("SUPPLIER")}>Suppliers</button>
      </div>

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="card">
            <div className="card-body">
              <input
                className="form-control mb-3"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${mode === "CUSTOMER" ? "customer" : "supplier"} code or name...`}
              />

              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Original Opening</th>
                      <th>Settled</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center text-muted">Loading...</td></tr>
                    ) : filteredRows.map((row) => {
                      const opening = row.opening_balance;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => selectParty(row)}
                          style={{ cursor: "pointer" }}
                          className={selected?.id === row.id ? "table-primary" : ""}
                        >
                          <td>{row.code}</td>
                          <td>{row.name}</td>
                          <td>{Number(row.is_active) === 1 ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                          <td>{opening ? currency(opening.signed_opening) : currency(0)}</td>
                          <td>{opening ? currency(opening.settled_amount) : currency(0)}</td>
                          <td>
                            {opening ? (
                              <>
                                <strong>{currency(opening.remaining_signed)}</strong>
                                <div className="small text-muted">{opening.remaining_type}</div>
                              </>
                            ) : currency(0)}
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && filteredRows.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted">No records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-5">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-1">{selected ? `${selected.code} - ${selected.name}` : "Select a party"}</h5>
              <p className="text-muted small mb-4">
                {mode === "CUSTOMER"
                  ? "DEBIT = customer owes Riseora. CREDIT = customer advance/credit held by Riseora."
                  : "CREDIT = Riseora owes supplier. DEBIT = supplier advance/debit in Riseora's favour."}
              </p>

              {!selected ? (
                <div className="text-muted">Choose a row to enter or review its opening balance.</div>
              ) : (
                <>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Opening Date</label>
                      <input type="date" className="form-control" value={form.openingDate} onChange={(e) => setForm((c) => ({ ...c, openingDate: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Balance Type</label>
                      <select className="form-select" value={form.balanceType} onChange={(e) => setForm((c) => ({ ...c, balanceType: e.target.value }))}>
                        {mode === "CUSTOMER" ? (
                          <>
                            <option value="DEBIT">Debit - Customer owes us</option>
                            <option value="CREDIT">Credit - Customer advance</option>
                          </>
                        ) : (
                          <>
                            <option value="CREDIT">Credit - We owe supplier</option>
                            <option value="DEBIT">Debit - Supplier advance</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Opening Amount</label>
                      <input type="number" min="0" step="0.01" className="form-control" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Notes</label>
                      <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
                    </div>
                  </div>

                  {selected.opening_balance && (
                    <div className="border rounded p-3 mt-3">
                      <div className="small text-muted">Current Remaining</div>
                      <div className="fw-bold fs-5">{currency(selected.opening_balance.remaining_signed)}</div>
                      <div className="small">{signedLabel(selected.opening_balance)}</div>
                      {selected.opening_balance.settlements?.length > 0 && (
                        <div className="small text-muted mt-2">
                          {selected.opening_balance.settlements.length} opening settlement(s) already recorded. Type/date restrictions protect that history.
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" className="btn btn-primary mt-3" onClick={saveOpeningBalance} disabled={saving}>
                    {saving ? "Saving..." : "Save Opening Balance"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpeningBalances;
