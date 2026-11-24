import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import SearchableSelect from "../components/SearchableSelect";
import SmartDateInput from "../components/SmartDateInput";
import AutoWidthEntryInput from "../components/AutoWidthEntryInput";
import { clearInvalidField, focusInvalidEntryField } from "../utils/entryValidation";
import { useUi } from "../context/UiContext";
import { useWorkspaceTab } from "../context/WorkspaceTabContext";
import { blankPurchaseForm, blankPurchaseLine, convertEntryQuantity, matchingUnits, purchaseLineValues } from "../utils/purchaseEntry";

const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function Purchases({ initialPurchase = null, onSaved = null, embedded = false }) {
  const { success: toastSuccess, error: toastError } = useUi();
  const { active: workspaceTabActive, markClean: markWorkspaceTabClean } = useWorkspaceTab();
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [form, setForm] = useState(() => initialPurchase ? {
    purchaseDate: initialPurchase.purchase_date || todayLocal(),
    supplierId: String(initialPurchase.supplier_id || ""),
    supplierInvoiceNo: initialPurchase.supplier_invoice_no || "",
    paymentDate: initialPurchase.payment_date || "",
    paymentAccount: initialPurchase.payment_account || "",
    freightAmount: String(initialPurchase.freight_amount ?? 0),
    otherCharges: String(initialPurchase.other_charges ?? 0),
    notes: initialPurchase.notes || "",
  } : blankPurchaseForm(todayLocal()));
  const [lines, setLines] = useState(() => initialPurchase?.items?.length ? initialPurchase.items.map((line) => ({
    itemId: String(line.item_id),
    quantity: String(line.entry_quantity ?? line.quantity),
    unitId: String(line.entry_unit_id || ""),
    rate: String(line.entry_rate ?? line.rate),
    taxableAmount: String(line.taxable_amount ?? 0),
    pricingBasis: "TAXABLE", // retain the posted invoice taxable amount exactly
    gstRate: String(line.gst_rate ?? 0),
    hsnCode: String(line.hsn_code ?? ""),
    lotNo: line.lot_no || "", mfgDate: line.mfg_date || "", expiryDate: line.expiry_date || "",
  })) : [blankPurchaseLine()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState({});
  const pageRef = useRef(null);
  const invalid = (field) => Boolean(invalidFields[field]);
  const clear = (field) => clearInvalidField(setInvalidFields, field);

  function addNewLine() {
    setLines((current) => [...current, blankPurchaseLine()]);
    window.requestAnimationFrame(() => {
      const lookups = pageRef.current?.querySelectorAll('input[aria-label^="Purchase item row"]');
      lookups?.[lookups.length - 1]?.focus();
    });
  }

  // Scoped to the currently active purchase tab / editor; don't create a new Electron window.
  useEffect(() => {
    if (!workspaceTabActive || saving) return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat || !event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== "n") return;
      event.preventDefault();
      event.stopPropagation();
      addNewLine();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [workspaceTabActive, saving]);

  useEffect(() => { if (workspaceTabActive) loadLookups(); }, [workspaceTabActive]);

  async function loadLookups() {
    try {
      const [supplierResponse, itemResponse, unitResponse, purchaseResponse] = await Promise.all([
        api.get("/suppliers"), api.get("/items", { params: { includeInactive: Boolean(initialPurchase) } }),
        api.get("/units"), api.get("/purchases"),
      ]);
      setSuppliers(supplierResponse.data.suppliers || []);
      setItems(itemResponse.data.items || []);
      setUnits(unitResponse.data.units || []);
      const used = (purchaseResponse.data.purchases || []).map((p) => String(p.payment_account || "").trim()).filter(Boolean);
      setPaymentAccounts([...new Set(["Cash", ...used])].sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error(err);
      notifyError("Unable to load suppliers, items or units.");
    }
  }

  function notifyError(text) { setError(text); toastError(text, "Purchase entry"); }
  function updateForm(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); clear(name); }
  const getItem = (id) => items.find((item) => Number(item.id) === Number(id));

  function changeLine(index, field, value) {
    clear(`lines.${index}.${field}`);
    if (field === "itemId") {
      clear(`lines.${index}.unitId`);
      clear(`lines.${index}.lotNo`);
      clear(`lines.${index}.expiryDate`);
    }
    if (field === "rate") clear(`lines.${index}.taxableAmount`);
    if (field === "taxableAmount") clear(`lines.${index}.rate`);
    setLines((current) => current.map((line, i) => {
      if (i !== index) return line;
      if (field === "itemId") {
        const item = getItem(value);
        return { ...blankPurchaseLine(), itemId: value, unitId: String(item?.base_unit_id || ""), gstRate: String(item?.default_gst_rate ?? 0), hsnCode: String(item?.hsn_code || "") };
      }
      if (field === "unitId") {
        const oldUnit = units.find((unit) => Number(unit.id) === Number(line.unitId));
        const newUnit = units.find((unit) => Number(unit.id) === Number(value));
        const converted = line.quantity && oldUnit && newUnit ? convertEntryQuantity(line.quantity, oldUnit.code, newUnit.code, getItem(line.itemId)?.density) : null;
        const taxable = purchaseLineValues(line).taxable;
        return { ...line, unitId: value, quantity: converted == null ? line.quantity : String(Number(converted.toPrecision(12))), taxableAmount: String(taxable), pricingBasis: "TAXABLE" };
      }
      if (field === "rate") return { ...line, rate: value, pricingBasis: "RATE" };
      if (field === "taxableAmount") return { ...line, taxableAmount: value, pricingBasis: "TAXABLE" };
      return { ...line, [field]: value };
    }));
  }

  const totals = useMemo(() => {
    const amounts = lines.map(purchaseLineValues);
    const subtotal = amounts.reduce((sum, line) => sum + line.taxable, 0);
    const gst = amounts.reduce((sum, line) => sum + line.gst, 0);
    const freight = Number(form.freightAmount || 0);
    const other = Number(form.otherCharges || 0);
    return { subtotal, gst, freight, other, grandTotal: subtotal + gst + freight + other };
  }, [lines, form.freightAmount, form.otherCharges]);

  function validate() {
    const issues = [];
    const fail = (field, message) => issues.push({ field, message });
    if (!form.purchaseDate) fail("purchaseDate", "Invoice date is required.");
    if (!form.supplierId) fail("supplierId", "Supplier is required.");
    if (form.paymentDate && !form.paymentAccount.trim()) fail("paymentAccount", "Payment account is required when Payment Date is entered.");
    for (const field of ["freightAmount", "otherCharges"]) {
      if (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0) fail(field, "Charges must be valid non-negative amounts.");
    }
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const item = getItem(line.itemId);
      const amounts = purchaseLineValues(line);
      const key = (field) => `lines.${i}.${field}`;
      if (!item) fail(key("itemId"), `Select an item in row ${i + 1}.`);
      if (!line.quantity || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) fail(key("quantity"), `Enter a valid positive quantity in row ${i + 1}.`);
      if (item && !line.unitId && !item.base_unit_id) fail(key("unitId"), `Select a unit in row ${i + 1}.`);
      if (line.rate === "" && line.taxableAmount === "") {
        fail(key("rate"), `Enter a rate or taxable amount in row ${i + 1}.`);
        fail(key("taxableAmount"), `Enter a rate or taxable amount in row ${i + 1}.`);
      }
      if (![amounts.rate, amounts.taxable].every(Number.isFinite) || amounts.rate < 0 || amounts.taxable < 0) {
        fail(key(line.pricingBasis === "TAXABLE" ? "taxableAmount" : "rate"), `Check rate and taxable amount in row ${i + 1}.`);
      }
      if (!Number.isFinite(Number(line.gstRate)) || Number(line.gstRate) < 0 || Number(line.gstRate) > 100) fail(key("gstRate"), `Check GST percentage in row ${i + 1}.`);
      if ((item?.track_lot || item?.automatic_lot_tracking) && !line.lotNo.trim()) fail(key("lotNo"), `Lot number is required for ${item.name}.`);
      if (item?.track_expiry && !line.expiryDate) fail(key("expiryDate"), `Expiry date is required for ${item.name}.`);
      if (line.mfgDate && line.expiryDate && line.expiryDate < line.mfgDate) fail(key("expiryDate"), `Expiry must follow manufacturing date in row ${i + 1}.`);
    }
    return issues;
  }

  async function savePurchase() {
    setError(""); setMessage("");
    const issues = validate();
    if (issues.length) {
      setInvalidFields(Object.fromEntries(issues.map(({ field }) => [field, true])));
      notifyError(issues[0].message);
      window.requestAnimationFrame(() => focusInvalidEntryField(pageRef.current, issues[0].field));
      return;
    }
    setInvalidFields({});
    try {
      setSaving(true);
      const payload = {
        ...form, supplierId: Number(form.supplierId),
        freightAmount: Number(form.freightAmount || 0), otherCharges: Number(form.otherCharges || 0),
        items: lines.map((line) => ({
          itemId: Number(line.itemId), quantity: Number(line.quantity), unitId: Number(line.unitId || getItem(line.itemId)?.base_unit_id),
          rate: purchaseLineValues(line).rate, taxableAmount: purchaseLineValues(line).taxable,
          gstRate: Number(line.gstRate || 0), hsnCode: String(line.hsnCode || "").trim(), lotNo: line.lotNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        })),
      };
      const response = initialPurchase
        ? await api.put(`/purchases/${initialPurchase.id}`, payload)
        : await api.post("/purchases", payload);
      const note = `Purchase ${response.data.purchase.purchaseNo} ${initialPurchase ? "corrected" : "posted"} successfully.`;
      toastSuccess(note, "Purchase saved");
      markWorkspaceTabClean();
      if (onSaved) onSaved(response.data.purchase);
      else { setMessage(note); setForm(blankPurchaseForm(todayLocal())); setLines([blankPurchaseLine()]); setInvalidFields({}); await loadLookups(); }
    } catch (err) {
      notifyError(err.response?.data?.message || "Unable to save purchase.");
    } finally { setSaving(false); }
  }

  const money = (value) => `₹${Number(value || 0).toFixed(2)}`;
  return (
    <div ref={pageRef} className={`transaction-page purchase-entry-page ${embedded ? "purchase-editor-embedded" : ""}`}>
      {!embedded && <div className="transaction-intro mb-3"><div><h2 className="mb-1">Purchase Entry</h2><p className="text-muted mb-0">Record supplier invoices, GST and purchased stock.</p></div></div>}
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="card mb-3 transaction-card"><div className="card-body">
        <div className="transaction-mini-title">Purchase Details</div>
        <div className="row g-2">
          <div className="col-md-3"><label className="form-label">Invoice Date *</label><SmartDateInput className="form-control" validationError={invalid("purchaseDate")} fieldId="purchaseDate" name="purchaseDate" value={form.purchaseDate} onChange={updateForm} /></div>
          <div className="col-md-5"><label className="form-label">Supplier *</label><SearchableSelect value={form.supplierId} invalid={invalid("supplierId")} fieldId="supplierId" onChange={(value) => { setForm((f) => ({ ...f, supplierId: value })); clear("supplierId"); }} options={suppliers} placeholder="Search supplier..." ariaLabel="Supplier" getOptionLabel={(supplier) => supplier.name} getOptionMeta={(supplier) => [supplier.city, supplier.state].filter(Boolean).join(", ")} getOptionSearchText={(supplier) => `${supplier.name} ${supplier.phone || ""} ${supplier.gstin || ""}`} /></div>
          <div className="col-md-4"><label className="form-label">Supplier Invoice No.</label><input className="form-control" name="supplierInvoiceNo" value={form.supplierInvoiceNo} onChange={updateForm} /></div>
          <div className="col-md-3"><label className="form-label">Payment Date</label><SmartDateInput className="form-control" name="paymentDate" value={form.paymentDate} onChange={updateForm} /></div>
          <div className="col-md-5"><label className="form-label">Payment Account</label><input className={`form-control ${invalid("paymentAccount") ? "is-invalid" : ""}`} aria-invalid={invalid("paymentAccount")} data-entry-field="paymentAccount" name="paymentAccount" list="purchase-payment-accounts" value={form.paymentAccount} onChange={updateForm} placeholder="Account / Cash" /><datalist id="purchase-payment-accounts">{paymentAccounts.map((account) => <option key={account} value={account} />)}</datalist></div>
          <div className="col-md-4"><label className="form-label">Notes</label><input className="form-control" name="notes" value={form.notes} onChange={updateForm} /></div>
        </div>
      </div></div>

      <div className="card mb-3 transaction-card"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2"><div className="transaction-mini-title mb-0">Purchase Items</div><button type="button" className="btn btn-sm btn-primary" onClick={addNewLine} title="Add item (Ctrl+N)">+ Add Item <span className="entry-shortcut-hint">Ctrl+N</span></button></div>
        <div className="table-responsive"><table className="table table-bordered align-middle entry-table compact-entry-table">
          <thead className="table-light"><tr><th className="purchase-item-name">Item / Name</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Taxable</th><th>GST %</th><th>GST Amount</th><th>Total</th><th>Lot No.</th><th>Mfg Date</th><th>Expiry Date</th><th></th></tr></thead>
          <tbody>{lines.map((line, index) => {
            const item = getItem(line.itemId);
            const amounts = purchaseLineValues(line);
            const compatibleUnits = matchingUnits(item?.unit_code, units, item?.density);
            return <tr key={index}>
              <td><SearchableSelect value={line.itemId} invalid={invalid(`lines.${index}.itemId`)} fieldId={`lines.${index}.itemId`} onChange={(value) => changeLine(index, "itemId", value)} options={items} placeholder="Search item..." ariaLabel={`Purchase item row ${index + 1}`} getOptionLabel={(option) => `${option.code} - ${option.name}`} getOptionMeta={(option) => `${option.category_name || ""} · ${option.unit_code || ""}`} getOptionSearchText={(option) => option.hsn_code || ""} /></td>
              <td><input type="text" aria-label={`HSN row ${index + 1}`} className="form-control entry-hsn-input" maxLength={16} value={line.hsnCode} onChange={(event) => changeLine(index, "hsnCode", event.target.value.toUpperCase())} /></td>
              <td><AutoWidthEntryInput aria-label={`Quantity row ${index + 1}`} data-entry-field={`lines.${index}.quantity`} invalid={invalid(`lines.${index}.quantity`)} minChars={5} maxChars={15} min="0" step="any" className="purchase-qty" value={line.quantity} onChange={(e) => changeLine(index, "quantity", e.target.value)} /></td>
              <td><select aria-label={`Unit row ${index + 1}`} data-entry-field={`lines.${index}.unitId`} aria-invalid={invalid(`lines.${index}.unitId`)} className={`form-select purchase-unit ${invalid(`lines.${index}.unitId`) ? "is-invalid" : ""}`} value={line.unitId || item?.base_unit_id || ""} onChange={(e) => changeLine(index, "unitId", e.target.value)}><option value="">–</option>{compatibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></td>
              <td><AutoWidthEntryInput aria-label={`Rate row ${index + 1}`} data-entry-field={`lines.${index}.rate`} invalid={invalid(`lines.${index}.rate`)} minChars={6} maxChars={17} min="0" step="any" className="purchase-money" value={line.pricingBasis === "TAXABLE" ? (line.quantity ? Number(amounts.rate.toPrecision(12)) : "") : line.rate} onChange={(e) => changeLine(index, "rate", e.target.value)} /></td>
              <td><AutoWidthEntryInput aria-label={`Taxable amount row ${index + 1}`} data-entry-field={`lines.${index}.taxableAmount`} invalid={invalid(`lines.${index}.taxableAmount`)} minChars={7} maxChars={17} min="0" step="any" className="purchase-money" value={line.pricingBasis === "TAXABLE" ? line.taxableAmount : (line.quantity && line.rate !== "" ? Number(amounts.taxable.toFixed(6)) : "")} onChange={(e) => changeLine(index, "taxableAmount", e.target.value)} /></td>
              <td><AutoWidthEntryInput aria-label={`GST percentage row ${index + 1}`} data-entry-field={`lines.${index}.gstRate`} invalid={invalid(`lines.${index}.gstRate`)} minChars={3} maxChars={6} min="0" max="100" step="any" className="purchase-gst" value={line.gstRate} onChange={(e) => changeLine(index, "gstRate", e.target.value)} /></td>
              <td className="text-end">{money(amounts.gst)}</td><td className="text-end"><strong>{money(amounts.total)}</strong></td>
              <td><AutoWidthEntryInput type="text" aria-label={`Lot row ${index + 1}`} data-entry-field={`lines.${index}.lotNo`} invalid={invalid(`lines.${index}.lotNo`)} minChars={8} maxChars={22} className="purchase-lot" value={line.lotNo} disabled={!item?.track_lot && !item?.automatic_lot_tracking} onChange={(e) => changeLine(index, "lotNo", e.target.value)} /></td>
              <td><SmartDateInput className="form-control" value={line.mfgDate} disabled={!item?.track_lot && !item?.track_expiry && !item?.automatic_lot_tracking} onChange={(e) => changeLine(index, "mfgDate", e.target.value)} /></td>
              <td><SmartDateInput className="form-control" validationError={invalid(`lines.${index}.expiryDate`)} fieldId={`lines.${index}.expiryDate`} value={line.expiryDate} disabled={!item?.track_expiry && !item?.automatic_lot_tracking} onChange={(e) => changeLine(index, "expiryDate", e.target.value)} /></td>
              <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setLines((current) => current.length === 1 ? [blankPurchaseLine()] : current.filter((_, i) => i !== index))} title="Remove item" aria-label={`Remove row ${index + 1}`}>×</button></td>
            </tr>;
          })}</tbody>
        </table></div>
        <small className="text-muted">Enter Rate to calculate Taxable, or enter Taxable to calculate Rate. The selected unit is converted to the item’s base unit for stock.</small>
      </div></div>

      <div className="card mb-3 transaction-card"><div className="card-body">
        <div className="row g-2 align-items-end">
          <div className="col-sm-3 col-md-2"><label className="form-label">Freight</label><input type="number" min="0" step="any" className={`form-control ${invalid("freightAmount") ? "is-invalid" : ""}`} data-entry-field="freightAmount" name="freightAmount" value={form.freightAmount} onChange={updateForm} /></div>
          <div className="col-sm-3 col-md-2"><label className="form-label">Other Charges</label><input type="number" min="0" step="any" className={`form-control ${invalid("otherCharges") ? "is-invalid" : ""}`} data-entry-field="otherCharges" name="otherCharges" value={form.otherCharges} onChange={updateForm} /></div>
          <div className="col-sm-6 col-md-8 d-flex justify-content-end gap-3 flex-wrap purchase-total-summary"><span>Taxable <strong>{money(totals.subtotal)}</strong></span><span>GST <strong>{money(totals.gst)}</strong></span><span>Grand Total <strong>{money(totals.grandTotal)}</strong></span></div>
        </div>
      </div></div>
      <div className="transaction-action-bar"><div className="transaction-action-copy"><span>{initialPurchase ? `Correct ${initialPurchase.purchase_no}` : "Purchase total"}</span><strong>{money(totals.grandTotal)}</strong></div><button type="button" className="btn btn-success" data-pro-action="save" data-pro-confirm-post="true" onClick={savePurchase} disabled={saving}>{saving ? "Saving..." : initialPurchase ? "Save Purchase Corrections" : "Post Purchase"}</button></div>
    </div>
  );
}

export default Purchases;
