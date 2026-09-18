import {
  useEffect,
  useState,
} from "react";

import api from "../api/api";

function Items() {
  const [items, setItems] =
    useState([]);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems =
    async () => {
      try {
        const response =
          await api.get("/items");

        setItems(
          response.data.items
        );
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load items."
        );
      }
    };

  return (
    <div>
      <h2>Item Master</h2>

      <p className="text-muted">
        Maintain raw materials,
        packaging materials,
        finished goods and
        consumables.
      </p>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {items.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        {item.code}
                      </td>

                      <td>
                        {item.name}
                      </td>

                      <td>
                        {
                          item.category_name
                        }
                      </td>

                      <td>
                        {
                          item.unit_code
                        }
                      </td>

                      <td>
                        {item.is_active
                          ? "Active"
                          : "Inactive"}
                      </td>
                    </tr>
                  )
                )}

                {items.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center text-muted"
                    >
                      No items found.
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

export default Items;