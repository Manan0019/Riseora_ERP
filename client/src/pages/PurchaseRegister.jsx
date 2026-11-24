import PostedAmendments from "../components/PostedAmendments.jsx";
import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useUi } from "../context/UiContext";
import MasterEditorModal from "../components/MasterEditorModal";
import SortableTh, { useSortableRows } from "../components/SortableTh";
import Purchases from "./Purchases";

function PurchaseRegister() {
  const { confirm: confirmAction, success: toastSuccess, error: toastError } = useUi();
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [editing, setEditing] = useState(false);
  const [duplicating,setDuplicating] = useState(null);
  const { search: routeSearch } = useLocation();
  const [search, setSearch] = useState(() => new URLSearchParams(routeSearch).get("find") || "");
  useEffect(() => { const value = new URLSearchParams(routeSearch).get("find"); if(value !== null) setSearch(value); }, [routeSearch]);
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
      setEditing(false);
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

  const { sortedRows: sortedPurchases, sort, toggle } = useSortableRows(filteredPurchases, "purchase_date", "desc");

  async function handleSaved() {
    setSelectedPurchase(null);
    setEditing(false);
    await loadPurchases();
  }

  async function closeDetails() {
    if (editing) {
      const discard = await confirmAction({
        title: "Discard unsaved purchase edits?",
        message: "Any changes in the correction form that have not been saved will be lost.",
        confirmLabel: "Discard Changes",
        cancelLabel: "Continue Editing",
        variant: "warning",
      });
      if (!discard) return;
      setEditing(false);
    } else {
      setSelectedPurchase(null);
    }
  }

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
          <thead className="table-light"><tr><SortableTh field="purchase_no" sort={sort} onSort={toggle}>Purchase No</SortableTh><SortableTh field="purchase_date" sort={sort} onSort={toggle}>Invoice Date</SortableTh><SortableTh field="due_date" sort={sort} onSort={toggle}>Due Date</SortableTh><SortableTh field="supplier_name" sort={sort} onSort={toggle}>Supplier</SortableTh><SortableTh field="supplier_invoice_no" sort={sort} onSort={toggle}>Supplier Invoice</SortableTh><SortableTh field="payment_date" sort={sort} onSort={toggle}>Payment Date</SortableTh><SortableTh field="payment_account" sort={sort} onSort={toggle}>Payment Account</SortableTh><SortableTh field="grand_total" sort={sort} onSort={toggle}>Grand Total</SortableTh><SortableTh field="status" sort={sort} onSort={toggle}>Status</SortableTh></tr></thead>
          <tbody>{loading ? <tr><td colSpan={9} className="text-center text-muted">Loading purchases...</td></tr> : <>{sortedPurchases.map((purchase) => <tr key={purchase.id} onClick={() => loadPurchaseDetails(purchase.id)} className={purchase.status === "CANCELLED" ? "table-secondary row-clickable" : "row-clickable"}><td>{purchase.purchase_no}</td><td>{purchase.purchase_date}</td><td>{purchase.due_date || "-"}</td><td>{purchase.supplier_name}</td><td>{purchase.supplier_invoice_no || "-"}</td><td>{purchase.payment_date || "-"}</td><td>{purchase.payment_account || "-"}</td><td>₹{Number(purchase.grand_total).toFixed(2)}</td><td>{purchase.status === "CANCELLED" ? <span className="badge text-bg-danger">Cancelled</span> : <span className="badge text-bg-success">Posted</span>}</td></tr>)}{filteredPurchases.length === 0 && <tr><td colSpan={9} className="text-center text-muted">No purchases found.</td></tr>}</>}</tbody>
        </table></div>
      </div></div>

      <MasterEditorModal open={Boolean(duplicating)} size="xl" title="Duplicate purchase — new entry" onRequestClose={()=>setDuplicating(null)}>
        {duplicating && <Purchases key={`copy-${duplicating.id}`} embedded copyFrom={duplicating} onSaved={async()=>{setDuplicating(null);await loadPurchases();}}/>}
      </MasterEditorModal>
      <MasterEditorModal
        open={Boolean(selectedPurchase)}
        size="xl"
        title={selectedPurchase ? `${editing ? "Correct" : "Purchase Details"} — ${selectedPurchase.purchase_no}` : "Purchase Details"}
        onRequestClose={closeDetails}
        footer={<div className="d-flex justify-content-end gap-2 w-100">
          {editing ? <button type="button" className="btn btn-outline-secondary" onClick={closeDetails}>Back to Details</button> : <>
            {selectedPurchase?.status === "POSTED" && <button type="button" className="btn btn-outline-primary" onClick={()=>{setDuplicating(selectedPurchase);setSelectedPurchase(null);}}>Duplicate as New</button>}
            {selectedPurchase?.status === "POSTED" && Number(selectedPurchase.amount_paid || 0) === 0 && <button type="button" className="btn btn-outline-primary" onClick={() => setEditing(true)}>Edit Purchase</button>}
            {selectedPurchase?.status === "POSTED" && <button type="button" className="btn btn-outline-danger" onClick={handleCancelPurchase}>Cancel Purchase</button>}
            <button type="button" className="btn btn-primary" onClick={() => setSelectedPurchase(null)}>Close</button>
          </>}
        </div>}
      >
        {detailsLoading && <p className="text-muted">Loading purchase details...</p>}
        {selectedPurchase && (editing ?
          <Purchases key={selectedPurchase.id} embedded initialPurchase={selectedPurchase} onSaved={handleSaved} /> :
          <>
            <div className="row g-2 mb-3">
              <div className="col-md-3"><strong>Supplier</strong><div>{selectedPurchase.supplier_name}</div></div>
              <div className="col-md-3"><strong>Invoice Date</strong><div>{selectedPurchase.purchase_date}</div></div>
              <div className="col-md-3"><strong>Supplier Invoice</strong><div>{selectedPurchase.supplier_invoice_no || "–"}</div></div>
              <div className="col-md-3"><strong>Payment Account</strong><div>{selectedPurchase.payment_account || "–"}</div></div>
              <div className="col-md-4"><strong>Payment Date</strong><div>{selectedPurchase.payment_date || "–"}</div></div>
              <div className="col-md-4"><strong>Due Date</strong><div>{selectedPurchase.due_date || "–"}</div></div>
              <div className="col-md-4"><strong>Grand Total</strong><div>₹{Number(selectedPurchase.grand_total).toFixed(2)}</div></div>
            </div>
            {Number(selectedPurchase.amount_paid || 0) > 0 && <p className="alert alert-warning">This purchase has payment history. Financial lines are locked; reference and notes can still be corrected below.</p>}
            <div className="table-responsive"><table className="table table-bordered align-middle">
              <thead className="table-light"><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Taxable</th><th>GST %</th><th>GST Amount</th><th>Total</th><th>Lot</th><th>Expiry</th></tr></thead>
              <tbody>{selectedPurchase.items?.map((line) => <tr key={line.id}>
                <td>{line.item_name}</td><td>{line.hsn_code || "–"}</td><td>{line.entry_quantity ?? line.quantity}</td><td>{line.entry_unit_code || line.unit_code}</td>
                <td>₹{Number(line.entry_rate ?? line.rate).toFixed(2)}</td><td>₹{Number(line.taxable_amount).toFixed(2)}</td>
                <td>{Number(line.gst_rate).toFixed(2)}%</td><td>₹{Number(line.gst_amount).toFixed(2)}</td><td>₹{Number(line.line_total).toFixed(2)}</td>
                <td>{line.lot_no || "–"}</td><td>{line.expiry_date || "–"}</td>
              </tr>)}</tbody>
            </table></div>
            <PostedAmendments key={selectedPurchase.id} kind="purchase" record={selectedPurchase} onSaved={async()=>{await loadPurchaseDetails(selectedPurchase.id);await loadPurchases();}}/>
            <p className="text-muted small mb-0">Changes to historical receipts are blocked when payments or later stock movements depend on them.</p>
          </>)}
      </MasterEditorModal>
    </div>
  );
}

export default PurchaseRegister;
