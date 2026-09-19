import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

function Production() {
  const today = new Date().toISOString().slice(0, 10);

  const [formulas, setFormulas] = useState([]);
  const [formulaId, setFormulaId] = useState("");
  const [productionDate, setProductionDate] = useState(today);

  const [plannedBatchSize, setPlannedBatchSize] = useState("");
  const [actualOutputQty, setActualOutputQty] = useState("");

  const [finishedLotNo, setFinishedLotNo] = useState("");
  const [mfgDate, setMfgDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState("");

  const [notes, setNotes] = useState("");

  const [calculation, setCalculation] = useState(null);
  const [consumption, setConsumption] = useState([]);

  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadFormulas();
  }, []);

  const loadFormulas = async () => {
    try {
      setError("");

      const response = await api.get("/formulas");

      setFormulas(
        response.data.formulas || []
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load formulas."
      );
    }
  };

  const selectedFormula = useMemo(() => {
    return formulas.find(
      (formula) =>
        formula.id === Number(formulaId)
    );
  }, [formulas, formulaId]);

  const handleFormulaChange = (
    event
  ) => {
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
          item.id === Number(value)
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
      setPlannedBatchSize("");
      setActualOutputQty("");
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
        setCalculating(true);

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
          response.data.calculation;

        setCalculation(result);

        setConsumption(
          result.ingredients.map(
            (ingredient) => ({
              itemId:
                ingredient.ingredientItemId,

              actualQuantity:
                ingredient.requiredQuantity,

              lotNo: "",

              unitCost: "",
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

        setCalculation(null);
        setConsumption([]);

        setError(
          err.response?.data?.message ||
            "Unable to calculate production requirements."
        );
      } finally {
        setCalculating(false);
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

  const hasInsufficientStock =
    useMemo(() => {
      if (!calculation) {
        return false;
      }

      return calculation.ingredients.some(
        (
          ingredient,
          index
        ) => {
          const actualQuantity =
            Number(
              consumption[
                index
              ]
                ?.actualQuantity ||
                0
            );

          return (
            actualQuantity >
            Number(
              ingredient.currentStock ||
                0
            )
          );
        }
      );
    }, [
      calculation,
      consumption,
    ]);

  const totalPlannedConsumption =
    useMemo(() => {
      if (!calculation) {
        return 0;
      }

      return calculation.ingredients.reduce(
        (
          total,
          ingredient
        ) =>
          total +
          Number(
            ingredient.requiredQuantity ||
              0
          ),
        0
      );
    }, [calculation]);

  const totalActualConsumption =
    useMemo(() => {
      return consumption.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.actualQuantity ||
              0
          ),
        0
      );
    }, [consumption]);

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
      ? (outputDifference /
          Number(
            plannedBatchSize
          )) *
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
      return "Calculate ingredient requirements before saving.";
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

      if (
        Number(
          line.actualQuantity
        ) <= 0
      ) {
        return `Actual consumption must be greater than zero in row ${
          index + 1
        }.`;
      }

      const availableStock =
        Number(
          calculation
            .ingredients[
            index
          ]?.currentStock ||
            0
        );

      if (
        Number(
          line.actualQuantity
        ) >
        availableStock
      ) {
        return `Insufficient stock in row ${
          index + 1
        }.`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    setError("");
    setMessage("");

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
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
              finishedLotNo.trim(),

            mfgDate:
              mfgDate || null,

            expiryDate:
              expiryDate || null,

            notes:
              notes.trim(),

            ingredients:
              consumption.map(
                (item) => ({
                  itemId:
                    Number(
                      item.itemId
                    ),

                  actualQuantity:
                    Number(
                      item.actualQuantity
                    ),

                  lotNo:
                    item.lotNo.trim(),

                  unitCost:
                    Number(
                      item.unitCost ||
                        0
                    ),
                })
              ),
          }
        );

      setMessage(
        `Production batch ${response.data.production.batchNo} saved successfully.`
      );

      setFormulaId("");
      setProductionDate(today);
      setPlannedBatchSize("");
      setActualOutputQty("");
      setFinishedLotNo("");
      setMfgDate(today);
      setExpiryDate("");
      setNotes("");
      setCalculation(null);
      setConsumption([]);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Unable to save production batch."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Production Entry
        </h2>

        <p className="text-muted mb-0">
          Manufacture a batch from a saved formula.
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
                      }{" "}
                      -{" "}
                      {
                        formula.name
                      }{" "}
                      (V
                      {
                        formula.version_no
                      })
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
                  selectedFormula?.batch_unit_code ||
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
          <div className="card mb-4">
            <div className="card-body">
              <div className="mb-3">
                <h5 className="mb-1">
                  Ingredient Requirements
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

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>
                        Ingredient
                      </th>

                      <th>
                        Planned Qty
                      </th>

                      <th>
                        Actual Qty
                      </th>

                      <th>
                        Unit
                      </th>

                      <th>
                        Available
                      </th>

                      <th>
                        After Production
                      </th>

                      <th>
                        Lot No.
                      </th>

                      <th>
                        Unit Cost
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {calculation.ingredients.map(
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

                        const afterStock =
                          Number(
                            ingredient.currentStock ||
                              0
                          ) -
                          actualQty;

                        const enoughStock =
                          afterStock >=
                          0;

                        return (
                          <tr
                            key={
                              ingredient.ingredientItemId
                            }
                            className={
                              enoughStock
                                ? ""
                                : "table-danger"
                            }
                          >
                            <td>
                              {
                                ingredient.ingredientCode
                              }{" "}
                              -{" "}
                              {
                                ingredient.ingredientName
                              }
                            </td>

                            <td>
                              {Number(
                                ingredient.requiredQuantity
                              ).toFixed(
                                3
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
                                ingredient.unitCode
                              }
                            </td>

                            <td>
                              {Number(
                                ingredient.currentStock
                              ).toFixed(
                                3
                              )}
                            </td>

                            <td>
                              {afterStock.toFixed(
                                3
                              )}
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
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                value={
                                  consumption[
                                    index
                                  ]
                                    ?.unitCost ||
                                  ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateConsumption(
                                    index,
                                    "unitCost",
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
                Planned ingredient total:{" "}
                {totalPlannedConsumption.toFixed(
                  3
                )}
                {" | "}
                Actual ingredient total:{" "}
                {totalActualConsumption.toFixed(
                  3
                )}
              </div>
            </div>
          </div>

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
                        event
                          .target
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
                        event
                          .target
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
                        event
                          .target
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
                    value={outputDifference.toFixed(
                      3
                    )}
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
                        event
                          .target
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
              Production cannot be saved because one or more ingredients have insufficient stock.
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