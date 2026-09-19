import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";

function SupplierLedger() {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: today,
    amount: "",
    paymentMode: "CASH",
    referenceNo: "",
    notes: "",
  });

  const [savingPayment, setSavingPayment] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get("/supplier-ledger");

      setSuppliers(
        response.data.suppliers || []
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load supplier outstanding."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierLedger =
    async (supplier) => {
      try {
        setSelectedSupplier(supplier);
        setDetailsLoading(true);
        setError("");
        setMessage("");

        const response =
          await api.get(
            `/supplier-ledger/${supplier.supplier_id}`
          );

        setLedgerData(
          response.data
        );

        setSelectedPurchaseId("");

        setPaymentForm({
          paymentDate: today,
          amount: "",
          paymentMode: "CASH",
          referenceNo: "",
          notes: "",
        });
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load supplier ledger."
        );
      } finally {
        setDetailsLoading(false);
      }
    };

  const filteredSuppliers =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return suppliers;
      }

      return suppliers.filter(
        (supplier) =>
          (
            supplier.supplier_code ||
            ""
          )
            .toLowerCase()
            .includes(text) ||
          (
            supplier.supplier_name ||
            ""
          )
            .toLowerCase()
            .includes(text) ||
          (
            supplier.phone ||
            ""
          )
            .toLowerCase()
            .includes(text)
      );
    }, [suppliers, search]);

  const totalOutstanding =
    useMemo(() => {
      return suppliers.reduce(
        (total, supplier) =>
          total +
          Number(
            supplier.outstanding ||
              0
          ),
        0
      );
    }, [suppliers]);

  const openPurchases =
    useMemo(() => {
      if (!ledgerData) {
        return [];
      }

      return ledgerData.purchases.filter(
        (purchase) =>
          purchase.status === "POSTED" &&
          Number(
            purchase.grand_total ||
              0
          ) -
            Number(
              purchase.amount_paid ||
                0
            ) >
            0
      );
    }, [ledgerData]);

  const selectedPurchase =
    useMemo(() => {
      if (!ledgerData || !selectedPurchaseId) {
        return null;
      }

      return ledgerData.purchases.find(
        (purchase) =>
          purchase.id ===
          Number(selectedPurchaseId)
      );
    }, [
      ledgerData,
      selectedPurchaseId,
    ]);

  const selectedPurchaseBalance =
    selectedPurchase
      ? Number(
          selectedPurchase.grand_total ||
            0
        ) -
        Number(
          selectedPurchase.amount_paid ||
            0
        )
      : 0;

  const handlePaymentChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setPaymentForm(
        (current) => ({
          ...current,
          [name]: value,
        })
      );
    };

  const savePayment =
    async () => {
      if (!selectedSupplier) {
        return;
      }

      if (!selectedPurchaseId) {
        setError(
          "Please select a purchase."
        );
        return;
      }

      const amount =
        Number(
          paymentForm.amount
        );

      if (amount <= 0) {
        setError(
          "Payment amount must be greater than zero."
        );
        return;
      }

      if (
        amount >
        selectedPurchaseBalance
      ) {
        setError(
          `Payment cannot exceed outstanding balance of ₹${selectedPurchaseBalance.toFixed(
            2
          )}.`
        );
        return;
      }

      try {
        setSavingPayment(true);
        setError("");
        setMessage("");

        await api.post(
          `/supplier-ledger/purchase/${selectedPurchaseId}/payments`,
          {
            paymentDate:
              paymentForm.paymentDate,

            amount,

            paymentMode:
              paymentForm.paymentMode,

            referenceNo:
              paymentForm.referenceNo.trim(),

            notes:
              paymentForm.notes.trim(),
          }
        );

        setMessage(
          "Supplier payment recorded successfully."
        );

        await loadSuppliers();

        await loadSupplierLedger(
          selectedSupplier
        );
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data?.message ||
            "Unable to record supplier payment."
        );
      } finally {
        setSavingPayment(false);
      }
    };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">
            Supplier Ledger
          </h2>

          <p className="text-muted mb-0">
            Review purchase liabilities and supplier payments.
          </p>
        </div>

        <div className="text-end">
          <div className="text-muted small">
            Total Supplier Outstanding
          </div>

          <div className="fw-bold fs-5">
            ₹
            {totalOutstanding.toFixed(
              2
            )}
          </div>
        </div>
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
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Suppliers
            </h5>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={loadSuppliers}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          <input
            type="text"
            className="form-control mb-3"
            placeholder="Search supplier code, name or phone..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Code</th>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>Total Purchases</th>
                  <th>Total Paid</th>
                  <th>Outstanding</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-muted"
                    >
                      Loading suppliers...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredSuppliers.map(
                      (supplier) => (
                        <tr
                          key={
                            supplier.supplier_id
                          }
                          onClick={() =>
                            loadSupplierLedger(
                              supplier
                            )
                          }
                          style={{
                            cursor:
                              "pointer",
                          }}
                          className={
                            selectedSupplier?.supplier_id ===
                            supplier.supplier_id
                              ? "table-primary"
                              : ""
                          }
                        >
                          <td>
                            {
                              supplier.supplier_code
                            }
                          </td>

                          <td>
                            {
                              supplier.supplier_name
                            }
                          </td>

                          <td>
                            {supplier.phone ||
                              "-"}
                          </td>

                          <td>
                            ₹
                            {Number(
                              supplier.total_purchases ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td>
                            ₹
                            {Number(
                              supplier.total_paid ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td>
                            <strong>
                              ₹
                              {Number(
                                supplier.outstanding ||
                                  0
                              ).toFixed(
                                2
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}

                    {filteredSuppliers.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-muted"
                        >
                          No suppliers found.
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

      {selectedSupplier && (
        <div className="card">
          <div className="card-body">
            {detailsLoading ? (
              <p>
                Loading supplier ledger...
              </p>
            ) : ledgerData ? (
              <>
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <div>
                    <h5 className="mb-1">
                      {
                        ledgerData.supplier.name
                      }
                    </h5>

                    <div className="text-muted">
                      {
                        ledgerData.supplier.code
                      }
                    </div>
                  </div>

                  <div className="text-end">
                    <div className="text-muted small">
                      Outstanding
                    </div>

                    <div className="fw-bold fs-5">
                      ₹
                      {Number(
                        ledgerData.summary.outstanding ||
                          0
                      ).toFixed(
                        2
                      )}
                    </div>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-md-4 mb-3">
                    <div className="border rounded p-3">
                      <div className="text-muted">
                        Total Purchases
                      </div>

                      <strong>
                        ₹
                        {Number(
                          ledgerData.summary.totalPurchases ||
                            0
                        ).toFixed(
                          2
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="col-md-4 mb-3">
                    <div className="border rounded p-3">
                      <div className="text-muted">
                        Total Paid
                      </div>

                      <strong>
                        ₹
                        {Number(
                          ledgerData.summary.totalPaid ||
                            0
                        ).toFixed(
                          2
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="col-md-4 mb-3">
                    <div className="border rounded p-3">
                      <div className="text-muted">
                        Outstanding
                      </div>

                      <strong>
                        ₹
                        {Number(
                          ledgerData.summary.outstanding ||
                            0
                        ).toFixed(
                          2
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <h6>
                  Supplier Ledger
                </h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Purchase</th>
                        <th>Payment</th>
                        <th>Balance</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerData.ledger.map(
                        (transaction) => (
                          <tr
                            key={
                              transaction.id
                            }
                          >
                            <td>
                              {
                                transaction.transactionDate
                              }
                            </td>

                            <td>
                              {transaction.transactionType ===
                              "PURCHASE" ? (
                                <span className="badge text-bg-primary">
                                  Purchase
                                </span>
                              ) : (
                                <span className="badge text-bg-success">
                                  Payment
                                </span>
                              )}
                            </td>

                            <td>
                              {
                                transaction.referenceNo
                              }
                            </td>

                            <td>
                              {Number(
                                transaction.credit ||
                                  0
                              ) >
                              0
                                ? `₹${Number(
                                    transaction.credit
                                  ).toFixed(
                                    2
                                  )}`
                                : "-"}
                            </td>

                            <td>
                              {Number(
                                transaction.debit ||
                                  0
                              ) >
                              0
                                ? `₹${Number(
                                    transaction.debit
                                  ).toFixed(
                                    2
                                  )}`
                                : "-"}
                            </td>

                            <td>
                              <strong>
                                ₹
                                {Number(
                                  transaction.balance ||
                                    0
                                ).toFixed(
                                  2
                                )}
                              </strong>
                            </td>
                          </tr>
                        )
                      )}

                      {ledgerData.ledger.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-muted"
                          >
                            No supplier transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h6>
                  Purchase Summary
                </h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>
                          Purchase
                        </th>

                        <th>Date</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerData.purchases.map(
                        (purchase) => {
                          const balance =
                            purchase.status ===
                            "POSTED"
                              ? Number(
                                  purchase.grand_total ||
                                    0
                                ) -
                                Number(
                                  purchase.amount_paid ||
                                    0
                                )
                              : 0;

                          return (
                            <tr
                              key={
                                purchase.id
                              }
                              className={
                                purchase.status ===
                                "CANCELLED"
                                  ? "table-secondary"
                                  : ""
                              }
                            >
                              <td>
                                {
                                  purchase.purchase_no
                                }
                              </td>

                              <td>
                                {
                                  purchase.purchase_date
                                }
                              </td>

                              <td>
                                ₹
                                {Number(
                                  purchase.grand_total ||
                                    0
                                ).toFixed(
                                  2
                                )}
                              </td>

                              <td>
                                ₹
                                {Number(
                                  purchase.amount_paid ||
                                    0
                                ).toFixed(
                                  2
                                )}
                              </td>

                              <td>
                                ₹
                                {balance.toFixed(
                                  2
                                )}
                              </td>

                              <td>
                                {
                                  purchase.status
                                }
                                {" / "}
                                {
                                  purchase.payment_status
                                }
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                <h6>
                  Payment History
                </h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Purchase</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Reference</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerData.payments.map(
                        (payment) => (
                          <tr
                            key={
                              payment.id
                            }
                          >
                            <td>
                              {
                                payment.payment_date
                              }
                            </td>

                            <td>
                              {
                                payment.purchase_no
                              }
                            </td>

                            <td>
                              ₹
                              {Number(
                                payment.amount ||
                                  0
                              ).toFixed(
                                2
                              )}
                            </td>

                            <td>
                              {
                                payment.payment_mode
                              }
                            </td>

                            <td>
                              {payment.reference_no ||
                                "-"}
                            </td>
                          </tr>
                        )
                      )}

                      {ledgerData.payments.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center text-muted"
                          >
                            No supplier payments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {openPurchases.length >
                  0 && (
                  <div className="border rounded p-3">
                    <h6 className="mb-3">
                      Record Supplier Payment
                    </h6>

                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <label className="form-label">
                          Purchase *
                        </label>

                        <select
                          className="form-select"
                          value={
                            selectedPurchaseId
                          }
                          onChange={(event) => {
                            setSelectedPurchaseId(
                              event.target.value
                            );

                            setPaymentForm(
                              (current) => ({
                                ...current,
                                amount: "",
                              })
                            );
                          }}
                        >
                          <option value="">
                            Select Purchase
                          </option>

                          {openPurchases.map(
                            (purchase) => {
                              const balance =
                                Number(
                                  purchase.grand_total ||
                                    0
                                ) -
                                Number(
                                  purchase.amount_paid ||
                                    0
                                );

                              return (
                                <option
                                  key={
                                    purchase.id
                                  }
                                  value={
                                    purchase.id
                                  }
                                >
                                  {
                                    purchase.purchase_no
                                  }{" "}
                                  - Balance ₹
                                  {balance.toFixed(
                                    2
                                  )}
                                </option>
                              );
                            }
                          )}
                        </select>
                      </div>

                      <div className="col-md-2 mb-3">
                        <label className="form-label">
                          Balance
                        </label>

                        <input
                          className="form-control"
                          value={
                            selectedPurchase
                              ? `₹${selectedPurchaseBalance.toFixed(
                                  2
                                )}`
                              : ""
                          }
                          disabled
                        />
                      </div>

                      <div className="col-md-3 mb-3">
                        <label className="form-label">
                          Payment Date *
                        </label>

                        <input
                          type="date"
                          className="form-control"
                          name="paymentDate"
                          value={
                            paymentForm.paymentDate
                          }
                          onChange={
                            handlePaymentChange
                          }
                        />
                      </div>

                      <div className="col-md-3 mb-3">
                        <label className="form-label">
                          Amount *
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          name="amount"
                          value={
                            paymentForm.amount
                          }
                          onChange={
                            handlePaymentChange
                          }
                        />
                      </div>

                      <div className="col-md-3 mb-3">
                        <label className="form-label">
                          Payment Mode
                        </label>

                        <select
                          className="form-select"
                          name="paymentMode"
                          value={
                            paymentForm.paymentMode
                          }
                          onChange={
                            handlePaymentChange
                          }
                        >
                          <option value="CASH">
                            Cash
                          </option>

                          <option value="UPI">
                            UPI
                          </option>

                          <option value="BANK">
                            Bank Transfer
                          </option>

                          <option value="CARD">
                            Card
                          </option>

                          <option value="CHEQUE">
                            Cheque
                          </option>
                        </select>
                      </div>

                      <div className="col-md-3 mb-3">
                        <label className="form-label">
                          Reference
                        </label>

                        <input
                          className="form-control"
                          name="referenceNo"
                          value={
                            paymentForm.referenceNo
                          }
                          onChange={
                            handlePaymentChange
                          }
                        />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">
                          Notes
                        </label>

                        <input
                          className="form-control"
                          name="notes"
                          value={
                            paymentForm.notes
                          }
                          onChange={
                            handlePaymentChange
                          }
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={savePayment}
                      disabled={
                        savingPayment
                      }
                    >
                      {savingPayment
                        ? "Saving..."
                        : "Record Payment"}
                    </button>
                  </div>
                )}

                {openPurchases.length ===
                  0 &&
                  Number(
                    ledgerData.summary.outstanding ||
                      0
                  ) ===
                    0 && (
                    <div className="alert alert-success mb-0">
                      No supplier payment is outstanding.
                    </div>
                  )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierLedger;