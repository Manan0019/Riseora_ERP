import { useEffect, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";

const emptyForm = {
  code: "",
  name: "",
  categoryId: "",
  baseUnitId: "",
  reorderLevel: "0",
  trackLot: false,
  trackExpiry: false,
  density: "",
  defaultSellingPrice: "0",
  targetMarginPercent: "0",
  hsnCode: "",
  defaultGstRate: "0",
  notes: "",
};

function Items() {
  const { confirm: confirmAction } = useUi();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  const [form, setForm] = useState(emptyForm);

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [search, setSearch] = useState("");

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadItems();
  }, [showInactive]);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadItems = async () => {
    try {
      setError("");

      const response = await api.get("/items", {
        params: {
          includeInactive: showInactive,
        },
      });

      setItems(response.data.items);
    } catch (err) {
      console.error(err);
      setError("Unable to load items.");
    }
  };

  const loadLookups = async () => {
    try {
      const [categoryResponse, unitResponse] =
        await Promise.all([
          api.get("/categories"),
          api.get("/units"),
        ]);

      setCategories(categoryResponse.data.categories);
      setUnits(unitResponse.data.units);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to load categories or units."
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

  const handleSelect = (item) => {
    setSelectedId(item.id);

    setForm({
      code: item.code || "",
      name: item.name || "",

      categoryId:
        String(item.category_id || ""),

      baseUnitId:
        String(item.base_unit_id || ""),

      reorderLevel:
        String(item.reorder_level ?? 0),

      trackLot:
        Boolean(item.track_lot),

      trackExpiry:
        Boolean(item.track_expiry),

      density:
        item.density !== null &&
        item.density !== undefined
          ? String(item.density)
          : "",

      defaultSellingPrice:
        String(item.default_selling_price ?? 0),

      targetMarginPercent:
        String(item.target_margin_percent ?? 0),

      hsnCode: item.hsn_code || "",

      defaultGstRate:
        String(item.default_gst_rate ?? 0),

      notes: item.notes || "",
    });

    setEditing(false);
    setShowForm(true);

    setMessage("");
    setError("");
  };

  const handleEdit = () => {
    if (!selectedId) {
      setError("Please select an item first.");
      return;
    }

    const selectedItem = items.find(
      (item) => item.id === selectedId
    );

    if (!selectedItem?.is_active) {
      setError(
        "Inactive item cannot be edited. Activate it first."
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
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((current) => ({
      ...current,

      [name]:
        type === "checkbox"
          ? checked
          : name === "code"
            ? value.toUpperCase()
            : value,
    }));
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    if (!form.code.trim()) {
      setError("Item code is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Item name is required.");
      return;
    }

    if (!form.categoryId) {
      setError("Category is required.");
      return;
    }

    if (!form.baseUnitId) {
      setError("Base unit is required.");
      return;
    }

    if (Number(form.reorderLevel) < 0) {
      setError(
        "Reorder level cannot be negative."
      );
      return;
    }

    if (
      form.density &&
      Number(form.density) <= 0
    ) {
      setError(
        "Density must be greater than zero."
      );
      return;
    }

    if (
      !Number.isFinite(
        Number(form.defaultSellingPrice || 0)
      ) ||
      Number(form.defaultSellingPrice || 0) < 0
    ) {
      setError(
        "Default selling price cannot be negative."
      );
      return;
    }

    if (
      !Number.isFinite(
        Number(form.targetMarginPercent || 0)
      ) ||
      Number(form.targetMarginPercent || 0) < 0 ||
      Number(form.targetMarginPercent || 0) >= 100
    ) {
      setError(
        "Target margin must be between 0 and less than 100 percent."
      );
      return;
    }

    if (
      !Number.isFinite(
        Number(form.defaultGstRate || 0)
      ) ||
      Number(form.defaultGstRate || 0) < 0 ||
      Number(form.defaultGstRate || 0) > 100
    ) {
      setError(
        "Default GST rate must be between 0 and 100 percent."
      );
      return;
    }

    try {
      setSaving(true);

      if (selectedId) {
        await api.put(
          `/items/${selectedId}`,
          form
        );

        setMessage(
          "Item updated successfully."
        );
      } else {
        await api.post("/items", form);

        setMessage(
          "Item created successfully."
        );
      }

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadItems();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save item."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedId) {
      setError("Please select an item first.");
      return;
    }

    const selectedItem = items.find(
      (item) => item.id === selectedId
    );

    if (!selectedItem) {
      setError(
        "Selected item could not be found."
      );
      return;
    }

    if (!selectedItem.is_active) {
      setError(
        "This item is already inactive."
      );
      return;
    }

    const confirmed = await confirmAction({
      title: "Deactivate item?",
      message: `${selectedItem.code} - ${selectedItem.name} will be hidden from new transactions.`,
      detail: "Current stock and historical transactions are preserved. The server will block unsafe deactivation when dependencies require it.",
      confirmLabel: "Deactivate Item",
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
        `/items/${selectedId}/deactivate`
      );

      setMessage(
        "Item deactivated successfully."
      );

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadItems();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to deactivate item."
      );
    }
  };

  const handleActivate = async () => {
    if (!selectedId) {
      setError("Please select an item first.");
      return;
    }

    const selectedItem = items.find(
      (item) => item.id === selectedId
    );

    if (!selectedItem) {
      setError(
        "Selected item could not be found."
      );
      return;
    }

    if (selectedItem.is_active) {
      setError(
        "This item is already active."
      );
      return;
    }

    const confirmed = await confirmAction({
      title: "Activate item?",
      message: `${selectedItem.code} - ${selectedItem.name} will become available for new transactions.`,
      confirmLabel: "Activate Item",
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
        `/items/${selectedId}/activate`
      );

      setMessage(
        "Item activated successfully."
      );

      setSelectedId(null);
      setForm(emptyForm);
      setEditing(false);
      setShowForm(false);

      await loadItems();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to activate item."
      );
    }
  };

  const selectedItem = items.find(
    (item) => item.id === selectedId
  );

  const filteredItems = items.filter(
    (item) => {
      const text =
        search.toLowerCase();

      return (
        item.code
          .toLowerCase()
          .includes(text) ||
        item.name
          .toLowerCase()
          .includes(text) ||
        (item.category_name || "")
          .toLowerCase()
          .includes(text) ||
        (item.unit_code || "")
          .toLowerCase()
          .includes(text)
      );
    }
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Item Master
        </h2>

        <p className="text-muted mb-0">
          Maintain raw materials,
          packaging materials,
          finished goods and
          consumables.
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
            !selectedItem?.is_active
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
            !selectedItem?.is_active
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
            selectedItem?.is_active
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
                  ? "Edit Item"
                  : "Item Details"
                : "New Item"}
            </h5>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label">
                  Item Code *
                </label>

                <input
                  type="text"
                  className="form-control"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  disabled={!editing}
                  maxLength={30}
                  autoFocus={editing}
                />
              </div>

              <div className="col-md-5 mb-3">
                <label className="form-label">
                  Item Name *
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
                  Category *
                </label>

                <select
                  className="form-select"
                  name="categoryId"
                  value={form.categoryId}
                  onChange={handleChange}
                  disabled={!editing}
                >
                  <option value="">
                    Select Category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.code} -{" "}
                        {category.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Base Unit *
                </label>

                <select
                  className="form-select"
                  name="baseUnitId"
                  value={form.baseUnitId}
                  onChange={handleChange}
                  disabled={!editing}
                >
                  <option value="">
                    Select Unit
                  </option>

                  {units.map((unit) => (
                    <option
                      key={unit.id}
                      value={unit.id}
                    >
                      {unit.code} -{" "}
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Reorder Level
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  className="form-control"
                  name="reorderLevel"
                  value={
                    form.reorderLevel
                  }
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Density
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  className="form-control"
                  name="density"
                  value={form.density}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Optional"
                />

                <div className="form-text">
                  Used only when
                  weight/volume conversion
                  is required.
                </div>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Default Selling Price
                </label>

                <div className="input-group">
                  <span className="input-group-text">₹</span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    name="defaultSellingPrice"
                    value={form.defaultSellingPrice}
                    onChange={handleChange}
                    disabled={!editing}
                  />
                </div>

                <div className="form-text">
                  Used as the default rate on sales invoices. Production costing never changes this automatically.
                </div>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Target Gross Margin %
                </label>

                <input
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  className="form-control"
                  name="targetMarginPercent"
                  value={form.targetMarginPercent}
                  onChange={handleChange}
                  disabled={!editing}
                />

                <div className="form-text">
                  For finished goods, the ERP compares actual production cost with this target and suggests a selling price.
                </div>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  HSN Code
                </label>

                <input
                  type="text"
                  className="form-control text-uppercase"
                  name="hsnCode"
                  value={form.hsnCode}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="e.g. 3305"
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">
                  Default GST %
                </label>

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="form-control"
                  name="defaultGstRate"
                  value={form.defaultGstRate}
                  onChange={handleChange}
                  disabled={!editing}
                />

                <div className="form-text">
                  Used as the default GST rate on new sales invoice lines.
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="form-check mt-4">
                  <input
                    id="trackLot"
                    type="checkbox"
                    className="form-check-input"
                    name="trackLot"
                    checked={form.trackLot}
                    onChange={handleChange}
                    disabled={!editing}
                  />

                  <label
                    className="form-check-label"
                    htmlFor="trackLot"
                  >
                    Track Batch / Lot
                  </label>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="form-check mt-4">
                  <input
                    id="trackExpiry"
                    type="checkbox"
                    className="form-check-input"
                    name="trackExpiry"
                    checked={
                      form.trackExpiry
                    }
                    onChange={handleChange}
                    disabled={!editing}
                  />

                  <label
                    className="form-check-label"
                    htmlFor="trackExpiry"
                  >
                    Track Expiry
                  </label>
                </div>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label">
                  Notes
                </label>

                <input
                  type="text"
                  className="form-control"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  disabled={!editing}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-success"
              onClick={handleSave}
              disabled={
                !editing || saving
              }
            >
              {saving
                ? "Saving..."
                : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Item List
            </h5>

            <div className="form-check">
              <input
                id="showInactiveItems"
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
                htmlFor="showInactiveItems"
              >
                Show Inactive
              </label>
            </div>
          </div>

          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search items..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>HSN</th>
                  <th>GST %</th>
                  <th>Reorder</th>
                  <th>Sale Price</th>
                  <th>Target Margin</th>
                  <th>Lot</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map(
                  (item) => (
                    <tr
                      key={item.id}
                      onClick={() =>
                        handleSelect(item)
                      }
                      style={{
                        cursor:
                          "pointer",
                      }}
                      className={
                        selectedId ===
                        item.id
                          ? "table-primary"
                          : ""
                      }
                    >
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
                        {item.hsn_code || "-"}
                      </td>

                      <td>
                        {Number(
                          item.default_gst_rate || 0
                        ).toFixed(2)}%
                      </td>

                      <td>
                        {
                          item.reorder_level
                        }
                      </td>

                      <td>
                        ₹{Number(
                          item.default_selling_price ||
                            0
                        ).toFixed(2)}
                      </td>

                      <td>
                        {Number(
                          item.target_margin_percent ||
                            0
                        ).toFixed(2)}%
                      </td>

                      <td>
                        {item.track_lot
                          ? "Yes"
                          : "No"}
                      </td>

                      <td>
                        {item.track_expiry
                          ? "Yes"
                          : "No"}
                      </td>

                      <td>
                        {item.is_active ? (
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
                  )
                )}

                {filteredItems.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={12}
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