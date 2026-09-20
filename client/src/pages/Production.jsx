import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";

function Production() {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const [formulas, setFormulas] =
    useState([]);

  const [formulaId, setFormulaId] =
    useState("");

  const [
    productionDate,
    setProductionDate,
  ] = useState(today);

  const [
    plannedBatchSize,
    setPlannedBatchSize,
  ] = useState("");

  const [
    actualOutputQty,
    setActualOutputQty,
  ] = useState("");

  const [
    finishedLotNo,
    setFinishedLotNo,
  ] = useState("");

  const [
    mfgDate,
    setMfgDate,
  ] = useState(today);

  const [
    expiryDate,
    setExpiryDate,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    calculation,
    setCalculation,
  ] = useState(null);

  const [
    consumption,
    setConsumption,
  ] = useState([]);

  const [
    calculating,
    setCalculating,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadFormulas();
  }, []);

  const loadFormulas =
    async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/formulas"
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
      }
    };

  const selectedFormula =
    useMemo(() => {
      return formulas.find(
        (formula) =>
          formula.id ===
          Number(formulaId)
      );
    }, [
      formulas,
      formulaId,
    ]);

  const handleFormulaChange =
    (event) => {
      const value =
        event.target.value;

      setFormulaId(value);

      setCalculation(null);
      setConsumption([]);

      setError("");
      setMessage("");

      const formula =
        formulas.find(
          (item) =>
            item.id ===
            Number(value)
        );

      if (formula) {
        setPlannedBatchSize(
          String(
            formula.batch_size
          )
        );

        setActualOutputQty(
          String(
            formula.batch_size
          )
        );
      } else {
        setPlannedBatchSize(
          ""
        );

        setActualOutputQty(
          ""
        );
      }
    };

  const calculateRequirements =
    async () => {
      setError("");
      setMessage("");

      if (!formulaId) {
        setError(
          "Please select a formula."
        );

        return;
      }

      if (
        Number(
          plannedBatchSize
        ) <= 0
      ) {
        setError(
          "Planned batch size must be greater than zero."
        );

        return;
      }

      try {
        setCalculating(
          true
        );

        const response =
          await api.get(
            "/production/calculate",
            {
              params: {
                formulaId:
                  Number(
                    formulaId
                  ),

                batchSize:
                  Number(
                    plannedBatchSize
                  ),
              },
            }
          );

        const result =
          response.data
            .calculation;

        setCalculation(
          result
        );

        setConsumption(
          result.ingredients.map(
            (ingredient) => ({
              itemId:
                ingredient
                  .ingredientItemId,

              actualQuantity:
                ingredient
                  .requiredQuantity,

              lotNo: "",
            })
          )
        );

        setActualOutputQty(
          String(
            plannedBatchSize
          )
        );
      } catch (err) {
        console.error(err);

        setCalculation(
          null
        );

        setConsumption(
          []
        );

        setError(
          err.response?.data
            ?.message ||
            "Unable to calculate production requirements."
        );
      } finally {
        setCalculating(
          false
        );
      }
    };

  const updateConsumption = (
    index,
    field,
    value
  ) => {
    setConsumption(
      (current) =>
        current.map(
          (
            item,
            itemIndex
          ) =>
            itemIndex ===
            index
              ? {
                  ...item,
                  [field]:
                    value,
                }
              : item
        )
    );
  };

  /*
   * Convert an actual quantity entered
   * in the formula/display unit into the
   * item's stock/base unit.
   *
   * We use the conversion ratio returned
   * by the backend calculation.
   *
   * Example:
   *
   * required:
   * 500 ML = 0.500 L
   *
   * ratio:
   * 0.500 / 500 = 0.001
   *
   * actual:
   * 480 ML × 0.001 = 0.480 L
   */
  const getActualBaseQuantity = (
    ingredient,
    actualQuantity
  ) => {
    const requiredQty =
      Number(
        ingredient
          .requiredQuantity ||
          0
      );

    const requiredBaseQty =
      Number(
        ingredient
          .requiredBaseQuantity ||
          0
      );

    const actualQty =
      Number(
        actualQuantity ||
          0
      );

    if (
      requiredQty <= 0
    ) {
      return 0;
    }

    const conversionFactor =
      requiredBaseQty /
      requiredQty;

    return (
      actualQty *
      conversionFactor
    );
  };

  const hasInsufficientStock =
    useMemo(() => {
      if (!calculation) {
        return false;
      }

      return calculation
        .ingredients
        .some(
          (
            ingredient,
            index
          ) => {
            const actualQty =
              Number(
                consumption[
                  index
                ]
                  ?.actualQuantity ||
                  0
              );

            const actualBaseQty =
              getActualBaseQuantity(
                ingredient,
                actualQty
              );

            const availableBase =
              Number(
                ingredient
                  .currentStockBase ||
                  0
              );

            return (
              actualBaseQty >
              availableBase
            );
          }
        );
    }, [
      calculation,
      consumption,
    ]);

  const outputDifference =
    Number(
      plannedBatchSize ||
        0
    ) -
    Number(
      actualOutputQty ||
        0
    );

  const outputLossPercent =
    Number(
      plannedBatchSize ||
        0
    ) > 0
      ? (
          outputDifference /
          Number(
            plannedBatchSize
          )
        ) *
        100
      : 0;

  const validate = () => {
    if (!productionDate) {
      return "Production date is required.";
    }

    if (!formulaId) {
      return "Formula is required.";
    }

    if (
      Number(
        plannedBatchSize
      ) <= 0
    ) {
      return "Planned batch size must be greater than zero.";
    }

    if (!calculation) {
      return "Calculate component requirements before saving.";
    }

    if (
      Number(
        actualOutputQty
      ) <= 0
    ) {
      return "Actual output quantity must be greater than zero.";
    }

    for (
      let index = 0;
      index <
      consumption.length;
      index++
    ) {
      const line =
        consumption[index];

      const ingredient =
        calculation
          .ingredients[
          index
        ];

      const actualQty =
        Number(
          line.actualQuantity
        );

      if (
        actualQty <= 0
      ) {
        return `Actual consumption must be greater than zero in row ${
          index + 1
        }.`;
      }

      const actualBaseQty =
        getActualBaseQuantity(
          ingredient,
          actualQty
        );

      const availableBase =
        Number(
          ingredient
            ?.currentStockBase ||
            0
        );

      if (
        actualBaseQty >
        availableBase
      ) {
        return `${
          ingredient
            ?.ingredientName ||
          `Row ${index + 1}`
        }: insufficient stock.`;
      }
    }

    return null;
  };

  const handleSave =
    async () => {
      setError("");
      setMessage("");

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

      try {
        setSaving(true);

        const response =
          await api.post(
            "/production",
            {
              productionDate,

              formulaId:
                Number(
                  formulaId
                ),

              plannedBatchSize:
                Number(
                  plannedBatchSize
                ),

              actualOutputQty:
                Number(
                  actualOutputQty
                ),

              finishedLotNo:
                finishedLotNo
                  .trim(),

              mfgDate:
                mfgDate ||
                null,

              expiryDate:
                expiryDate ||
                null,

              notes:
                notes.trim(),

              ingredients:
                consumption.map(
                  (item) => ({
                    itemId:
                      Number(
                        item.itemId
                      ),

                    /*
                     * User-entered quantity remains
                     * in the formula component unit.
                     *
                     * Backend performs the authoritative
                     * conversion to stock/base unit.
                     */
                    actualQuantity:
                      Number(
                        item.actualQuantity
                      ),

                    lotNo:
                      item.lotNo
                        .trim(),
                  })
                ),
            }
          );

        const production =
          response.data
            .production;

        let successMessage =
          `Production batch ${production.batchNo} saved successfully.`;

        if (
          production
            .totalProductionCost !==
            undefined &&
          production
            .finishedUnitCost !==
            undefined
        ) {
          successMessage +=
            ` Total production cost: ₹${Number(
              production.totalProductionCost
            ).toFixed(
              2
            )}.`;

          successMessage +=
            ` Finished unit cost: ₹${Number(
              production.finishedUnitCost
            ).toFixed(
              2
            )}/${production.finishedBaseUnit || "unit"}.`;
        }

        setMessage(
          successMessage
        );

        setFormulaId(
          ""
        );

        setProductionDate(
          today
        );

        setPlannedBatchSize(
          ""
        );

        setActualOutputQty(
          ""
        );

        setFinishedLotNo(
          ""
        );

        setMfgDate(
          today
        );

        setExpiryDate(
          ""
        );

        setNotes(
          ""
        );

        setCalculation(
          null
        );

        setConsumption(
          []
        );
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data
            ?.message ||
            "Unable to save production batch."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Production Entry
        </h2>

        <p className="text-muted mb-0">
          Manufacture a batch from a saved formula. Stock quantities are automatically converted to each item's base unit.
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

      {/* PRODUCTION HEADER */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label">
                Production Date *
              </label>

              <input
                type="date"
                className="form-control"
                value={
                  productionDate
                }
                onChange={(
                  event
                ) =>
                  setProductionDate(
                    event.target
                      .value
                  )
                }
              />
            </div>

            <div className="col-md-5 mb-3">
              <label className="form-label">
                Formula *
              </label>

              <select
                className="form-select"
                value={
                  formulaId
                }
                onChange={
                  handleFormulaChange
                }
              >
                <option value="">
                  Select Formula
                </option>

                {formulas.map(
                  (formula) => (
                    <option
                      key={
                        formula.id
                      }
                      value={
                        formula.id
                      }
                    >
                      {
                        formula.code
                      }
                      {" - "}
                      {
                        formula.name
                      }
                      {" (V"}
                      {
                        formula.version_no
                      }
                      {")"}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">
                Planned Batch *
              </label>

              <input
                type="number"
                min="0"
                step="0.001"
                className="form-control"
                value={
                  plannedBatchSize
                }
                onChange={(
                  event
                ) => {
                  setPlannedBatchSize(
                    event.target
                      .value
                  );

                  setCalculation(
                    null
                  );

                  setConsumption(
                    []
                  );
                }}
              />
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">
                Unit
              </label>

              <input
                type="text"
                className="form-control"
                value={
                  selectedFormula
                    ?.batch_unit_code ||
                  ""
                }
                disabled
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={
              calculateRequirements
            }
            disabled={
              calculating
            }
          >
            {calculating
              ? "Calculating..."
              : "Calculate Requirements"}
          </button>
        </div>
      </div>

      {calculation && (
        <>
          {/* COMPONENT REQUIREMENTS */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="mb-3">
                <h5 className="mb-1">
                  Component Requirements
                </h5>

                <div className="text-muted">
                  {
                    calculation
                      .formula
                      .finished_item_name
                  }
                  {" — "}
                  {
                    plannedBatchSize
                  }{" "}
                  {
                    calculation
                      .formula
                      .batch_unit_code
                  }
                </div>
              </div>

              <div className="alert alert-light border py-2">
                Formula quantities remain in their selected units. Stock deductions are automatically converted to each item's base stock unit.
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 220 }}>
                        Component
                      </th>

                      <th>
                        Planned
                      </th>

                      <th style={{ minWidth: 130 }}>
                        Actual
                      </th>

                      <th>
                        Formula Unit
                      </th>

                      <th>
                        Stock Deduction
                      </th>

                      <th>
                        Available Stock
                      </th>

                      <th>
                        After Production
                      </th>

                      <th style={{ minWidth: 130 }}>
                        Lot No.
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {calculation
                      .ingredients
                      .map(
                        (
                          ingredient,
                          index
                        ) => {
                          const actualQty =
                            Number(
                              consumption[
                                index
                              ]
                                ?.actualQuantity ||
                                0
                            );

                          const actualBaseQty =
                            getActualBaseQuantity(
                              ingredient,
                              actualQty
                            );

                          const availableBase =
                            Number(
                              ingredient
                                .currentStockBase ||
                                0
                            );

                          const afterBase =
                            availableBase -
                            actualBaseQty;

                          const enoughStock =
                            afterBase >=
                            -0.0000001;

                          return (
                            <tr
                              key={
                                ingredient
                                  .ingredientItemId
                              }
                              className={
                                enoughStock
                                  ? ""
                                  : "table-danger"
                              }
                            >
                              <td>
                                <div className="fw-semibold">
                                  {
                                    ingredient
                                      .ingredientName
                                  }
                                </div>

                                <small className="text-muted">
                                  {
                                    ingredient
                                      .ingredientCode
                                  }
                                </small>
                              </td>

                              <td>
                                <div>
                                  {Number(
                                    ingredient
                                      .requiredQuantity ||
                                      0
                                  ).toFixed(
                                    3
                                  )}{" "}
                                  {
                                    ingredient
                                      .unitCode
                                  }
                                </div>

                                {ingredient
                                  .unitCode !==
                                  ingredient
                                    .baseUnitCode && (
                                  <small className="text-muted">
                                    ={" "}
                                    {Number(
                                      ingredient
                                        .requiredBaseQuantity ||
                                        0
                                    ).toFixed(
                                      3
                                    )}{" "}
                                    {
                                      ingredient
                                        .baseUnitCode
                                    }
                                  </small>
                                )}
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  className="form-control"
                                  value={
                                    consumption[
                                      index
                                    ]
                                      ?.actualQuantity ??
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateConsumption(
                                      index,
                                      "actualQuantity",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                {
                                  ingredient
                                    .unitCode
                                }
                              </td>

                              <td>
                                <strong>
                                  {actualBaseQty.toFixed(
                                    3
                                  )}{" "}
                                  {
                                    ingredient
                                      .baseUnitCode
                                  }
                                </strong>

                                {ingredient
                                  .unitCode !==
                                  ingredient
                                    .baseUnitCode && (
                                  <div>
                                    <small className="text-muted">
                                      from{" "}
                                      {actualQty.toFixed(
                                        3
                                      )}{" "}
                                      {
                                        ingredient
                                          .unitCode
                                      }
                                    </small>
                                  </div>
                                )}
                              </td>

                              <td>
                                {availableBase.toFixed(
                                  3
                                )}{" "}
                                {
                                  ingredient
                                    .baseUnitCode
                                }

                                {ingredient
                                  .unitCode !==
                                  ingredient
                                    .baseUnitCode && (
                                  <div>
                                    <small className="text-muted">
                                      {Number(
                                        ingredient
                                          .currentStock ||
                                          0
                                      ).toFixed(
                                        3
                                      )}{" "}
                                      {
                                        ingredient
                                          .unitCode
                                      }
                                    </small>
                                  </div>
                                )}
                              </td>

                              <td>
                                <span
                                  className={
                                    enoughStock
                                      ? ""
                                      : "text-danger fw-bold"
                                  }
                                >
                                  {afterBase.toFixed(
                                    3
                                  )}{" "}
                                  {
                                    ingredient
                                      .baseUnitCode
                                  }
                                </span>
                              </td>

                              <td>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={
                                    consumption[
                                      index
                                    ]
                                      ?.lotNo ||
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateConsumption(
                                      index,
                                      "lotNo",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>

                              <td>
                                {enoughStock ? (
                                  <span className="badge text-bg-success">
                                    OK
                                  </span>
                                ) : (
                                  <span className="badge text-bg-danger">
                                    Insufficient
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                  </tbody>
                </table>
              </div>

              <div className="text-muted small">
                Component totals are not added together because a formula can contain different units such as L, ML, KG, G and PCS.
              </div>
            </div>
          </div>

          {/* FINISHED BATCH */}
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="mb-3">
                Finished Batch
              </h5>

              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Actual Output *
                  </label>

                  <div className="input-group">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="form-control"
                      value={
                        actualOutputQty
                      }
                      onChange={(
                        event
                      ) =>
                        setActualOutputQty(
                          event
                            .target
                            .value
                        )
                      }
                    />

                    <span className="input-group-text">
                      {
                        calculation
                          .formula
                          .batch_unit_code
                      }
                    </span>
                  </div>
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Finished Lot No.
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={
                      finishedLotNo
                    }
                    onChange={(
                      event
                    ) =>
                      setFinishedLotNo(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Mfg Date
                  </label>

                  <input
                    type="date"
                    className="form-control"
                    value={
                      mfgDate
                    }
                    onChange={(
                      event
                    ) =>
                      setMfgDate(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Expiry Date
                  </label>

                  <input
                    type="date"
                    className="form-control"
                    value={
                      expiryDate
                    }
                    onChange={(
                      event
                    ) =>
                      setExpiryDate(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Theoretical Output
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={`${Number(
                      plannedBatchSize ||
                        0
                    ).toFixed(
                      3
                    )} ${
                      calculation
                        .formula
                        .batch_unit_code
                    }`}
                    disabled
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Yield Difference
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={`${outputDifference.toFixed(
                      3
                    )} ${
                      calculation
                        .formula
                        .batch_unit_code
                    }`}
                    disabled
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Loss %
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={`${outputLossPercent.toFixed(
                      2
                    )}%`}
                    disabled
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">
                    Notes
                  </label>

                  <textarea
                    className="form-control"
                    rows="3"
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {hasInsufficientStock && (
            <div className="alert alert-danger">
              Production cannot be saved because one or more components have insufficient stock.
            </div>
          )}

          <button
            type="button"
            className="btn btn-success"
            onClick={
              handleSave
            }
            disabled={
              saving ||
              hasInsufficientStock
            }
          >
            {saving
              ? "Saving Batch..."
              : "Post Production Batch"}
          </button>
        </>
      )}
    </div>
  );
}

export default Production;