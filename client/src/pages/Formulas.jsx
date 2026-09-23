import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";
import { useUi } from "../context/UiContext";

const emptyIngredient =
  () => ({
    ingredientItemId: "",
    quantity: "",
    unitId: "",
    percentage: "",
    notes: "",
  });

const emptyForm =
  () => ({
    code: "",
    name: "",
    finishedItemId: "",
    versionNo: "1",
    batchSize: "",
    batchUnitId: "",
    notes: "",
  });

function Formulas() {
  const { confirm: confirmAction } = useUi();
  const [
    formulas,
    setFormulas,
  ] = useState([]);

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    units,
    setUnits,
  ] = useState([]);

  const [
    form,
    setForm,
  ] = useState(
    emptyForm()
  );

  const [
    ingredients,
    setIngredients,
  ] = useState([
    emptyIngredient(),
  ]);

  const [
    mode,
    setMode,
  ] = useState(null);

  const [
    selectedId,
    setSelectedId,
  ] = useState(null);

  const [
    sourceFormulaId,
    setSourceFormulaId,
  ] = useState(null);

  const [
    selectedFormulaInfo,
    setSelectedFormulaInfo,
  ] = useState(null);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    showInactive,
    setShowInactive,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    scaleBatchSize,
    setScaleBatchSize,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    loadFormulas();
  }, [showInactive]);

  useEffect(() => {
    loadLookups();
  }, []);

  const finishedItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.category_code ===
            "FG"
        ),
      [items]
    );

  const componentItems =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item.category_code ===
              "RAW" ||
            item.category_code ===
              "PACK"
        ),
      [items]
    );

  const isReadOnly =
    mode === "VIEW";

  const isNewVersion =
    mode ===
    "NEW_VERSION";

  const getComponentTypeLabel =
    (item) => {
      if (!item) {
        return "-";
      }

      if (
        item.category_code ===
        "RAW"
      ) {
        return "Raw Material";
      }

      if (
        item.category_code ===
        "PACK"
      ) {
        return "Packaging";
      }

      return (
        item.category_name ||
        item.category_code ||
        "-"
      );
    };

  const loadFormulas =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await api.get(
            "/formulas",
            {
              params: {
                includeInactive:
                  showInactive,
              },
            }
          );

        setFormulas(
          response.data
            .formulas || []
        );
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load formulas."
        );
      } finally {
        setLoading(false);
      }
    };

  const loadLookups =
    async () => {
      try {
        const [
          itemResponse,
          unitResponse,
        ] =
          await Promise.all([
            api.get(
              "/items"
            ),

            api.get(
              "/units"
            ),
          ]);

        setItems(
          itemResponse.data
            .items || []
        );

        setUnits(
          unitResponse.data
            .units || []
        );
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load items or units."
        );
      }
    };

  const resetEditor =
    () => {
      setMode(null);

      setSelectedId(
        null
      );

      setSourceFormulaId(
        null
      );

      setSelectedFormulaInfo(
        null
      );

      setShowForm(false);

      setForm(
        emptyForm()
      );

      setIngredients([
        emptyIngredient(),
      ]);

      setScaleBatchSize(
        ""
      );
    };

  const handleNew =
    () => {
      setMessage("");
      setError("");

      setMode("NEW");

      setSelectedId(
        null
      );

      setSourceFormulaId(
        null
      );

      setSelectedFormulaInfo(
        null
      );

      setShowForm(true);

      setForm(
        emptyForm()
      );

      setIngredients([
        emptyIngredient(),
      ]);

      setScaleBatchSize(
        ""
      );
    };

  const handleCancel =
    () => {
      resetEditor();

      setMessage("");
      setError("");
    };

  const handleFormChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      if (
        (
          name === "code" &&
          mode !== "NEW"
        ) ||
        name ===
          "versionNo"
      ) {
        return;
      }

      setForm(
        (current) => ({
          ...current,

          [name]:
            name === "code"
              ? value.toUpperCase()
              : value,
        })
      );
    };

  const handleIngredientChange =
    (
      index,
      field,
      value
    ) => {
      if (
        isReadOnly
      ) {
        return;
      }

      setIngredients(
        (current) =>
          current.map(
            (
              ingredient,
              ingredientIndex
            ) => {
              if (
                ingredientIndex !==
                index
              ) {
                return ingredient;
              }

              if (
                field ===
                "ingredientItemId"
              ) {
                const selectedItem =
                  componentItems.find(
                    (item) =>
                      item.id ===
                      Number(
                        value
                      )
                  );

                return {
                  ...ingredient,

                  ingredientItemId:
                    value,

                  unitId:
                    selectedItem
                      ?.base_unit_id
                      ? String(
                          selectedItem
                            .base_unit_id
                        )
                      : "",
                };
              }

              return {
                ...ingredient,

                [field]:
                  value,
              };
            }
          )
      );
    };

  const addIngredient =
    () => {
      if (
        isReadOnly
      ) {
        return;
      }

      setIngredients(
        (current) => [
          ...current,
          emptyIngredient(),
        ]
      );
    };

  const removeIngredient =
    (index) => {
      if (
        isReadOnly
      ) {
        return;
      }

      if (
        ingredients.length ===
        1
      ) {
        setIngredients([
          emptyIngredient(),
        ]);

        return;
      }

      setIngredients(
        (current) =>
          current.filter(
            (
              _,
              ingredientIndex
            ) =>
              ingredientIndex !==
              index
          )
      );
    };

  const applyFormulaToEditor =
    (
      formula,
      requestedMode
    ) => {
      setShowForm(true);

      setMode(
        requestedMode
      );

      setSelectedFormulaInfo(
        formula
      );

      if (
        requestedMode ===
        "NEW_VERSION"
      ) {
        setSelectedId(
          null
        );

        setSourceFormulaId(
          formula.id
        );

        const sameCodeVersions =
          formulas.filter(
            (item) =>
              item.code ===
              formula.code
          );

        const highestVersion =
          sameCodeVersions.length >
          0
            ? Math.max(
                ...sameCodeVersions.map(
                  (item) =>
                    Number(
                      item.version_no ||
                        0
                    )
                )
              )
            : Number(
                formula.version_no ||
                  0
              );

        const nextVersion =
          highestVersion + 1;

        setForm({
          code:
            formula.code ||
            "",

          name:
            formula.name ||
            "",

          finishedItemId:
            String(
              formula
                .finished_item_id ||
                ""
            ),

          versionNo:
            String(
              nextVersion
            ),

          batchSize:
            String(
              formula.batch_size ||
                ""
            ),

          batchUnitId:
            String(
              formula
                .batch_unit_id ||
                ""
            ),

          notes:
            formula.notes ||
            "",
        });
      } else {
        setSelectedId(
          formula.id
        );

        setSourceFormulaId(
          null
        );

        setForm({
          code:
            formula.code ||
            "",

          name:
            formula.name ||
            "",

          finishedItemId:
            String(
              formula
                .finished_item_id ||
                ""
            ),

          versionNo:
            String(
              formula.version_no ||
                1
            ),

          batchSize:
            String(
              formula.batch_size ||
                ""
            ),

          batchUnitId:
            String(
              formula
                .batch_unit_id ||
                ""
            ),

          notes:
            formula.notes ||
            "",
        });
      }

      setIngredients(
        formula.ingredients
          ?.length
          ? formula.ingredients.map(
              (
                ingredient
              ) => ({
                ingredientItemId:
                  String(
                    ingredient
                      .ingredient_item_id
                  ),

                quantity:
                  String(
                    ingredient
                      .quantity
                  ),

                unitId:
                  String(
                    ingredient
                      .unit_id
                  ),

                percentage:
                  ingredient
                    .percentage ==
                  null
                    ? ""
                    : String(
                        ingredient
                          .percentage
                      ),

                notes:
                  ingredient
                    .notes ||
                  "",
              })
            )
          : [
              emptyIngredient(),
            ]
      );

      setScaleBatchSize(
        String(
          formula.batch_size ||
            ""
        )
      );
    };

  const loadFormula =
    async (
      id,
      requestedMode
    ) => {
      try {
        setError("");
        setMessage("");

        const response =
          await api.get(
            `/formulas/${id}`
          );

        const formula =
          response.data
            .formula;

        if (
          requestedMode ===
            "EDIT" &&
          Number(
            formula.is_locked ||
              0
          ) === 1
        ) {
          applyFormulaToEditor(
            formula,
            "VIEW"
          );

          setError(
            `Version ${formula.version_no} has already been used in production and is locked. Use Create New Version to change the recipe.`
          );

          return;
        }

        applyFormulaToEditor(
          formula,
          requestedMode
        );
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data
            ?.message ||
            "Unable to load formula details."
        );
      }
    };

  const handleEdit =
    (formula) => {
      loadFormula(
        formula.id,

        Number(
          formula.is_locked ||
            0
        ) === 1
          ? "VIEW"
          : "EDIT"
      );
    };

  const handleCreateNewVersion =
    (formula) => {
      loadFormula(
        formula.id,
        "NEW_VERSION"
      );
    };

  const validate =
    () => {
      if (
        !form.code.trim()
      ) {
        return "Formula code is required.";
      }

      if (
        !form.name.trim()
      ) {
        return "Formula name is required.";
      }

      if (
        !form.finishedItemId
      ) {
        return "Finished product is required.";
      }

      const finishedItem =
        finishedItems.find(
          (item) =>
            item.id ===
            Number(
              form.finishedItemId
            )
        );

      if (
        !finishedItem
      ) {
        return "Finished product must belong to the FG category.";
      }

      if (
        Number(
          form.batchSize
        ) <= 0
      ) {
        return "Batch size must be greater than zero.";
      }

      if (
        !form.batchUnitId
      ) {
        return "Batch unit is required.";
      }

      if (
        !Array.isArray(
          ingredients
        ) ||
        ingredients.length ===
          0
      ) {
        return "At least one formula component is required.";
      }

      const componentIds =
        ingredients
          .map(
            (
              ingredient
            ) =>
              Number(
                ingredient
                  .ingredientItemId
              )
          )
          .filter(
            (id) =>
              id > 0
          );

      const duplicateId =
        componentIds.find(
          (
            id,
            index
          ) =>
            componentIds.indexOf(
              id
            ) !== index
        );

      if (
        duplicateId
      ) {
        return "The same raw material or packaging item cannot be added more than once. Combine its quantity into one row.";
      }

      for (
        let index = 0;
        index <
        ingredients.length;
        index++
      ) {
        const ingredient =
          ingredients[
            index
          ];

        if (
          !ingredient
            .ingredientItemId
        ) {
          return `Component is required in row ${
            index + 1
          }.`;
        }

        const componentItem =
          componentItems.find(
            (item) =>
              item.id ===
              Number(
                ingredient
                  .ingredientItemId
              )
          );

        if (
          !componentItem
        ) {
          return `Only RAW or PACK items can be used in row ${
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

        if (
          !ingredient.unitId
        ) {
          return `Unit is required in row ${
            index + 1
          }.`;
        }

        if (
          ingredient
            .percentage !==
            "" &&
          ingredient
            .percentage !=
            null &&
          (
            Number(
              ingredient
                .percentage
            ) < 0 ||
            Number(
              ingredient
                .percentage
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

  const buildPayload =
    () => ({
      code:
        form.code
          .trim()
          .toUpperCase(),

      name:
        form.name.trim(),

      finishedItemId:
        Number(
          form.finishedItemId
        ),

      versionNo:
        Number(
          form.versionNo ||
            1
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
          (
            ingredient
          ) => ({
            ingredientItemId:
              Number(
                ingredient
                  .ingredientItemId
              ),

            quantity:
              Number(
                ingredient
                  .quantity
              ),

            unitId:
              Number(
                ingredient
                  .unitId
              ),

            percentage:
              ingredient
                .percentage ===
              ""
                ? ""
                : Number(
                    ingredient
                      .percentage
                  ),

            notes:
              ingredient.notes
                .trim(),
          })
        ),
    });

  const handleSave =
    async () => {
      setMessage("");
      setError("");

      if (
        isReadOnly
      ) {
        setError(
          "This formula version is read-only because it has already been used in production."
        );

        return;
      }

      const validationError =
        validate();

      if (
        validationError
      ) {
        setError(
          validationError
        );

        return;
      }

      const payload =
        buildPayload();

      try {
        setSaving(true);

        if (
          mode === "NEW"
        ) {
          const response =
            await api.post(
              "/formulas",
              payload
            );

          setMessage(
            response.data
              .message ||
              "Formula Version 1 saved successfully."
          );
        } else if (
          mode === "EDIT"
        ) {
          const response =
            await api.put(
              `/formulas/${selectedId}`,
              payload
            );

          setMessage(
            response.data
              .message ||
              "Formula updated successfully."
          );
        } else if (
          mode ===
          "NEW_VERSION"
        ) {
          const response =
            await api.post(
              `/formulas/${sourceFormulaId}/new-version`,
              payload
            );

          setMessage(
            response.data
              .message ||
              "New formula version created successfully."
          );
        }

        resetEditor();

        await loadFormulas();
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data
            ?.message ||
            "Unable to save formula."
        );
      } finally {
        setSaving(false);
      }
    };

  const handleDeactivate =
    async (
      formula
    ) => {
      const confirmed = await confirmAction({
        title: "Deactivate formula version?",
        message: `${formula.code} V${formula.version_no} will be removed from active production selection.`,
        detail: "Historical production batches keep their formula/version snapshot.",
        confirmLabel: "Deactivate Formula",
        cancelLabel: "Keep Active",
        variant: "warning",
      });

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setError("");
        setMessage("");

        await api.patch(
          `/formulas/${formula.id}/deactivate`
        );

        setMessage(
          "Formula deactivated successfully."
        );

        await loadFormulas();
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data
            ?.message ||
            "Unable to deactivate formula."
        );
      }
    };

  const handleActivate =
    async (
      formula
    ) => {
      const confirmed = await confirmAction({
        title: "Activate formula version?",
        message: `${formula.code} V${formula.version_no} will become the active version.`,
        detail: "Other versions of the same formula code will be made inactive to keep one current manufacturing standard.",
        confirmLabel: "Activate Version",
        cancelLabel: "Keep Current Version",
        variant: "primary",
      });

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setError("");
        setMessage("");

        const response =
          await api.patch(
            `/formulas/${formula.id}/activate`
          );

        setMessage(
          response.data
            .message ||
            "Formula activated successfully."
        );

        await loadFormulas();
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data
            ?.message ||
            "Unable to activate formula."
        );
      }
    };

  const isLatestFormulaVersion = (formula) => {
    return !formulas.some(
      (other) =>
        other.code === formula.code &&
        Number(other.version_no || 0) > Number(formula.version_no || 0),
    );
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
          String(
            formula.code ||
              ""
          )
            .toLowerCase()
            .includes(
              text
            ) ||
          String(
            formula.name ||
              ""
          )
            .toLowerCase()
            .includes(
              text
            ) ||
          String(
            formula
              .finished_item_name ||
              ""
          )
            .toLowerCase()
            .includes(
              text
            )
      );
    }, [
      formulas,
      search,
    ]);

  const scaleFactor =
    Number(
      form.batchSize
    ) > 0 &&
    Number(
      scaleBatchSize
    ) > 0
      ? Number(
          scaleBatchSize
        ) /
        Number(
          form.batchSize
        )
      : 0;

  const editorTitle =
    mode === "NEW"
      ? "New Formula"
      : mode ===
          "NEW_VERSION"
        ? `Create New Version${
            form.code
              ? ` — ${form.code} V${form.versionNo}`
              : ""
          }`
        : mode ===
            "VIEW"
          ? `Formula Details — ${form.code} V${form.versionNo}`
          : `Edit Formula — ${form.code} V${form.versionNo}`;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">
            Formula Master
          </h2>

          <p className="text-muted mb-0">
            Maintain version-controlled manufacturing recipes with raw materials and packaging components.
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={
              handleNew
            }
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
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="mb-1">
                    {
                      editorTitle
                    }
                  </h5>

                  {mode ===
                    "NEW_VERSION" && (
                    <div className="text-muted small">
                      This will create a new active version. The existing version will remain preserved for history.
                    </div>
                  )}

                  {mode ===
                    "VIEW" && (
                    <div className="text-muted small">
                      This version has already been used in production and its recipe is locked.
                    </div>
                  )}
                </div>

                {selectedFormulaInfo &&
                  Number(
                    selectedFormulaInfo
                      .production_count ||
                      0
                  ) > 0 && (
                    <span className="badge text-bg-secondary">
                      Used in{" "}
                      {
                        selectedFormulaInfo
                          .production_count
                      }{" "}
                      batch
                      {Number(
                        selectedFormulaInfo
                          .production_count
                      ) === 1
                        ? ""
                        : "es"}
                    </span>
                  )}
              </div>

              <div className="row">
                <div className="col-md-2 mb-3">
                  <label className="form-label">
                    Formula Code *
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    name="code"
                    value={
                      form.code
                    }
                    onChange={
                      handleFormChange
                    }
                    disabled={
                      mode !==
                      "NEW"
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
                    value={
                      form.name
                    }
                    onChange={
                      handleFormChange
                    }
                    disabled={
                      isReadOnly
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
                    disabled={
                      isReadOnly
                    }
                  >
                    <option value="">
                      Select Finished Product
                    </option>

                    {finishedItems.map(
                      (
                        item
                      ) => (
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
                          }
                          {" - "}
                          {
                            item.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="col-md-2 mb-3">
                  <label className="form-label">
                    Version
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={`V${form.versionNo}`}
                    disabled
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
                    disabled={
                      isReadOnly
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
                    disabled={
                      isReadOnly
                    }
                  >
                    <option value="">
                      Select Unit
                    </option>

                    {units.map(
                      (
                        unit
                      ) => (
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
                          {" - "}
                          {
                            unit.name
                          }
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
                    disabled={
                      isReadOnly
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
                  Formula Components
                </h5>

                {!isReadOnly && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={
                      addIngredient
                    }
                  >
                    + Add Component
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th
                        style={{
                          minWidth:
                            250,
                        }}
                      >
                        Component
                      </th>

                      <th
                        style={{
                          width:
                            140,
                        }}
                      >
                        Type
                      </th>

                      <th
                        style={{
                          width:
                            140,
                        }}
                      >
                        Quantity
                      </th>

                      <th
                        style={{
                          width:
                            150,
                        }}
                      >
                        Unit
                      </th>

                      <th
                        style={{
                          width:
                            130,
                        }}
                      >
                        Percentage
                      </th>

                      <th
                        style={{
                          minWidth:
                            180,
                        }}
                      >
                        Notes
                      </th>

                      {!isReadOnly && (
                        <th
                          style={{
                            width:
                              100,
                          }}
                        >
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {ingredients.map(
                      (
                        ingredient,
                        index
                      ) => {
                        const componentItem =
                          componentItems.find(
                            (
                              item
                            ) =>
                              item.id ===
                              Number(
                                ingredient
                                  .ingredientItemId
                              )
                          );

                        return (
                          <tr
                            key={
                              index
                            }
                          >
                            <td>
                              <select
                                className="form-select"
                                value={
                                  ingredient
                                    .ingredientItemId
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
                                disabled={
                                  isReadOnly
                                }
                              >
                                <option value="">
                                  Select Component
                                </option>

                                {componentItems.map(
                                  (
                                    item
                                  ) => (
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
                                      }
                                      {" - "}
                                      {
                                        item.name
                                      }
                                      {" ["}
                                      {
                                        item.category_code
                                      }
                                      {"]"}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td>
                              {getComponentTypeLabel(
                                componentItem
                              )}
                            </td>

                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                className="form-control"
                                value={
                                  ingredient
                                    .quantity
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
                                disabled={
                                  isReadOnly
                                }
                              />
                            </td>

                            <td>
                              <select
                                className="form-select"
                                value={
                                  ingredient
                                    .unitId
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
                                disabled={
                                  isReadOnly
                                }
                              >
                                <option value="">
                                  Select Unit
                                </option>

                                {units.map(
                                  (
                                    unit
                                  ) => (
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
                                  ingredient
                                    .percentage
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
                                disabled={
                                  isReadOnly
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="text"
                                className="form-control"
                                value={
                                  ingredient
                                    .notes
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
                                disabled={
                                  isReadOnly
                                }
                              />
                            </td>

                            {!isReadOnly && (
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
                            )}
                          </tr>
                        );
                      }
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
                        event.target
                          .value
                      )
                    }
                  />
                </div>
              </div>

              {scaleFactor >
                0 && (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>
                          Component
                        </th>

                        <th>
                          Type
                        </th>

                        <th>
                          Base Quantity
                        </th>

                        <th>
                          Required Quantity
                        </th>

                        <th>
                          Unit
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {ingredients.map(
                        (
                          ingredient,
                          index
                        ) => {
                          const item =
                            componentItems.find(
                              (
                                component
                              ) =>
                                component.id ===
                                Number(
                                  ingredient
                                    .ingredientItemId
                                )
                            );

                          const unit =
                            units.find(
                              (
                                value
                              ) =>
                                value.id ===
                                Number(
                                  ingredient
                                    .unitId
                                )
                            );

                          const requiredQty =
                            Number(
                              ingredient
                                .quantity ||
                                0
                            ) *
                            scaleFactor;

                          return (
                            <tr
                              key={
                                index
                              }
                            >
                              <td>
                                {
                                  item?.name ||
                                  "-"
                                }
                              </td>

                              <td>
                                {getComponentTypeLabel(
                                  item
                                )}
                              </td>

                              <td>
                                {Number(
                                  ingredient
                                    .quantity ||
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
                                {
                                  unit?.code ||
                                  "-"
                                }
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
            {!isReadOnly && (
              <button
                type="button"
                className="btn btn-success"
                onClick={
                  handleSave
                }
                disabled={
                  saving
                }
              >
                {saving
                  ? "Saving..."
                  : isNewVersion
                    ? `Create V${form.versionNo}`
                    : mode ===
                        "EDIT"
                      ? "Update Formula"
                      : "Save Formula"}
              </button>
            )}

            {mode ===
              "VIEW" &&
              selectedFormulaInfo &&
              selectedFormulaInfo.is_active &&
              isLatestFormulaVersion(selectedFormulaInfo) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    handleCreateNewVersion(
                      selectedFormulaInfo
                    )
                  }
                >
                  Create New Version
                </button>
              )}

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={
                handleCancel
              }
            >
              {isReadOnly
                ? "Close"
                : "Cancel"}
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
                    event.target
                      .checked
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
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
            />
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>
                    Code
                  </th>

                  <th>
                    Name
                  </th>

                  <th>
                    Finished Product
                  </th>

                  <th>
                    Version
                  </th>

                  <th>
                    Base Batch
                  </th>

                  <th>
                    Usage
                  </th>

                  <th>
                    Status
                  </th>

                  <th
                    style={{
                      minWidth:
                        300,
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                      className="text-center text-muted"
                    >
                      Loading formulas...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredFormulas.map(
                      (
                        formula
                      ) => (
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
                              formula
                                .finished_item_name
                            }
                          </td>

                          <td>
                            V
                            {
                              formula
                                .version_no
                            }
                          </td>

                          <td>
                            {
                              formula
                                .batch_size
                            }
                            {" "}
                            {
                              formula
                                .batch_unit_code
                            }
                          </td>

                          <td>
                            {Number(
                              formula
                                .production_count ||
                                0
                            ) > 0 ? (
                              <span className="badge text-bg-secondary">
                                {
                                  formula
                                    .production_count
                                }{" "}
                                batch
                                {Number(
                                  formula
                                    .production_count
                                ) ===
                                1
                                  ? ""
                                  : "es"}
                              </span>
                            ) : (
                              <span className="badge text-bg-light text-dark border">
                                Draft
                              </span>
                            )}
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
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() =>
                                  handleEdit(
                                    formula
                                  )
                                }
                              >
                                {Number(
                                  formula
                                    .is_locked ||
                                    0
                                ) === 1
                                  ? "View"
                                  : "Edit"}
                              </button>

                              {formula.is_active && isLatestFormulaVersion(formula) && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-dark"
                                  onClick={() => handleCreateNewVersion(formula)}
                                >
                                  Create New Version
                                </button>
                              )}

                              {formula.is_active ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeactivate(formula)}
                                >
                                  Deactivate
                                </button>
                              ) : isLatestFormulaVersion(formula) ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => handleActivate(formula)}
                                >
                                  Activate
                                </button>
                              ) : (
                                <span className="badge text-bg-light text-dark border align-self-center">
                                  Historical
                                </span>
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
                          colSpan={
                            8
                          }
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

          <div className="text-muted small mt-3">
            Used formula versions are locked for recipe changes. To change a historical recipe, create a new version instead.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Formulas;