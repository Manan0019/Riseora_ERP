import { useEffect, useMemo, useRef, useState } from "react";
import EntryDraft, { useEntryDraft } from "../components/EntryDraft";
import { duplicateSale } from "../utils/entryProductivity";
import api from "../api/api";
import SearchableSelect from "../components/SearchableSelect";
import { useUi } from "../context/UiContext";
import { useWorkspaceTab } from "../context/WorkspaceTabContext";
import { canRunEntryShortcut } from "../utils/editorFocus";
import SmartDateInput from "../components/SmartDateInput";
import AutoWidthEntryInput from "../components/AutoWidthEntryInput";
import { clearInvalidField, focusInvalidEntryField } from "../utils/entryValidation";

const createEmptyLine = () => ({
  itemId: "",
  quantity: "",
  rate: "",
  discountAmount: "0",
  gstRate: "0",
  hsnCode: "",
  lotNo: ""
});

function Sales({ initialSale = null, copyFrom = null, onSaved = null }) {
  const { success: toastSuccess, error: toastError } = useUi();
  const { active: workspaceTabActive, markClean: markWorkspaceTabClean } = useWorkspaceTab();
  const today = new Date().toISOString().slice(0, 10);

  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [stock, setStock] = useState([]);
  const [company, setCompany] = useState(null);

  const blankForm = () => ({ invoiceDate:today, customerId:"", customerReference:"", discountAmount:"0", otherCharges:"0", amountPaid:"0", paymentMode:"CASH", paymentReference:"", notes:"", placeOfSupply:"", taxType:"AUTO" });
  const [form, setForm] = useState(() => copyFrom ? duplicateSale(copyFrom,today).form : ({
    invoiceDate: initialSale?.invoice_date || today,
    customerId: String(initialSale?.customer_id || ""),
    customerReference: initialSale?.customer_reference || "",
    discountAmount: String(initialSale?.discount_amount ?? 0),
    otherCharges: String(initialSale?.other_charges ?? 0),
    amountPaid: "0",
    paymentMode: "CASH",
    paymentReference: "",
    notes: initialSale?.notes || "",
    placeOfSupply: initialSale?.place_of_supply || "",
    taxType: initialSale?.tax_type || "AUTO"
  }));

  const [lines, setLines] = useState(() => initialSale?.items?.length
    ? initialSale.items.map((item) => ({
      itemId: String(item.item_id), quantity: String(item.quantity), rate: String(item.rate),
      discountAmount: String(item.discount_amount ?? 0), gstRate: String(item.gst_rate ?? 0),
      hsnCode: String(item.hsn_code || ""), lotNo: item.lot_no || "",
    }))
    : copyFrom?.items?.length ? duplicateSale(copyFrom,today).lines : [createEmptyLine()]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState({});
  const pageRef = useRef(null);
  const draft = useEntryDraft({kind:"sale",enabled:!initialSale,payload:{form,lines}, meaningful:JSON.stringify({form,lines})!==JSON.stringify({form:blankForm(),lines:[createEmptyLine()]}), restore:(data)=>{setForm(data.form);setLines(data.lines);setInvalidFields({});},reset:()=>{setForm(blankForm());setLines([createEmptyLine()]);setInvalidFields({});setError("");}});
  const invalid = (field) => Boolean(invalidFields[field]);
  const clear = (field) => clearInvalidField(setInvalidFields, field);

  useEffect(() => {
    if (workspaceTabActive) loadData();
  }, [workspaceTabActive]);

  const loadData = async () => {
    try {
      setError("");

      const [
      customerResponse,
      itemResponse,
      stockResponse,
      companyResponse] =
      await Promise.all([
      api.get("/customers"),
      api.get("/items"),
      api.get("/stock"),
      api.get("/company")]
      );

      setCustomers(
        customerResponse.data.customers || []
      );

      // Sales should normally contain finished goods only.
      const finishedGoods =
      (itemResponse.data.items || []).filter(
        (item) =>
        (item.category_role || item.category_code) === "FG"
      );

      setItems(finishedGoods);

      setStock(
        stockResponse.data.stock || []
      );

      setCompany(
        companyResponse.data.company || null
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load customers, items or stock."
      );
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    clear(name);

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleLineChange = (
  index,
  field,
  value) =>
  {
    clear(`lines.${index}.${field}`);
    setLines((current) =>
    current.map((line, lineIndex) =>
    lineIndex === index ?
    {
      ...line,
      [field]: value
    } :
    line
    )
    );
  };

  const handleProductChange = (
  index,
  value) =>
  {
    clear(`lines.${index}.itemId`);
    clear(`lines.${index}.rate`);
    const selectedProduct =
    items.find(
      (item) =>
      item.id === Number(value)
    );

    setLines((current) =>
    current.map((line, lineIndex) =>
    lineIndex === index ?
    {
      ...line,
      itemId: value,
      rate: selectedProduct ?
      String(
        Number(
          selectedProduct.default_selling_price ||
          0
        )
      ) :
      "",
      hsnCode: String(selectedProduct?.hsn_code || ""),
      gstRate: selectedProduct ?
      String(
        Number(
          selectedProduct.default_gst_rate ||
          0
        )
      ) :
      "0"
    } :
    line
    )
    );
  };

  const handleCustomerChange = (event) => {
    const value = event.target.value;
    const selectedCustomer = customers.find(
      (customer) => customer.id === Number(value)
    );

    clear("customerId");
    setForm((current) => ({
      ...current,
      customerId: value,
      placeOfSupply: selectedCustomer?.state || "",
      taxType: "AUTO"
    }));
  };

  const addLine = () => {
    setLines((current) => [...current, createEmptyLine()]);
    window.requestAnimationFrame(() => {
      const lookups = pageRef.current?.querySelectorAll('input[aria-label^="Sales product row"]');
      lookups?.[lookups.length - 1]?.focus();
    });
  };

  useEffect(() => {
    if (!workspaceTabActive || saving) return undefined;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat || !event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== "n") return;
      if (!canRunEntryShortcut(event, pageRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
      addLine();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [workspaceTabActive, saving]);

  const removeLine = (index) => {
    if (lines.length === 1) {
      setLines([
      createEmptyLine()]
      );

      return;
    }

    setLines((current) =>
    current.filter(
      (_, lineIndex) =>
      lineIndex !== index
    )
    );
  };

  const getItem = (itemId) => {
    return items.find(
      (item) =>
      item.id === Number(itemId)
    );
  };

  const getStock = (itemId) => {
    const result = stock.find(
      (item) =>
      item.id === Number(itemId)
    );

    const alreadySold = initialSale?.items?.find((item) => Number(item.item_id) === Number(itemId));
    return Number(result?.current_stock || 0) + Number(alreadySold?.quantity || 0);
  };

  const calculateLine = (line) => {
    const quantity =
    Number(line.quantity || 0);

    const rate =
    Number(line.rate || 0);

    const discount =
    Number(
      line.discountAmount || 0
    );

    const gstRate =
    Number(line.gstRate || 0);

    const gross =
    quantity * rate;

    const taxable =
    Math.max(
      gross - discount,
      0
    );

    const gst =
    taxable * (
    gstRate / 100);

    const total =
    taxable + gst;

    return {
      gross,
      taxable,
      gst,
      total
    };
  };

  const totals = useMemo(() => {
    let subtotal = 0;

    const lineValues = lines.map((line) => {
      const result = calculateLine(line);
      subtotal += result.taxable;
      return { line, result };
    });

    const invoiceDiscount = Number(form.discountAmount || 0);
    const otherCharges = Number(form.otherCharges || 0);

    let gst = 0;
    for (const { line, result } of lineValues) {
      const share = subtotal > 0 ?
      invoiceDiscount * (result.taxable / subtotal) :
      0;
      const discountedTaxable = Math.max(0, result.taxable - share);
      gst += discountedTaxable * (Number(line.gstRate || 0) / 100);
    }

    const grandTotal =
    subtotal -
    invoiceDiscount +
    gst +
    otherCharges;

    const amountPaid =
    Number(
      form.amountPaid || 0
    );

    return {
      subtotal,
      gst,
      invoiceDiscount,
      otherCharges,
      grandTotal:
      Math.max(
        grandTotal,
        0
      ),
      amountPaid,
      balance:
      Math.max(
        grandTotal -
        amountPaid,
        0
      )
    };
  }, [
  lines,
  form.discountAmount,
  form.otherCharges,
  form.amountPaid]
  );

  const paymentStatus =
  totals.amountPaid <= 0 ?
  "UNPAID" :
  totals.amountPaid >=
  totals.grandTotal ?
  "PAID" :
  "PARTIAL";

  const validate = () => {
    const issues = [];
    const fail = (field, message) => issues.push({ field, message });
    if (!form.invoiceDate) fail("invoiceDate", "Invoice date is required.");
    if (!form.customerId) fail("customerId", "Customer is required.");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const key = (field) => `lines.${index}.${field}`;
      if (!line.itemId || !getItem(line.itemId)) fail(key("itemId"), `Item is required in row ${index + 1}.`);
      const qty = Number(line.quantity);
      if (!line.quantity || !Number.isFinite(qty) || qty <= 0) fail(key("quantity"), `Quantity must be greater than zero in row ${index + 1}.`);
      const rate = Number(line.rate);
      if (line.rate === "" || !Number.isFinite(rate) || rate < 0) fail(key("rate"), `Enter a valid rate in row ${index + 1}.`);
      const discount = Number(line.discountAmount || 0);
      if (!Number.isFinite(discount) || discount < 0 || discount > calculateLine(line).gross) fail(key("discountAmount"), `Line discount cannot exceed line amount in row ${index + 1}.`);
      const gst = Number(line.gstRate);
      if (!Number.isFinite(gst) || gst < 0 || gst > 100) fail(key("gstRate"), `Enter a valid GST percentage in row ${index + 1}.`);
      if (line.itemId && Number.isFinite(qty) && qty > getStock(line.itemId)) {
        fail(key("quantity"), `${getItem(line.itemId)?.name || `Row ${index + 1}`}: only ${getStock(line.itemId).toFixed(3)} available in stock.`);
      }
    }
    const invoiceDiscount = Number(form.discountAmount || 0);
    if (!Number.isFinite(invoiceDiscount) || invoiceDiscount < 0 || invoiceDiscount > totals.subtotal) fail("discountAmount", "Invoice discount cannot exceed subtotal.");
    const charges = Number(form.otherCharges || 0);
    if (!Number.isFinite(charges) || charges < 0) fail("otherCharges", "Other charges must be a valid non-negative amount.");
    const paid = Number(form.amountPaid || 0);
    if (!Number.isFinite(paid) || paid < 0 || paid > totals.grandTotal) fail("amountPaid", "Amount paid cannot exceed grand total.");
    return issues;
  };

  const handleSave = async () => {
    setMessage("");
    setError("");

    const issues = validate();
    if (issues.length) {
      setInvalidFields(Object.fromEntries(issues.map(({ field }) => [field, true])));
      setError(issues[0].message);
      toastError(issues[0].message, "Invoice not saved");
      window.requestAnimationFrame(() => focusInvalidEntryField(pageRef.current, issues[0].field));
      return;
    }
    setInvalidFields({});

    if (saving || (!initialSale && !draft.beginPost())) return;
    try {
      setSaving(true);

      const response =
      await api[initialSale ? "put" : "post"](
        initialSale ? `/sales/${initialSale.id}/replace` : "/sales",
        {
          invoiceDate:
          form.invoiceDate,

          customerId:
          Number(
            form.customerId
          ),

          customerReference:
          form.customerReference.trim(),

          placeOfSupply:
          form.placeOfSupply.trim(),

          taxType:
          form.taxType,

          discountAmount:
          Number(
            form.discountAmount ||
            0
          ),

          otherCharges:
          Number(
            form.otherCharges ||
            0
          ),

          amountPaid:
          Number(
            form.amountPaid ||
            0
          ),

          paymentMode:
          form.paymentMode,

          paymentReference:
          form.paymentReference.trim(),

          notes:
          form.notes.trim(),

          items: lines.map(
            (line) => ({
              itemId:
              Number(
                line.itemId
              ),

              quantity:
              Number(
                line.quantity
              ),

              rate:
              Number(
                line.rate
              ),

              discountAmount:
              Number(
                line.discountAmount ||
                0
              ),

              hsnCode: String(line.hsnCode || "").trim(),
              gstRate:
              Number(
                line.gstRate ||
                0
              ),

              lotNo:
              line.lotNo.trim()
            })
          )
        }
      );

      if (!initialSale) draft.clear();
      const successMessage = initialSale
        ? `Invoice ${initialSale.invoice_no} replaced by ${response.data.sale.invoiceNo}. Original remains cancelled for audit.`
        : `Invoice ${response.data.sale.invoiceNo} saved successfully.`;
      if (onSaved) { toastSuccess(successMessage, initialSale ? "Invoice corrected" : "Invoice posted"); onSaved(response.data.sale); return; }
      setMessage(successMessage);
      toastSuccess(successMessage, "Sales invoice posted");

      setForm({
        invoiceDate: today,
        customerId: "",
        customerReference: "",
        discountAmount: "0",
        otherCharges: "0",
        amountPaid: "0",
        paymentMode: "CASH",
        paymentReference: "",
        notes: "",
        placeOfSupply: "",
        taxType: "AUTO"
      });

      setLines([
      createEmptyLine()]
      );

      setInvalidFields({});
      markWorkspaceTabClean();
      await loadData();
    } catch (err) {
      console.error(err);

      if (!initialSale) draft.failed(err);
      const errorMessage = err.response?.data?.message || "Unable to save sales invoice.";
      setError(errorMessage);
      toastError(errorMessage, "Invoice not saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={pageRef} className="transaction-page sales-entry-page">
      <div className="transaction-intro mb-4">
        <h2 className="mb-1">
          {initialSale ? `Correct ${initialSale.invoice_no}` : "Sales Invoice"}
        </h2>

        <p className="text-muted mb-0">
          {initialSale ? "This posts a corrected invoice with a NEW number and retains the original as cancelled. Only unpaid invoices without later stock movements can be corrected." : "Create customer invoices and deduct finished goods stock."}
        </p>
      </div>

      {copyFrom && <div className="alert alert-info">New invoice copied from {copyFrom.invoice_no}. Verify stock, prices and taxes; previous payments and references are not copied.</div>}
      {!initialSale && <EntryDraft draft={draft} saving={saving}/>}
      {message &&
      <div className="alert alert-success">
          {message}
        </div>
      }

      {error &&
      <div className="alert alert-danger">
          {error}
        </div>
      }

      <div className="card mb-4 transaction-card">
        <div className="card-body">
          <div className="transaction-section-heading">
            <div><span className="transaction-step">01</span><div><h5>Invoice & Customer</h5><p>Choose the customer and establish invoice/tax context.</p></div></div>
          </div>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label">
                Invoice Date *
              </label>

              <SmartDateInput

                className="form-control"
                validationError={invalid("invoiceDate")}
                fieldId="invoiceDate"
                name="invoiceDate"
                value={
                form.invoiceDate
                }
                onChange={
                handleFormChange
                } />
              
            </div>

            <div className="col-md-5 mb-3">
              <label className="form-label">
                Customer *
              </label>

              <SearchableSelect
                value={form.customerId}
                invalid={invalid("customerId")}
                fieldId="customerId"
                onChange={(value) =>
                handleCustomerChange({ target: { value } })
                }
                options={customers}
                placeholder="Search customer by name..."
                ariaLabel="Customer"
                getOptionLabel={(customer) => customer.name}
                getOptionMeta={(customer) =>
                [customer.city, customer.state].filter(Boolean).join(", ")
                }
                getOptionSearchText={(customer) =>
                `${customer.phone || ""} ${customer.alternate_phone || ""} ${customer.gstin || ""}`
                } />
              
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                Customer Reference
              </label>

              <input
                className="form-control"
                name="customerReference"
                value={
                form.customerReference
                }
                onChange={
                handleFormChange
                } />
              
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                Place of Supply
              </label>

              <input
                className="form-control"
                name="placeOfSupply"
                value={form.placeOfSupply}
                onChange={handleFormChange}
                placeholder="Defaults to customer state" />
              
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">
                GST Type
              </label>

              <select
                className="form-select"
                name="taxType"
                value={form.taxType}
                onChange={handleFormChange}>
                
                <option value="AUTO">
                  Auto ({company?.state || "company state"} vs customer state)
                </option>
                <option value="INTRA_STATE">CGST + SGST</option>
                <option value="INTER_STATE">IGST</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 transaction-card transaction-lines-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 transaction-section-heading compact">
            <div>
              <span className="transaction-step">02</span>
              <div>
                <h5>Sale Items</h5>
                <p>Finished goods, available stock, pricing, discount and GST.</p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={addLine}
              title="Add item (Ctrl+N)">

              + Add Item <span className="entry-shortcut-hint">Ctrl+N</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle entry-table compact-entry-table">
              <thead className="table-light"><tr>
                <th className="sales-product-name">Product / Name</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th>
                <th>Discount</th><th>Taxable</th><th>GST %</th><th>GST Amount</th><th>Total</th><th>Available</th><th>Lot</th><th>Action</th>
              </tr></thead>

              <tbody>
                {lines.map(
                  (line, index) => {
                    const item =
                    getItem(
                      line.itemId
                    );

                    const available =
                    getStock(
                      line.itemId
                    );

                    const values =
                    calculateLine(
                      line
                    );

                    const insufficient =
                    Number(
                      line.quantity ||
                      0
                    ) >
                    available;

                    return (
                      <tr
                        key={index}
                        className={
                        insufficient ?
                        "table-danger" :
                        ""
                        }>
                        
                        <td>
                          <SearchableSelect
                            value={line.itemId}
                            invalid={invalid(`lines.${index}.itemId`)}
                            fieldId={`lines.${index}.itemId`}
                            onChange={(value) =>
                            handleProductChange(index, value)
                            }
                            options={items} recentGroup="items"
                            placeholder="Search product..."
                            ariaLabel={`Sales product row ${index + 1}`}
                            getOptionLabel={(itemOption) =>
                            `${itemOption.code} - ${itemOption.name}`
                            }
                            getOptionMeta={(itemOption) => {
                              const availableQty = getStock(itemOption.id);
                              return `${itemOption.unit_code || ""} · Available ${availableQty.toFixed(3)}`;
                            }}
                            getOptionSearchText={(itemOption) =>
                            `${itemOption.hsn_code || ""}`
                            } />
                          
                        </td>

                        <td>
                          <input type="text" aria-label={`HSN row ${index + 1}`} className="form-control entry-hsn-input" maxLength={16} value={line.hsnCode} onChange={(event) => handleLineChange(index, "hsnCode", event.target.value.toUpperCase())} />
                        </td>



                        <td>
                          <AutoWidthEntryInput
                            type="number"
                            min="0"
                            step="0.001"
                            className="sales-quantity"
                            invalid={invalid(`lines.${index}.quantity`)}
                            data-entry-field={`lines.${index}.quantity`}
                            minChars={5} maxChars={14}
                            value={
                            line.quantity
                            }
                            onChange={(
                            event) =>

                            handleLineChange(
                              index,
                              "quantity",
                              event.target.
                              value
                            )
                            } />
                          
                        </td>

                        <td>
                          {item?.unit_code ||
                          "-"}
                        </td>

                        <td>
                          <AutoWidthEntryInput
                            type="number"
                            min="0"
                            step="0.01"
                            className="sales-rate"
                            invalid={invalid(`lines.${index}.rate`)}
                            data-entry-field={`lines.${index}.rate`}
                            minChars={6} maxChars={17}
                            value={
                            line.rate
                            }
                            onChange={(
                            event) =>

                            handleLineChange(
                              index,
                              "rate",
                              event.target.
                              value
                            )
                            } />
                          
                        </td>

                        <td>
                          <AutoWidthEntryInput
                            type="number"
                            min="0"
                            step="0.01"
                            className="sales-discount-amount"
                            invalid={invalid(`lines.${index}.discountAmount`)}
                            data-entry-field={`lines.${index}.discountAmount`}
                            minChars={6} maxChars={16}
                            value={
                            line.discountAmount
                            }
                            onChange={(
                            event) =>

                            handleLineChange(
                              index,
                              "discountAmount",
                              event.target.
                              value
                            )
                            } />
                          
                        </td>



                        <td>
                          ₹
                          {values.taxable.toFixed(
                            2
                          )}
                        </td>

                        <td>
                          <AutoWidthEntryInput
                            type="number"
                            min="0"
                            step="0.01"
                            className="sales-gstRate"
                            invalid={invalid(`lines.${index}.gstRate`)}
                            data-entry-field={`lines.${index}.gstRate`}
                            minChars={3} maxChars={6}
                            value={
                            line.gstRate
                            }
                            onChange={(
                            event) =>

                            handleLineChange(
                              index,
                              "gstRate",
                              event.target.
                              value
                            )
                            } />
                          
                        </td>

                        <td>
                          ₹
                          {values.gst.toFixed(
                            2
                          )}
                        </td>

                        <td>
                          ₹
                          {values.total.toFixed(
                            2
                          )}
                        </td>

                        <td>
                          {line.itemId ?
                          available.toFixed(
                            3
                          ) :
                          "-"}
                        </td>

                        <td>
                          <AutoWidthEntryInput
                            type="text"
                            className="sales-lot"
                            minChars={8} maxChars={20}
                            value={
                            line.lotNo
                            }
                            onChange={(
                            event) =>

                            handleLineChange(
                              index,
                              "lotNo",
                              event.target.
                              value
                            )
                            } />
                          
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                            removeLine(
                              index
                            )
                            }>
                            
                            Remove
                          </button>
                        </td>
                      </tr>);

                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-6">
          <div className="card mb-4 transaction-card">
            <div className="card-body">
              <div className="transaction-mini-title">Notes & Customer Context</div>
              <label className="form-label">
                Notes
              </label>

              <textarea
                className="form-control"
                rows="4"
                name="notes"
                value={
                form.notes
                }
                onChange={
                handleFormChange
                } />
              
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card mb-4 transaction-card totals-card">
            <div className="card-body">
              <div className="transaction-mini-title">Settlement & Invoice Total</div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Invoice Discount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-control ${invalid("discountAmount") ? "is-invalid" : ""}`}
                data-entry-field="discountAmount"
                    name="discountAmount"
                    value={
                    form.discountAmount
                    }
                    onChange={
                    handleFormChange
                    } />
                  
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Other Charges
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-control ${invalid("otherCharges") ? "is-invalid" : ""}`}
                data-entry-field="otherCharges"
                    name="otherCharges"
                    value={
                    form.otherCharges
                    }
                    onChange={
                    handleFormChange
                    } />
                  
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Amount Paid
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-control ${invalid("amountPaid") ? "is-invalid" : ""}`}
                data-entry-field="amountPaid"
                    name="amountPaid"
                    value={
                    form.amountPaid
                    }
                    onChange={
                    handleFormChange
                    } />
                  
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Payment Mode
                  </label>

                  <select
                    className="form-select"
                    name="paymentMode"
                    value={
                    form.paymentMode
                    }
                    onChange={
                    handleFormChange
                    }>
                    
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

                <div className="col-12 mb-3">
                  <label className="form-label">
                    Payment Reference
                  </label>

                  <input
                    className="form-control"
                    name="paymentReference"
                    value={
                    form.paymentReference
                    }
                    onChange={
                    handleFormChange
                    } />
                  
                </div>
              </div>

              <table className="table mb-0">
                <tbody>
                  <tr>
                    <th>
                      Subtotal
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.subtotal.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Invoice Discount
                    </th>

                    <td className="text-end">
                      - ₹
                      {totals.invoiceDiscount.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>GST</th>

                    <td className="text-end">
                      ₹
                      {totals.gst.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Other Charges
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.otherCharges.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Grand Total
                    </th>

                    <th className="text-end">
                      ₹
                      {totals.grandTotal.toFixed(
                        2
                      )}
                    </th>
                  </tr>

                  <tr>
                    <th>
                      Amount Paid
                    </th>

                    <td className="text-end">
                      ₹
                      {totals.amountPaid.toFixed(
                        2
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th>
                      Balance Due
                    </th>

                    <th className="text-end">
                      ₹
                      {totals.balance.toFixed(
                        2
                      )}
                    </th>
                  </tr>

                  <tr>
                    <th>
                      Payment Status
                    </th>

                    <td className="text-end">
                      {paymentStatus ===
                      "PAID" ?
                      <span className="badge text-bg-success">
                          Paid
                        </span> :
                      paymentStatus ===
                      "PARTIAL" ?
                      <span className="badge text-bg-warning">
                          Partial
                        </span> :

                      <span className="badge text-bg-danger">
                          Unpaid
                        </span>
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="transaction-action-bar">
        <div className="transaction-action-copy">
          <span>Invoice total</span>
          <strong>₹{totals.grandTotal.toFixed(2)}</strong>
          <small>Balance after this receipt: ₹{totals.balance.toFixed(2)}</small>
        </div>
        <button
          type="button"
          className="btn btn-success btn-lg"
          data-pro-action="save" data-pro-confirm-post="true" onClick={handleSave}
          disabled={saving || (!initialSale && draft.status!=="draft")}>
          
          {saving ? "Saving Invoice..." : "Post Sales Invoice"}
        </button>
      </div>
    </div>);

}

export default Sales;
