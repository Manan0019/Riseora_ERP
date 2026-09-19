import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const emptyIngredient = () => ({
  ingredientItemId: "",
  quantity: "",
  unitId: "",
  percentage: "",
  notes: "",
});

const emptyForm = () => ({
  code: "",
  name: "",
  finishedItemId: "",
  versionNo: "1",
  batchSize: "",
  batchUnitId: "",
  notes: "",
});

function Formulas() {
  const [formulas, setFormulas] = useState([]);
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);

  const [form, setForm] = useState(emptyForm());

  const [ingredients, setIngredients] = useState([
    emptyIngredient(),
  ]);

  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [search, setSearch] = useState("");

  const [scaleBatchSize, setScaleBatchSize] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadFormulas();
  }, [showInactive]);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadFormulas = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/formulas", {
        params: {
          includeInactive: showInactive,
        },
      });

      setFormulas(response.data.formulas || []);
    } catch (err) {
      console.error(err);

      setError("Unable to load formulas.");
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async () => {
    try {
      const [itemResponse, unitResponse] =
        await Promise.all([
          api.get("/items"),
          api.get("/units"),
        ]);

      setItems(itemResponse.data.items || []);
      setUnits(unitResponse.data.units || []);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load items or units."
      );
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "code"
          ? value.toUpperCase()
          : value,
    }));
  };

  const handleIngredientChange = (
    index,
    field,
    value
  ) => {
    setIngredients((current) =>
      current.map((ingredient, ingredientIndex) =>
        ingredientIndex === index
          ? {
              ...ingredient,
              [field]: value,
            }
          : ingredient
      )
    );
  };

  const addIngredient = () => {
    setIngredients((current) => [
      ...current,
      emptyIngredient(),
    ]);
  };

  const removeIngredient = (index) => {
    if (ingredients.length === 1) {
      setIngredients([
        emptyIngredient(),
      ]);

      return;
    }

    setIngredients((current) =>
      current.filter(
        (_, ingredientIndex) =>
          ingredientIndex !== index
      )
    );
  };

  const handleNew = () => {
    setSelectedId(null);
    setEditing(true);
    setShowForm(true);

    setForm(emptyForm());
    setIngredients([
      emptyIngredient(),
    ]);

    setScaleBatchSize("");

    setMessage("");
    setError("");
  };

  const handleCancel = () => {
    setSelectedId(null);
    setEditing(false);
    setShowForm(false);

    setForm(emptyForm());
    setIngredients([
      emptyIngredient(),
    ]);

    setScaleBatchSize("");

    setMessage("");
    setError("");
  };

  const loadFormulaForEdit = async (id) => {
    try {
      setError("");

      const response =
        await api.get(
          `/formulas/${id}`
        );

      const formula =
        response.data.formula;

      setSelectedId(formula.id);
      setEditing(true);
      setShowForm(true);

      setForm({
        code: formula.code || "",
        name: formula.name || "",
        finishedItemId:
          String(
            formula.finished_item_id ||
              ""
          ),
        versionNo:
          String(
            formula.version_no || 1
          ),
        batchSize:
          String(
            formula.batch_size || ""
          ),
        batchUnitId:
          String(
            formula.batch_unit_id ||
              ""
          ),
        notes:
          formula.notes || "",
      });

      setIngredients(
        formula.ingredients?.length
          ? formula.ingredients.map(
              (ingredient) => ({
                ingredientItemId:
                  String(
                    ingredient.ingredient_item_id
                  ),
                quantity:
                  String(
                    ingredient.quantity
                  ),
                unitId:
                  String(
                    ingredient.unit_id
                  ),
                percentage:
                  ingredient.percentage ==
                  null
                    ? ""
                    : String(
                        ingredient.percentage
                      ),
                notes:
                  ingredient.notes || "",
              })
            )
          : [emptyIngredient()]
      );

      setScaleBatchSize(
        String(
          formula.batch_size || ""
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load formula details."
      );
    }
  };

  const validate = () => {
    if (!form.code.trim()) {
      return "Formula code is required.";
    }

    if (!form.name.trim()) {
      return "Formula name is required.";
    }

    if (!form.finishedItemId) {
      return "Finished product is required.";
    }

    if (
      Number(form.versionNo) <= 0
    ) {
      return "Version number must be greater than zero.";
    }

    if (
      Number(form.batchSize) <= 0
    ) {
      return "Batch size must be greater than zero.";
    }

    if (!form.batchUnitId) {
      return "Batch unit is required.";
    }

    for (
      let index = 0;
      index < ingredients.length;
      index++
    ) {
      const ingredient =
        ingredients[index];

      if (
        !ingredient.ingredientItemId
      ) {
        return `Ingredient is required in row ${
          index + 1
        }.`;
      }

      if (
        Number(
          ingredient.quantity
        ) <= 0
      ) {
        return `Quantity must be greater than zero in row ${
          index + 1
        }.`;
      }

      if (!ingredient.unitId) {
        return `Unit is required in row ${
          index + 1
        }.`;
      }

      if (
        ingredient.percentage !== "" &&
        (
          Number(
            ingredient.percentage
          ) < 0 ||
          Number(
            ingredient.percentage
          ) > 100
        )
      ) {
        return `Percentage must be between 0 and 100 in row ${
          index + 1
        }.`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      code:
        form.code.trim(),

      name:
        form.name.trim(),

      finishedItemId:
        Number(
          form.finishedItemId
        ),

      versionNo:
        Number(
          form.versionNo
        ),

      batchSize:
        Number(
          form.batchSize
        ),

      batchUnitId:
        Number(
          form.batchUnitId
        ),

      notes:
        form.notes.trim(),

      ingredients:
        ingredients.map(
          (ingredient) => ({
            ingredientItemId:
              Number(
                ingredient.ingredientItemId
              ),

            quantity:
              Number(
                ingredient.quantity
              ),

            unitId:
              Number(
                ingredient.unitId
              ),

            percentage:
              ingredient.percentage === ""
                ? ""
                : Number(
                    ingredient.percentage
                  ),

            notes:
              ingredient.notes.trim(),
          })
        ),
    };

    try {
      setSaving(true);

      if (selectedId) {
        await api.put(
          `/formulas/${selectedId}`,
          payload
        );

        setMessage(
          "Formula updated successfully."
        );
      } else {
        await api.post(
          "/formulas",
          payload
        );

        setMessage(
          "Formula saved successfully."
        );
      }

      setSelectedId(null);
      setEditing(false);
      setShowForm(false);

      setForm(emptyForm());
      setIngredients([
        emptyIngredient(),
      ]);

      setScaleBatchSize("");

      await loadFormulas();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to save formula."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (
    formula
  ) => {
    const confirmed =
      window.confirm(
        `Deactivate ${formula.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.patch(
        `/formulas/${formula.id}/deactivate`
      );

      setMessage(
        "Formula deactivated successfully."
      );

      await loadFormulas();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to deactivate formula."
      );
    }
  };

  const handleActivate = async (
    formula
  ) => {
    try {
      await api.patch(
        `/formulas/${formula.id}/activate`
      );

      setMessage(
        "Formula activated successfully."
      );

      await loadFormulas();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to activate formula."
      );
    }
  };

  const filteredFormulas =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return formulas;
      }

      return formulas.filter(
        (formula) =>
          formula.code
            .toLowerCase()
            .includes(text) ||
          formula.name
            .toLowerCase()
            .includes(text) ||
          (
            formula.finished_item_name ||
            ""
          )
            .toLowerCase()
            .includes(text)
      );
    }, [formulas, search]);

  const scaleFactor =
    Number(form.batchSize) > 0 &&
    Number(scaleBatchSize) > 0
      ? Number(scaleBatchSize) /
        Number(form.batchSize)
      : 0;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">
            Formula Master
          </h2>

          <p className="text-muted mb-0">
            Create and maintain manufacturing recipes.
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNew}
          >
            New Formula
          </button>
        )}
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

      {showForm && (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <div className="row">
                <div className="col-md-2 mb-3">
                  <label className="form-label">
                    Formula Code *
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    name="code"
                    value={form.code}
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Formula Name *
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={form.name}
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Finished Product *
                  </label>

                  <select
                    className="form-select"
                    name="finishedItemId"
                    value={
                      form.finishedItemId
                    }
                    onChange={
                      handleFormChange
                    }
                  >
                    <option value="">
                      Select Finished Product
                    </option>

                    {items.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.code} -{" "}
                          {item.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="col-md-2 mb-3">
                  <label className="form-label">
                    Version *
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-control"
                    name="versionNo"
                    value={
                      form.versionNo
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Base Batch Size *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="form-control"
                    name="batchSize"
                    value={
                      form.batchSize
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Batch Unit *
                  </label>

                  <select
                    className="form-select"
                    name="batchUnitId"
                    value={
                      form.batchUnitId
                    }
                    onChange={
                      handleFormChange
                    }
                  >
                    <option value="">
                      Select Unit
                    </option>

                    {units.map(
                      (unit) => (
                        <option
                          key={unit.id}
                          value={unit.id}
                        >
                          {unit.code} -{" "}
                          {unit.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Notes
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    name="notes"
                    value={
                      form.notes
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  Ingredients
                </h5>

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={
                    addIngredient
                  }
                >
                  + Add Ingredient
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 250 }}>
                        Ingredient
                      </th>

                      <th style={{ width: 140 }}>
                        Quantity
                      </th>

                      <th style={{ width: 150 }}>
                        Unit
                      </th>

                      <th style={{ width: 130 }}>
                        Percentage
                      </th>

                      <th style={{ minWidth: 180 }}>
                        Notes
                      </th>

                      <th style={{ width: 100 }}>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {ingredients.map(
                      (
                        ingredient,
                        index
                      ) => (
                        <tr key={index}>
                          <td>
                            <select
                              className="form-select"
                              value={
                                ingredient.ingredientItemId
                              }
                              onChange={(
                                event
                              ) =>
                                handleIngredientChange(
                                  index,
                                  "ingredientItemId",
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              <option value="">
                                Select Ingredient
                              </option>

                              {items.map(
                                (item) => (
                                  <option
                                    key={
                                      item.id
                                    }
                                    value={
                                      item.id
                                    }
                                  >
                                    {
                                      item.code
                                    }{" "}
                                    -{" "}
                                    {
                                      item.name
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              className="form-control"
                              value={
                                ingredient.quantity
                              }
                              onChange={(
                                event
                              ) =>
                                handleIngredientChange(
                                  index,
                                  "quantity",
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <select
                              className="form-select"
                              value={
                                ingredient.unitId
                              }
                              onChange={(
                                event
                              ) =>
                                handleIngredientChange(
                                  index,
                                  "unitId",
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              <option value="">
                                Select Unit
                              </option>

                              {units.map(
                                (unit) => (
                                  <option
                                    key={
                                      unit.id
                                    }
                                    value={
                                      unit.id
                                    }
                                  >
                                    {
                                      unit.code
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="form-control"
                              value={
                                ingredient.percentage
                              }
                              onChange={(
                                event
                              ) =>
                                handleIngredientChange(
                                  index,
                                  "percentage",
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={
                                ingredient.notes
                              }
                              onChange={(
                                event
                              ) =>
                                handleIngredientChange(
                                  index,
                                  "notes",
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                removeIngredient(
                                  index
                                )
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <h5>
                Scale Formula Preview
              </h5>

              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">
                    Required Batch Size
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="form-control"
                    value={
                      scaleBatchSize
                    }
                    onChange={(
                      event
                    ) =>
                      setScaleBatchSize(
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>

              {scaleFactor > 0 && (
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Ingredient</th>
                        <th>
                          Base Quantity
                        </th>
                        <th>
                          Required Quantity
                        </th>
                        <th>Unit</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ingredients.map(
                        (
                          ingredient,
                          index
                        ) => {
                          const item =
                            items.find(
                              (item) =>
                                item.id ===
                                Number(
                                  ingredient.ingredientItemId
                                )
                            );

                          const unit =
                            units.find(
                              (unit) =>
                                unit.id ===
                                Number(
                                  ingredient.unitId
                                )
                            );

                          const requiredQty =
                            Number(
                              ingredient.quantity ||
                                0
                            ) *
                            scaleFactor;

                          return (
                            <tr key={index}>
                              <td>
                                {item?.name ||
                                  "-"}
                              </td>

                              <td>
                                {Number(
                                  ingredient.quantity ||
                                    0
                                ).toFixed(
                                  3
                                )}
                              </td>

                              <td>
                                {requiredQty.toFixed(
                                  3
                                )}
                              </td>

                              <td>
                                {unit?.code ||
                                  "-"}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex gap-2 mb-4">
            <button
              type="button"
              className="btn btn-success"
              onClick={handleSave}
              disabled={
                saving || !editing
              }
            >
              {saving
                ? "Saving..."
                : selectedId
                  ? "Update Formula"
                  : "Save Formula"}
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={
                handleCancel
              }
            >
              Cancel
            </button>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Formula List
            </h5>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="showInactiveFormulas"
                checked={
                  showInactive
                }
                onChange={(
                  event
                ) =>
                  setShowInactive(
                    event.target.checked
                  )
                }
              />

              <label
                className="form-check-label"
                htmlFor="showInactiveFormulas"
              >
                Show Inactive
              </label>
            </div>
          </div>

          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search formula code, name or finished product..."
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
                  <th>Finished Product</th>
                  <th>Version</th>
                  <th>Base Batch</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center text-muted"
                    >
                      Loading formulas...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredFormulas.map(
                      (formula) => (
                        <tr
                          key={
                            formula.id
                          }
                        >
                          <td>
                            {
                              formula.code
                            }
                          </td>

                          <td>
                            {
                              formula.name
                            }
                          </td>

                          <td>
                            {
                              formula.finished_item_name
                            }
                          </td>

                          <td>
                            V
                            {
                              formula.version_no
                            }
                          </td>

                          <td>
                            {
                              formula.batch_size
                            }{" "}
                            {
                              formula.batch_unit_code
                            }
                          </td>

                          <td>
                            {formula.is_active ? (
                              <span className="badge text-bg-success">
                                Active
                              </span>
                            ) : (
                              <span className="badge text-bg-secondary">
                                Inactive
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() =>
                                  loadFormulaForEdit(
                                    formula.id
                                  )
                                }
                              >
                                Edit
                              </button>

                              {formula.is_active ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    handleDeactivate(
                                      formula
                                    )
                                  }
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() =>
                                    handleActivate(
                                      formula
                                    )
                                  }
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}

                    {filteredFormulas.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center text-muted"
                        >
                          No formulas found.
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

export default Formulas;