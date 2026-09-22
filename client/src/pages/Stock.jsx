import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

function Stock() {
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedItem, setSelectedItem] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/stock");

      setStock(response.data.stock);
    } catch (err) {
      console.error(err);
      setError("Unable to load current stock.");
    } finally {
      setLoading(false);
    }
  };

  const filteredStock = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) {
      return stock;
    }

    return stock.filter((item) => {
      return (
        item.code.toLowerCase().includes(text) ||
        item.name.toLowerCase().includes(text) ||
        (item.category_name || "").toLowerCase().includes(text) ||
        (item.unit_code || "").toLowerCase().includes(text)
      );
    });
  }, [stock, search]);

  const costingMismatchCount =
  useMemo(() => {
    return stock.filter(
      (item) =>
        item.costing_status ===
        "MISMATCH"
    ).length;
  }, [stock]);

  const loadLedger = async (item) => {
    try {
      setSelectedItem(item);
      setLedgerLoading(true);
      setError("");

      const response = await api.get(`/stock/item/${item.id}/ledger`);

      setLedger(response.data.ledger);
    } catch (err) {
      console.error(err);
      setError("Unable to load stock ledger.");
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Current Stock</h2>

          <p className="text-muted mb-0">
            Current inventory calculated from stock transactions.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={loadStock}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {costingMismatchCount > 0 && (
        <div className="alert alert-warning">
          <strong>Inventory costing requires attention.</strong>{" "}
          {costingMismatchCount} item
          {costingMismatchCount === 1 ? "" : "s"} have a difference between
          physical stock and costing quantity.
        </div>
      )}

      {/* CURRENT STOCK */}
      <div className="card">
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search by code, item, category or unit..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Costing Qty</th>
                  <th>Unit</th>
                  <th>Average Cost</th>
                  <th>Inventory Value</th>
                  <th>Costing</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted">
                      Loading stock...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredStock.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => loadLedger(item)}
                        style={{ cursor: "pointer" }}
                        className={
                          selectedItem?.id === item.id
                            ? "table-primary"
                            : item.costing_status === "MISMATCH"
                              ? "table-warning"
                              : ""
                        }
                      >
                        <td>{item.code}</td>

                        <td>{item.name}</td>

                        <td>{item.category_name}</td>

                        <td>{Number(item.current_stock || 0).toFixed(3)}</td>

                        <td>{Number(item.costing_quantity || 0).toFixed(3)}</td>

                        <td>{item.unit_code}</td>

                        <td>₹{Number(item.average_cost || 0).toFixed(2)}</td>

                        <td>₹{Number(item.inventory_value || 0).toFixed(2)}</td>

                        <td>
                          {item.costing_status === "OK" ? (
                            <span className="badge text-bg-success">OK</span>
                          ) : (
                            <span className="badge text-bg-warning">
                              Mismatch
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredStock.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center text-muted">
                          No stock records found.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* STOCK LEDGER - MUST BE OUTSIDE CURRENT STOCK TABLE */}
      {selectedItem && (
        <div className="card mt-4">
          <div className="card-body">
            <div className="mb-3">
              <h5 className="mb-1">Stock Ledger</h5>

              <div className="text-muted">
                {selectedItem.code} - {selectedItem.name}
              </div>
            </div>

            {ledgerLoading ? (
              <p>Loading ledger...</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Lot</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Unit Cost</th>
                      <th>Balance</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(() => {
                      let runningBalance = 0;

                      return ledger.map((entry) => {
                        runningBalance +=
                          Number(entry.quantity_in || 0) -
                          Number(entry.quantity_out || 0);

                        return (
                          <tr key={entry.id}>
                            <td>{entry.transaction_date}</td>

                            <td>{entry.transaction_type}</td>

                            <td>{entry.reference_no || "-"}</td>

                            <td>{entry.lot_no || "-"}</td>

                            <td>{Number(entry.quantity_in || 0).toFixed(3)}</td>

                            <td>
                              {Number(entry.quantity_out || 0).toFixed(3)}
                            </td>

                            <td>₹{Number(entry.unit_cost || 0).toFixed(2)}</td>

                            <td>{runningBalance.toFixed(3)}</td>
                          </tr>
                        );
                      });
                    })()}

                    {ledger.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-muted">
                          No stock movements found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Stock;
