import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

function Stock() {
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        (item.category_name || "")
          .toLowerCase()
          .includes(text) ||
        (item.unit_code || "")
          .toLowerCase()
          .includes(text)
      );
    });
  }, [stock, search]);

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

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search by code, item, category or unit..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
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
                  <th>Unit</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center text-muted"
                    >
                      Loading stock...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredStock.map((item) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.category_name}</td>

                        <td>
                          {Number(
                            item.current_stock || 0
                          ).toFixed(3)}
                        </td>

                        <td>{item.unit_code}</td>
                      </tr>
                    ))}

                    {filteredStock.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center text-muted"
                        >
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
    </div>
  );
}

export default Stock;