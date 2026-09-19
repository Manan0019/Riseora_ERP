import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/api";

function CustomerLedger() {
  const [customers, setCustomers] =
    useState([]);

  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  const [ledgerData, setLedgerData] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get(
          "/customer-ledger"
        );

      setCustomers(
        response.data.customers || []
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load customer outstanding."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerLedger =
    async (customer) => {
      try {
        setSelectedCustomer(
          customer
        );

        setDetailsLoading(true);
        setError("");

        const response =
          await api.get(
            `/customer-ledger/${customer.customer_id}`
          );

        setLedgerData(
          response.data
        );
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load customer ledger."
        );
      } finally {
        setDetailsLoading(false);
      }
    };

  const filteredCustomers =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return customers;
      }

      return customers.filter(
        (customer) =>
          (
            customer.customer_code ||
            ""
          )
            .toLowerCase()
            .includes(text) ||
          (
            customer.customer_name ||
            ""
          )
            .toLowerCase()
            .includes(text) ||
          (
            customer.phone ||
            ""
          )
            .toLowerCase()
            .includes(text)
      );
    }, [customers, search]);

  const totalOutstanding =
    useMemo(() => {
      return customers.reduce(
        (total, customer) =>
          total +
          Number(
            customer.outstanding ||
              0
          ),
        0
      );
    }, [customers]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">
            Customer Ledger
          </h2>

          <p className="text-muted mb-0">
            Review customer sales, payments and outstanding balances.
          </p>
        </div>

        <div className="text-end">
          <div className="text-muted small">
            Total Outstanding
          </div>

          <div className="fw-bold fs-5">
            ₹
            {totalOutstanding.toFixed(
              2
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Customers
            </h5>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={
                loadCustomers
              }
              disabled={
                loading
              }
            >
              Refresh
            </button>
          </div>

          <input
            type="text"
            className="form-control mb-3"
            placeholder="Search customer code, name or phone..."
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
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Total Sales</th>
                  <th>Total Paid</th>
                  <th>Outstanding</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center text-muted"
                    >
                      Loading customers...
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredCustomers.map(
                      (customer) => (
                        <tr
                          key={
                            customer.customer_id
                          }
                          onClick={() =>
                            loadCustomerLedger(
                              customer
                            )
                          }
                          style={{
                            cursor:
                              "pointer",
                          }}
                          className={
                            selectedCustomer?.customer_id ===
                            customer.customer_id
                              ? "table-primary"
                              : ""
                          }
                        >
                          <td>
                            {
                              customer.customer_code
                            }
                          </td>

                          <td>
                            {
                              customer.customer_name
                            }
                          </td>

                          <td>
                            {
                              customer.customer_type
                            }
                          </td>

                          <td>
                            {customer.phone ||
                              "-"}
                          </td>

                          <td>
                            ₹
                            {Number(
                              customer.total_sales ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td>
                            ₹
                            {Number(
                              customer.total_paid ||
                                0
                            ).toFixed(
                              2
                            )}
                          </td>

                          <td>
                            <strong>
                              ₹
                              {Number(
                                customer.outstanding ||
                                  0
                              ).toFixed(
                                2
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}

                    {filteredCustomers.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center text-muted"
                        >
                          No customers found.
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

      {selectedCustomer && (
        <div className="card">
          <div className="card-body">
            {detailsLoading ? (
              <p>
                Loading customer ledger...
              </p>
            ) : ledgerData ? (
              <>
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <div>
                    <h5 className="mb-1">
                      {
                        ledgerData.customer.name
                      }
                    </h5>

                    <div className="text-muted">
                      {
                        ledgerData.customer.code
                      }
                      {" • "}
                      {
                        ledgerData.customer.customer_type
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
                  <div className="col-md-4">
                    <div className="border rounded p-3">
                      <div className="text-muted">
                        Total Sales
                      </div>

                      <strong>
                        ₹
                        {Number(
                          ledgerData.summary.totalSales ||
                            0
                        ).toFixed(
                          2
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="col-md-4">
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

                  <div className="col-md-4">
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
                  Customer Ledger
                </h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerData.ledger.map(
                        (
                          transaction
                        ) => (
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
                              "INVOICE" ? (
                                <span className="badge text-bg-primary">
                                  Invoice
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
                            No customer transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h6>
                  Invoice Summary
                </h6>

                <div className="table-responsive mb-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>
                          Invoice
                        </th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerData.invoices.map(
                        (invoice) => {
                          const balance =
                            invoice.status ===
                            "POSTED"
                              ? Number(
                                  invoice.grand_total ||
                                    0
                                ) -
                                Number(
                                  invoice.amount_paid ||
                                    0
                                )
                              : 0;

                          return (
                            <tr
                              key={
                                invoice.id
                              }
                              className={
                                invoice.status ===
                                "CANCELLED"
                                  ? "table-secondary"
                                  : ""
                              }
                            >
                              <td>
                                {
                                  invoice.invoice_no
                                }
                              </td>

                              <td>
                                {
                                  invoice.invoice_date
                                }
                              </td>

                              <td>
                                ₹
                                {Number(
                                  invoice.grand_total ||
                                    0
                                ).toFixed(
                                  2
                                )}
                              </td>

                              <td>
                                ₹
                                {Number(
                                  invoice.amount_paid ||
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
                                  invoice.status
                                }
                                {" / "}
                                {
                                  invoice.payment_status
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

                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Invoice</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>
                          Reference
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledgerData.payments.map(
                        (
                          payment
                        ) => (
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
                                payment.invoice_no
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
                            No payments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerLedger;