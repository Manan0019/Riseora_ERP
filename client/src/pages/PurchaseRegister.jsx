import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";

function PurchaseRegister() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadPurchases(); }, []);

  async function loadPurchases() {
    try {
      setLoading(true); setError("");
      const response = await api.get("/purchases");
      setPurchases(response.data.purchases);
    } catch (err) {
      console.error(err); setError("Unable to load purchase register.");
    } finally { setLoading(false); }
  }

  async function loadPurchaseDetails(id) {
    try {
      setDetailsLoading(true); setError("");
      const response = await api.get(`/purchases/${id}`);
      setSelectedPurchase(response.data.purchase);
    } catch (err) {
      console.error(err); setError("Unable to load purchase details.");
    } finally { setDetailsLoading(false); }
  }

  const filteredPurchases = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return purchases;
    return purchases.filter((purchase) =>
      [purchase.purchase_no, purchase.supplier_name, purchase.supplier_invoice_no, purchase.payment_account]
        .some((value) => String(value || "").toLowerCase().includes(text)),
    );
  }, [purchases, search]);

  async function handleCancelPurchase() {
    if (!selectedPurchase || selectedPurchase.status === "CANCELLED") return;
    const confirmed = await confirmAction({
      title: "Cancel purchase?",
      message: `${selectedPurchase.purchase_no} will be cancelled and its inventory receipt will be reversed.`,
      detail: "This is only allowed when payment and downstream stock safety checks pass.",
      confirmLabel: "Cancel Purchase",
      cancelLabel: "Keep Purchase",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.patch(`/purchases/${selectedPurchase.id}/cancel`);
      toastSuccess(`${selectedPurchase.purchase_no} cancelled successfully.`, "Purchase cancelled");
      setSelectedPurchase(null);
      await loadPurchases();
    } catch (err) {
      const message = err.response?.data?.message || "Unable to cancel purchase.";
      setError(message); toastError(message, "Purchase cancellation failed");
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4"><div><h2 className="mb-1">Purchase Register</h2><p className="text-muted mb-0">Review supplier invoices and payment references.</p></div><button type="button" className="btn btn-outline-primary" onClick={loadPurchases} disabled={loading}>Refresh</button></div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card mb-4"><div className="card-body">
        <input type="text" className="form-control mb-3" placeholder="Search purchase no, supplier, invoice or payment account..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="table-responsive"><table className="table table-bordered table-hover align-middle">
          <thead className="table-light"><tr><th>Purchase No</th><th>Invoice Date</th><th>Due Date</th><th>Supplier</th><th>Supplier Invoice</th><th>Payment Date</th><th>Payment Account</th><th>Grand Total</th><th>Status</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={9} className="text-center text-muted">Loading purchases...</td></tr> : <>{filteredPurchases.map((purchase) => <tr key={purchase.id} onClick={() => loadPurchaseDetails(purchase.id)} className={purchase.status === "CANCELLED" ? "table-secondary row-clickable" : "row-clickable"}><td>{purchase.purchase_no}</td><td>{purchase.purchase_date}</td><td>{purchase.due_date || "-"}</td><td>{purchase.supplier_name}</td><td>{purchase.supplier_invoice_no || "-"}</td><td>{purchase.payment_date || "-"}</td><td>{purchase.payment_account || "-"}</td><td>₹{Number(purchase.grand_total).toFixed(2)}</td><td>{purchase.status === "CANCELLED" ? <span className="badge text-bg-danger">Cancelled</span> : <span className="badge text-bg-success">Posted</span>}</td></tr>)}{filteredPurchases.length === 0 && <tr><td colSpan={9} className="text-center text-muted">No purchases found.</td></tr>}</>}</tbody>
        </table></div>
      </div></div>

      {selectedPurchase && <div className="card"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Purchase Details</h5>{selectedPurchase.status !== "CANCELLED" && <button type="button" className="btn btn-outline-danger" onClick={handleCancelPurchase}>Cancel Purchase</button>}</div>
        {detailsLoading ? <p>Loading details...</p> : <>
          <div className="row mb-3"><div className="col-md-3"><strong>Purchase No</strong><div>{selectedPurchase.purchase_no}</div></div><div className="col-md-3"><strong>Supplier</strong><div>{selectedPurchase.supplier_name}</div></div><div className="col-md-2"><strong>Invoice Date</strong><div>{selectedPurchase.purchase_date}</div></div><div className="col-md-2"><strong>Payment Date</strong><div>{selectedPurchase.payment_date || "-"}</div></div><div className="col-md-2"><strong>Total</strong><div>₹{Number(selectedPurchase.grand_total).toFixed(2)}</div></div></div>
          <div className="mb-3"><strong>Payment Account:</strong> {selectedPurchase.payment_account || "-"}</div>
          <div className="table-responsive"><table className="table table-bordered"><thead className="table-light"><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>GST %</th><th>Lot</th><th>Expiry</th><th>Total</th></tr></thead><tbody>{selectedPurchase.items.map((item) => <tr key={item.id}><td>{item.item_code} - {item.item_name}</td><td>{item.quantity}</td><td>{item.unit_code}</td><td>₹{Number(item.rate).toFixed(2)}</td><td>{item.gst_rate}</td><td>{item.lot_no || "-"}</td><td>{item.expiry_date || "-"}</td><td>₹{Number(item.line_total).toFixed(2)}</td></tr>)}</tbody></table></div>
        </>}
      </div></div>}
    </div>
  );
}

export default PurchaseRegister;
