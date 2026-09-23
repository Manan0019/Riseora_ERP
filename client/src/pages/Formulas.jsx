import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";

const STANDARD_UNITS = {
  ML: { family: "VOLUME", factor: 1 },
  L: { family: "VOLUME", factor: 1000 },
  G: { family: "WEIGHT", factor: 1 },
  KG: { family: "WEIGHT", factor: 1000 },
  PCS: { family: "COUNT", factor: 1 },
};

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
  entryMode: "QUANTITY",
  compositionSize: "",
  compositionUnitId: "",
  notes: "",
});

const cleanNumber = (value, digits = 6) => {
  if (!Number.isFinite(Number(value))) return "";
  return String(Number(Number(value).toFixed(digits)));
};

function convertClient(quantity, fromUnit, toUnit, item = null) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) throw new Error("Invalid quantity");
  if (!fromUnit || !toUnit) throw new Error("Unit missing");
  if (fromUnit.code === toUnit.code) return qty;

  const from = STANDARD_UNITS[String(fromUnit.code || "").toUpperCase()];
  const to = STANDARD_UNITS[String(toUnit.code || "").toUpperCase()];
  if (!from || !to) throw new Error("Units are not directly convertible");

  if (from.family === to.family) {
    return (qty * from.factor) / to.factor;
  }

  const isWeightVolumePair =
    [from.family, to.family].every((family) => ["WEIGHT", "VOLUME"].includes(family));
  const density = Number(item?.density);
  if (!isWeightVolumePair || !Number.isFinite(density) || density <= 0) {
    throw new Error("Weight/volume conversion requires item density");
  }

  if (from.family === "WEIGHT") {
    const grams = qty * from.factor;
    const millilitres = grams / density;
    return millilitres / to.factor;
  }

  const millilitres = qty * from.factor;
  const grams = millilitres * density;
  return grams / to.factor;
}

function Formulas() {
  const { confirm: confirmAction } = useUi();
  const [formulas, setFormulas] = useState([]);
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [ingredients, setIngredients] = useState([emptyIngredient()]);
  const [mode, setMode] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [sourceFormulaId, setSourceFormulaId] = useState(null);
  const [selectedFormulaInfo, setSelectedFormulaInfo] = useState(null);
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

  const finishedItems = useMemo(
    () => items.filter((item) => item.category_code === "FG"),
    [items],
  );

  const componentItems = useMemo(
    () => items.filter((item) => ["RAW", "PACK"].includes(item.category_code)),
    [items],
  );

  const isReadOnly = mode === "VIEW";
  const isNewVersion = mode === "NEW_VERSION";

  const unitById = (id) => units.find((unit) => Number(unit.id) === Number(id));
  const itemById = (id) => componentItems.find((item) => Number(item.id) === Number(id));

  const compatibleUnitsForItem = (item) => {
    if (!item) return units;
    const baseUnit = unitById(item.base_unit_id);
    if (!baseUnit) return units;
    return units.filter((unit) => {
      if (unit.code === baseUnit.code) return true;
      const a = STANDARD_UNITS[String(unit.code || "").toUpperCase()];
      const b = STANDARD_UNITS[String(baseUnit.code || "").toUpperCase()];
      return Boolean(a && b && a.family === b.family);
    });
  };

  const compatibleBatchUnits = useMemo(() => {
    const finished = finishedItems.find((item) => Number(item.id) === Number(form.finishedItemId));
    if (!finished) return units;
    return compatibleUnitsForItem(finished);
  }, [finishedItems, units, form.finishedItemId]);

  const compositionUnits = useMemo(
    () => units.filter((unit) => ["G", "KG", "ML", "L"].includes(String(unit.code || "").toUpperCase())),
    [units],
  );

  const getComponentTypeLabel = (item) => {
    if (!item) return "-";
    if (item.category_code === "RAW") return "Raw Material";
    if (item.category_code === "PACK") return "Packaging";
    return item.category_name || item.category_code || "-";
  };

  const rawRows = useMemo(
    () => ingredients.filter((row) => itemById(row.ingredientItemId)?.category_code === "RAW"),
    [ingredients, componentItems],
  );

  const rawPercentageTotal = useMemo(
    () => rawRows.reduce((sum, row) => sum + (Number(row.percentage) || 0), 0),
    [rawRows],
  );

  const percentageRemaining = 100 - rawPercentageTotal;
  const percentageOver = rawPercentageTotal > 100.01;
  const percentageComplete = Math.abs(rawPercentageTotal - 100) <= 0.01;

  const quantityPercentagesAreAuto = useMemo(() => {
    if (form.entryMode !== "QUANTITY" || rawRows.length === 0) return false;
    const firstUnit = unitById(rawRows[0].unitId);
    if (!firstUnit || !["WEIGHT", "VOLUME"].includes(firstUnit.unit_type)) return false;
    try {
      rawRows.forEach((row) => {
        const source = unitById(row.unitId);
        const item = itemById(row.ingredientItemId);
        if (!(Number(row.quantity) > 0)) throw new Error("Missing quantity");
        convertClient(Number(row.quantity), source, firstUnit, item);
      });
      return true;
    } catch {
      return false;
    }
  }, [form.entryMode, rawRows, units]);

  const loadFormulas = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/formulas", { params: { includeInactive: showInactive } });
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
      const [itemResponse, unitResponse] = await Promise.all([api.get("/items"), api.get("/units")]);
      setItems(itemResponse.data.items || []);
      setUnits(unitResponse.data.units || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load items or units.");
    }
  };

  const resetEditor = () => {
    setMode(null);
    setSelectedId(null);
    setSourceFormulaId(null);
    setSelectedFormulaInfo(null);
    setShowForm(false);
    setForm(emptyForm());
    setIngredients([emptyIngredient()]);
    setScaleBatchSize("");
  };

  const handleNew = () => {
    setMessage("");
    setError("");
    setMode("NEW");
    setSelectedId(null);
    setSourceFormulaId(null);
    setSelectedFormulaInfo(null);
    setShowForm(true);
    setForm(emptyForm());
    setIngredients([emptyIngredient()]);
    setScaleBatchSize("");
  };

  const handleCancel = () => {
    resetEditor();
    setMessage("");
    setError("");
  };

  const deriveQuantityPercentages = (rows) => {
    const raw = rows.filter((row) => itemById(row.ingredientItemId)?.category_code === "RAW");
    if (!raw.length) return rows;
    const firstUnit = unitById(raw[0].unitId);
    if (!firstUnit || !["WEIGHT", "VOLUME"].includes(firstUnit.unit_type)) return rows;

    try {
      const converted = raw.map((row) => ({
        row,
        quantity: convertClient(
          Number(row.quantity),
          unitById(row.unitId),
          firstUnit,
          itemById(row.ingredientItemId),
        ),
      }));
      if (converted.some((entry) => !(entry.quantity > 0))) return rows;
      const total = converted.reduce((sum, entry) => sum + entry.quantity, 0);
      if (!(total > 0)) return rows;
      const pctByItem = new Map(
        converted.map((entry) => [String(entry.row.ingredientItemId), (entry.quantity / total) * 100]),
      );
      return rows.map((row) => {
        const item = itemById(row.ingredientItemId);
        if (item?.category_code === "RAW") {
          return { ...row, percentage: cleanNumber(pctByItem.get(String(row.ingredientItemId)), 4) };
        }
        if (item?.category_code === "PACK") return { ...row, percentage: "" };
        return row;
      });
    } catch {
      return rows;
    }
  };

  const derivePercentageQuantities = (rows, nextForm) => {
    if (nextForm.entryMode !== "PERCENTAGE") return rows;
    const compositionSize = Number(nextForm.compositionSize);
    const compositionUnit = unitById(nextForm.compositionUnitId);
    if (!(compositionSize > 0) || !compositionUnit) return rows;

    return rows.map((row) => {
      const item = itemById(row.ingredientItemId);
      if (item?.category_code === "PACK") return { ...row, percentage: "" };
      if (item?.category_code !== "RAW") return row;
      const pct = Number(row.percentage);
      const targetUnit = unitById(row.unitId);
      if (!(pct > 0) || !targetUnit) return row;
      try {
        const basisQty = compositionSize * (pct / 100);
        return {
          ...row,
          quantity: cleanNumber(convertClient(basisQty, compositionUnit, targetUnit, item), 6),
        };
      } catch {
        return { ...row, quantity: "" };
      }
    });
  };

  const syncRows = (rows, nextForm) => {
    if (nextForm.entryMode === "PERCENTAGE") return derivePercentageQuantities(rows, nextForm);
    return deriveQuantityPercentages(rows);
  };

  const handleEntryModeChange = (value) => {
    if (isReadOnly) return;
    const nextMode = value === "PERCENTAGE" ? "PERCENTAGE" : "QUANTITY";
    let nextForm = { ...form, entryMode: nextMode };
    let nextRows = ingredients.map((row) => ({ ...row }));

    if (nextMode === "PERCENTAGE") {
      const raw = nextRows.filter((row) => itemById(row.ingredientItemId)?.category_code === "RAW");
      if (raw.length) {
        const firstUnit = unitById(raw[0].unitId);
        try {
          const converted = raw.map((row) =>
            convertClient(
              Number(row.quantity),
              unitById(row.unitId),
              firstUnit,
              itemById(row.ingredientItemId),
            ),
          );
          const total = converted.reduce((sum, qty) => sum + qty, 0);
          if (firstUnit && total > 0 && ["WEIGHT", "VOLUME"].includes(firstUnit.unit_type)) {
            nextForm = {
              ...nextForm,
              compositionSize: cleanNumber(total, 6),
              compositionUnitId: String(firstUnit.id),
            };
            nextRows = nextRows.map((row) => {
              const item = itemById(row.ingredientItemId);
              if (item?.category_code !== "RAW") return { ...row, percentage: "" };
              const qty = convertClient(
                Number(row.quantity),
                unitById(row.unitId),
                firstUnit,
                item,
              );
              return { ...row, percentage: cleanNumber((qty / total) * 100, 4) };
            });
          }
        } catch {
          nextForm = { ...nextForm, compositionSize: "", compositionUnitId: "" };
        }
      }
    } else {
      nextForm = { ...nextForm, compositionSize: "", compositionUnitId: "" };
      nextRows = deriveQuantityPercentages(nextRows);
    }

    setForm(nextForm);
    setIngredients(syncRows(nextRows, nextForm));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    if ((name === "code" && mode !== "NEW") || name === "versionNo") return;

    let nextForm = {
      ...form,
      [name]: name === "code" ? value.toUpperCase() : value,
    };

    if (name === "finishedItemId") {
      const finished = finishedItems.find((item) => Number(item.id) === Number(value));
      const currentBatchUnit = unitById(nextForm.batchUnitId);
      const compatible = compatibleUnitsForItem(finished);
      if (!currentBatchUnit || !compatible.some((unit) => Number(unit.id) === Number(currentBatchUnit.id))) {
        nextForm.batchUnitId = finished?.base_unit_id ? String(finished.base_unit_id) : "";
      }
    }

    setForm(nextForm);
    if (["compositionSize", "compositionUnitId"].includes(name)) {
      setIngredients((current) => syncRows(current, nextForm));
    }
  };

  const handleIngredientChange = (index, field, value) => {
    if (isReadOnly) return;

    let nextRows = ingredients.map((row) => ({ ...row }));
    const current = nextRows[index];

    if (field === "ingredientItemId") {
      const selectedItem = itemById(value);
      current.ingredientItemId = value;
      current.unitId = selectedItem?.base_unit_id ? String(selectedItem.base_unit_id) : "";
      current.percentage = selectedItem?.category_code === "PACK" ? "" : current.percentage;
      if (selectedItem?.category_code === "RAW" && form.entryMode === "PERCENTAGE" && !current.percentage) {
        current.percentage = "";
      }
    } else if (field === "percentage") {
      const item = itemById(current.ingredientItemId);
      if (item?.category_code === "RAW" && value !== "") {
        const otherTotal = nextRows.reduce((sum, row, rowIndex) => {
          if (rowIndex === index) return sum;
          const rowItem = itemById(row.ingredientItemId);
          return rowItem?.category_code === "RAW"
            ? sum + (Number(row.percentage) || 0)
            : sum;
        }, 0);
        const available = Math.max(0, 100 - otherTotal);
        if (Number(value) > available) {
          current[field] = cleanNumber(available, 4);
          setError(`Formula percentage cannot exceed 100%. Maximum available for this row is ${available.toFixed(2)}%.`);
        } else {
          current[field] = value;
          setError("");
        }
      } else {
        current[field] = value;
      }
    } else {
      current[field] = value;
    }

    nextRows[index] = current;
    setIngredients(syncRows(nextRows, form));
  };

  const addIngredient = () => {
    if (!isReadOnly) setIngredients((current) => [...current, emptyIngredient()]);
  };

  const removeIngredient = (index) => {
    if (isReadOnly) return;
    const next = ingredients.length === 1 ? [emptyIngredient()] : ingredients.filter((_, i) => i !== index);
    setIngredients(syncRows(next, form));
  };

  const applyFormulaToEditor = (formula, requestedMode) => {
    setShowForm(true);
    setMode(requestedMode);
    setSelectedFormulaInfo(formula);

    const nextVersion = requestedMode === "NEW_VERSION"
      ? Math.max(
          Number(formula.version_no || 0),
          ...formulas.filter((item) => item.code === formula.code).map((item) => Number(item.version_no || 0)),
        ) + 1
      : Number(formula.version_no || 1);

    setSelectedId(requestedMode === "NEW_VERSION" ? null : formula.id);
    setSourceFormulaId(requestedMode === "NEW_VERSION" ? formula.id : null);
    setForm({
      code: formula.code || "",
      name: formula.name || "",
      finishedItemId: String(formula.finished_item_id || ""),
      versionNo: String(nextVersion),
      batchSize: String(formula.batch_size || ""),
      batchUnitId: String(formula.batch_unit_id || ""),
      entryMode: String(formula.entry_mode || "QUANTITY").toUpperCase(),
      compositionSize: formula.composition_size == null ? "" : String(formula.composition_size),
      compositionUnitId: formula.composition_unit_id == null ? "" : String(formula.composition_unit_id),
      notes: formula.notes || "",
    });
    setIngredients(
      formula.ingredients?.length
        ? formula.ingredients.map((ingredient) => ({
            ingredientItemId: String(ingredient.ingredient_item_id),
            quantity: String(ingredient.quantity),
            unitId: String(ingredient.unit_id),
            percentage: ingredient.percentage == null ? "" : String(ingredient.percentage),
            notes: ingredient.notes || "",
          }))
        : [emptyIngredient()],
    );
    setScaleBatchSize(String(formula.batch_size || ""));
  };

  const loadFormula = async (id, requestedMode) => {
    try {
      setError("");
      setMessage("");
      const response = await api.get(`/formulas/${id}`);
      const formula = response.data.formula;
      if (requestedMode === "EDIT" && Number(formula.is_locked || 0) === 1) {
        applyFormulaToEditor(formula, "VIEW");
        setError(`Version ${formula.version_no} has already been used in production and is locked. Use Create New Version to change the recipe.`);
        return;
      }
      applyFormulaToEditor(formula, requestedMode);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to load formula details.");
    }
  };

  const handleEdit = (formula) => loadFormula(formula.id, Number(formula.is_locked || 0) === 1 ? "VIEW" : "EDIT");
  const handleCreateNewVersion = (formula) => loadFormula(formula.id, "NEW_VERSION");

  const validate = () => {
    if (!form.code.trim()) return "Formula code is required.";
    if (!form.name.trim()) return "Formula name is required.";
    if (!form.finishedItemId) return "Finished product is required.";
    if (!(Number(form.batchSize) > 0)) return "Batch size must be greater than zero.";
    if (!form.batchUnitId) return "Batch unit is required.";
    if (!ingredients.length) return "At least one formula component is required.";

    if (form.entryMode === "PERCENTAGE") {
      if (!(Number(form.compositionSize) > 0)) return "Composition total is required for percentage entry.";
      if (!form.compositionUnitId) return "Composition unit is required for percentage entry.";
      if (percentageOver) return `Formula percentage cannot exceed 100%. Current total: ${rawPercentageTotal.toFixed(2)}%.`;
      if (!percentageComplete) return `Raw-material percentage must total exactly 100%. ${Math.abs(percentageRemaining).toFixed(2)}% ${percentageRemaining > 0 ? "remains" : "is over"}.`;
    } else if (rawPercentageTotal > 100.01) {
      return `Formula percentage cannot exceed 100%. Current total: ${rawPercentageTotal.toFixed(2)}%.`;
    }

    const seen = new Set();
    for (let index = 0; index < ingredients.length; index++) {
      const row = ingredients[index];
      if (!row.ingredientItemId) return `Component is required in row ${index + 1}.`;
      if (seen.has(String(row.ingredientItemId))) return `The same component cannot be entered more than once. Check row ${index + 1}.`;
      seen.add(String(row.ingredientItemId));
      const item = itemById(row.ingredientItemId);
      if (!item || !["RAW", "PACK"].includes(item.category_code)) return `Only RAW or PACK items can be used in row ${index + 1}.`;
      if (!row.unitId) return `Unit is required in row ${index + 1}.`;

      if (item.category_code === "RAW" && form.entryMode === "PERCENTAGE") {
        if (!(Number(row.percentage) > 0)) return `Percentage must be greater than zero in row ${index + 1}.`;
        if (!(Number(row.quantity) > 0)) {
          return `${item.name}: quantity could not be calculated. Use a compatible unit, enter Density in Item Master for weight ↔ volume conversion, or use Quantity entry.`;
        }
      } else if (!(Number(row.quantity) > 0)) {
        return `Quantity must be greater than zero in row ${index + 1}.`;
      }
    }
    return null;
  };

  const buildPayload = () => ({
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    finishedItemId: Number(form.finishedItemId),
    versionNo: Number(form.versionNo || 1),
    batchSize: Number(form.batchSize),
    batchUnitId: Number(form.batchUnitId),
    entryMode: form.entryMode,
    compositionSize: form.entryMode === "PERCENTAGE" ? Number(form.compositionSize) : null,
    compositionUnitId: form.entryMode === "PERCENTAGE" ? Number(form.compositionUnitId) : null,
    notes: form.notes.trim(),
    ingredients: ingredients.map((row) => ({
      ingredientItemId: Number(row.ingredientItemId),
      quantity: Number(row.quantity),
      unitId: Number(row.unitId),
      percentage: row.percentage === "" ? "" : Number(row.percentage),
      notes: row.notes.trim(),
    })),
  });

  const handleSave = async () => {
    setMessage("");
    setError("");
    if (isReadOnly) {
      setError("This formula version is read-only because it has already been used in production.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload();
      let response;
      if (mode === "NEW") response = await api.post("/formulas", payload);
      else if (mode === "EDIT") response = await api.put(`/formulas/${selectedId}`, payload);
      else response = await api.post(`/formulas/${sourceFormulaId}/new-version`, payload);

      setMessage(response.data.message || "Formula saved successfully.");
      resetEditor();
      await loadFormulas();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to save formula.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (formula) => {
    const confirmed = await confirmAction({
      title: "Deactivate formula version?",
      message: `${formula.code} V${formula.version_no} will be removed from active production selection.`,
      detail: "Historical production batches keep their formula/version snapshot.",
      confirmLabel: "Deactivate Formula",
      cancelLabel: "Keep Active",
      variant: "warning",
    });
    if (!confirmed) return;
    try {
      setError("");
      setMessage("");
      await api.patch(`/formulas/${formula.id}/deactivate`);
      setMessage("Formula deactivated successfully.");
      await loadFormulas();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate formula.");
    }
  };

  const handleActivate = async (formula) => {
    const confirmed = await confirmAction({
      title: "Activate formula version?",
      message: `${formula.code} V${formula.version_no} will become the active version.`,
      detail: "Other versions of the same formula code will be made inactive to keep one current manufacturing standard.",
      confirmLabel: "Activate Version",
      cancelLabel: "Keep Current Version",
      variant: "primary",
    });
    if (!confirmed) return;
    try {
      setError("");
      setMessage("");
      const response = await api.patch(`/formulas/${formula.id}/activate`);
      setMessage(response.data.message || "Formula activated successfully.");
      await loadFormulas();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to activate formula.");
    }
  };

  const isLatestFormulaVersion = (formula) =>
    !formulas.some((other) => other.code === formula.code && Number(other.version_no || 0) > Number(formula.version_no || 0));

  const filteredFormulas = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return formulas;
    return formulas.filter((formula) =>
      [formula.code, formula.name, formula.finished_item_name, formula.entry_mode]
        .some((value) => String(value || "").toLowerCase().includes(text)),
    );
  }, [formulas, search]);

  const scaleFactor = Number(form.batchSize) > 0 && Number(scaleBatchSize) > 0
    ? Number(scaleBatchSize) / Number(form.batchSize)
    : 0;

  const editorTitle = mode === "NEW"
    ? "New Formula"
    : mode === "NEW_VERSION"
      ? `Create New Version${form.code ? ` — ${form.code} V${form.versionNo}` : ""}`
      : mode === "VIEW"
        ? `Formula Details — ${form.code} V${form.versionNo}`
        : `Edit Formula — ${form.code} V${form.versionNo}`;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="mb-1">Formula Master</h2>
          <p className="text-muted mb-0">
            Maintain version-controlled recipes by direct quantity/weight or by percentage composition.
          </p>
        </div>
        {!showForm && <button type="button" className="btn btn-primary" onClick={handleNew}>New Formula</button>}
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {showForm && (
        <>
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
                <div>
                  <h5 className="mb-1">{editorTitle}</h5>
                  {mode === "NEW_VERSION" && <div className="text-muted small">A new active version will be created; the old version remains preserved.</div>}
                  {mode === "VIEW" && <div className="text-muted small">This version is locked because it has already been used in production.</div>}
                </div>
                {selectedFormulaInfo && Number(selectedFormulaInfo.production_count || 0) > 0 && (
                  <span className="badge text-bg-secondary">Used in {selectedFormulaInfo.production_count} batch{Number(selectedFormulaInfo.production_count) === 1 ? "" : "es"}</span>
                )}
              </div>

              <div className="row">
                <div className="col-lg-2 col-md-4 mb-3">
                  <label className="form-label">Formula Code *</label>
                  <input className="form-control" name="code" value={form.code} onChange={handleFormChange} disabled={mode !== "NEW"} />
                </div>
                <div className="col-lg-4 col-md-8 mb-3">
                  <label className="form-label">Formula Name *</label>
                  <input className="form-control" name="name" value={form.name} onChange={handleFormChange} disabled={isReadOnly} />
                </div>
                <div className="col-lg-4 col-md-8 mb-3">
                  <label className="form-label">Finished Product *</label>
                  <select className="form-select" name="finishedItemId" value={form.finishedItemId} onChange={handleFormChange} disabled={isReadOnly}>
                    <option value="">Select Finished Product</option>
                    {finishedItems.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                  </select>
                </div>
                <div className="col-lg-2 col-md-4 mb-3">
                  <label className="form-label">Version</label>
                  <input className="form-control" value={`V${form.versionNo}`} disabled />
                </div>
                <div className="col-lg-3 col-md-6 mb-3">
                  <label className="form-label">Base Batch Size *</label>
                  <input type="number" min="0" step="0.001" className="form-control" name="batchSize" value={form.batchSize} onChange={handleFormChange} disabled={isReadOnly} />
                  <div className="form-text">Expected finished-product output for this standard recipe.</div>
                </div>
                <div className="col-lg-3 col-md-6 mb-3">
                  <label className="form-label">Batch Unit *</label>
                  <select className="form-select" name="batchUnitId" value={form.batchUnitId} onChange={handleFormChange} disabled={isReadOnly}>
                    <option value="">Select Unit</option>
                    {compatibleBatchUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>)}
                  </select>
                </div>
                <div className="col-lg-6 mb-3">
                  <label className="form-label">Notes</label>
                  <input className="form-control" name="notes" value={form.notes} onChange={handleFormChange} disabled={isReadOnly} />
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4 formula-method-card">
            <div className="card-body">
              <div className="row align-items-end g-3">
                <div className="col-lg-4">
                  <label className="form-label">Recipe Entry Method *</label>
                  <select
                    className="form-select"
                    value={form.entryMode}
                    onChange={(event) => handleEntryModeChange(event.target.value)}
                    disabled={isReadOnly}
                  >
                    <option value="QUANTITY">Quantity / Weight / Volume</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                {form.entryMode === "PERCENTAGE" && (
                  <>
                    <div className="col-lg-3 col-md-6">
                      <label className="form-label">Composition Total *</label>
                      <input type="number" min="0" step="0.001" className="form-control" name="compositionSize" value={form.compositionSize} onChange={handleFormChange} disabled={isReadOnly} />
                    </div>
                    <div className="col-lg-3 col-md-6">
                      <label className="form-label">Composition Unit *</label>
                      <select className="form-select" name="compositionUnitId" value={form.compositionUnitId} onChange={handleFormChange} disabled={isReadOnly}>
                        <option value="">Select KG/G/L/ML</option>
                        {compositionUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="col-lg">
                  <div className={`formula-percentage-meter ${percentageOver ? "is-over" : percentageComplete ? "is-complete" : ""}`}>
                    <span>Raw Formula %</span>
                    <strong>{rawPercentageTotal.toFixed(2)}%</strong>
                    <small>
                      {percentageOver
                        ? `${Math.abs(percentageRemaining).toFixed(2)}% over limit`
                        : percentageComplete
                          ? "Complete"
                          : `${Math.max(0, percentageRemaining).toFixed(2)}% remaining`}
                    </small>
                  </div>
                </div>
              </div>

              <div className="formula-method-help mt-3">
                {form.entryMode === "PERCENTAGE" ? (
                  <>
                    Enter RAW materials as percentages. They must total exactly <strong>100%</strong>; the ERP calculates each weight/volume quantity from the composition total. Packaging stays quantity-based and is excluded from the 100% total. Mixed weight + volume conversion uses the component's Item Master density (g/mL = kg/L).
                  </>
                ) : quantityPercentagesAreAuto ? (
                  <>Enter exact quantities/weights. RAW percentages are calculated automatically from comparable weight or volume quantities. Packaging is excluded from the percentage total.</>
                ) : (
                  <>Enter exact quantities/weights/volumes. When a mixed weight + volume recipe has density in Item Master, the ERP also calculates percentage automatically. If density is missing, percentage may be entered as a reference but can never exceed 100%.</>
                )}
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <div>
                  <h5 className="mb-1">Formula Components</h5>
                  <div className="text-muted small">RAW materials form the recipe composition. PACK materials are always entered as direct quantities.</div>
                </div>
                {!isReadOnly && <button type="button" className="btn btn-sm btn-primary" onClick={addIngredient}>+ Add Component</button>}
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle formula-components-table">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 260 }}>Component</th>
                      <th style={{ width: 145 }}>Type</th>
                      <th style={{ width: 145 }}>Quantity</th>
                      <th style={{ width: 140 }}>Unit</th>
                      <th style={{ width: 150 }}>Percentage</th>
                      <th style={{ minWidth: 180 }}>Notes</th>
                      {!isReadOnly && <th style={{ width: 100 }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ingredient, index) => {
                      const item = itemById(ingredient.ingredientItemId);
                      const isRaw = item?.category_code === "RAW";
                      const isPack = item?.category_code === "PACK";
                      const quantityCalculated = form.entryMode === "PERCENTAGE" && isRaw;
                      const percentageAuto = form.entryMode === "QUANTITY" && quantityPercentagesAreAuto && isRaw;
                      const percentageDisabled = isReadOnly || isPack || percentageAuto;
                      const allowedUnits = compatibleUnitsForItem(item);

                      return (
                        <tr key={index}>
                          <td>
                            <select className="form-select" value={ingredient.ingredientItemId} onChange={(event) => handleIngredientChange(index, "ingredientItemId", event.target.value)} disabled={isReadOnly}>
                              <option value="">Select Component</option>
                              {componentItems.map((component) => <option key={component.id} value={component.id}>{component.code} - {component.name} [{component.category_code}]</option>)}
                            </select>
                          </td>
                          <td>{getComponentTypeLabel(item)}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              className={`form-control ${quantityCalculated ? "formula-calculated-field" : ""}`}
                              value={ingredient.quantity}
                              onChange={(event) => handleIngredientChange(index, "quantity", event.target.value)}
                              disabled={isReadOnly || quantityCalculated}
                              title={quantityCalculated ? "Calculated from percentage and composition total" : ""}
                            />
                            {quantityCalculated && <small className="formula-cell-hint">Calculated</small>}
                          </td>
                          <td>
                            <select className="form-select" value={ingredient.unitId} onChange={(event) => handleIngredientChange(index, "unitId", event.target.value)} disabled={isReadOnly}>
                              <option value="">Select Unit</option>
                              {allowedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
                            </select>
                          </td>
                          <td>
                            {isPack ? (
                              <span className="text-muted">Not applicable</span>
                            ) : (
                              <>
                                <div className="input-group">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    className={`form-control ${percentageAuto ? "formula-calculated-field" : ""}`}
                                    value={ingredient.percentage}
                                    onChange={(event) => handleIngredientChange(index, "percentage", event.target.value)}
                                    disabled={percentageDisabled}
                                  />
                                  <span className="input-group-text">%</span>
                                </div>
                                {percentageAuto && <small className="formula-cell-hint">Auto</small>}
                              </>
                            )}
                          </td>
                          <td><input className="form-control" value={ingredient.notes} onChange={(event) => handleIngredientChange(index, "notes", event.target.value)} disabled={isReadOnly} /></td>
                          {!isReadOnly && <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeIngredient(index)}>Remove</button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                <div>
                  <h5 className="mb-1">Scale Formula Preview</h5>
                  <div className="text-muted small">Preview required component quantities for another production size without changing the saved formula.</div>
                </div>
                <div style={{ minWidth: 260 }}>
                  <label className="form-label">Required Batch Size</label>
                  <input type="number" min="0" step="0.001" className="form-control" value={scaleBatchSize} onChange={(event) => setScaleBatchSize(event.target.value)} />
                </div>
              </div>

              {scaleFactor > 0 && (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr><th>Component</th><th>Type</th><th>Base Qty</th><th>Required Qty</th><th>Unit</th><th>Formula %</th></tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ingredient, index) => {
                        const item = itemById(ingredient.ingredientItemId);
                        const unit = unitById(ingredient.unitId);
                        const requiredQty = Number(ingredient.quantity || 0) * scaleFactor;
                        return (
                          <tr key={index}>
                            <td>{item?.name || "-"}</td>
                            <td>{getComponentTypeLabel(item)}</td>
                            <td>{Number(ingredient.quantity || 0).toFixed(3)}</td>
                            <td>{requiredQty.toFixed(3)}</td>
                            <td>{unit?.code || "-"}</td>
                            <td>{item?.category_code === "RAW" && ingredient.percentage !== "" ? `${Number(ingredient.percentage || 0).toFixed(2)}%` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex gap-2 mb-4 flex-wrap">
            {!isReadOnly && (
              <button type="button" className="btn btn-success" onClick={handleSave} disabled={saving || percentageOver}>
                {saving ? "Saving..." : isNewVersion ? `Create V${form.versionNo}` : mode === "EDIT" ? "Update Formula" : "Save Formula"}
              </button>
            )}
            {mode === "VIEW" && selectedFormulaInfo?.is_active && isLatestFormulaVersion(selectedFormulaInfo) && (
              <button type="button" className="btn btn-primary" onClick={() => handleCreateNewVersion(selectedFormulaInfo)}>Create New Version</button>
            )}
            <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}>Cancel</button>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 gap-3 flex-wrap">
            <h5 className="mb-0">Formula List</h5>
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="showInactiveFormulas" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              <label className="form-check-label" htmlFor="showInactiveFormulas">Show Inactive</label>
            </div>
          </div>

          <div className="mb-3">
            <input className="form-control" placeholder="Search formula code, name, product or entry method..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr><th>Code</th><th>Name</th><th>Finished Product</th><th>Version</th><th>Base Batch</th><th>Entry Method</th><th>Usage</th><th>Status</th><th style={{ minWidth: 300 }}>Action</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center text-muted">Loading formulas...</td></tr>
                ) : (
                  <>
                    {filteredFormulas.map((formula) => (
                      <tr key={formula.id}>
                        <td>{formula.code}</td>
                        <td>{formula.name}</td>
                        <td>{formula.finished_item_name}</td>
                        <td>V{formula.version_no}</td>
                        <td>{formula.batch_size} {formula.batch_unit_code}</td>
                        <td>
                          <span className="badge text-bg-light text-dark border">
                            {String(formula.entry_mode || "QUANTITY").toUpperCase() === "PERCENTAGE" ? "Percentage" : "Quantity / Weight / Volume"}
                          </span>
                        </td>
                        <td>{Number(formula.production_count || 0) > 0 ? <span className="badge text-bg-secondary">{formula.production_count} batch{Number(formula.production_count) === 1 ? "" : "es"}</span> : <span className="badge text-bg-light text-dark border">Draft</span>}</td>
                        <td>{formula.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(formula)}>{Number(formula.is_locked || 0) === 1 ? "View" : "Edit"}</button>
                            {formula.is_active && isLatestFormulaVersion(formula) && <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => handleCreateNewVersion(formula)}>Create New Version</button>}
                            {formula.is_active ? (
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeactivate(formula)}>Deactivate</button>
                            ) : isLatestFormulaVersion(formula) ? (
                              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => handleActivate(formula)}>Activate</button>
                            ) : <span className="badge text-bg-light text-dark border align-self-center">Historical</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFormulas.length === 0 && <tr><td colSpan={9} className="text-center text-muted">No formulas found.</td></tr>}
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
