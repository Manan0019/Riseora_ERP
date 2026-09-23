import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../api/api";
import logo from "../assets/riseora-logo-Horizontal.png";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const qty = (value) => Number(value || 0).toFixed(3).replace(/\.000$/, "");

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function wordsBelowThousand(number) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  let n = Math.floor(number);
  const parts = [];
  if (n >= 100) {
    parts.push(`${ones[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n > 0) parts.push(ones[n]);
  return parts.join(" ");
}

function amountToWords(value) {
  const amount = Math.max(0, Number(value || 0));
  let rupees = Math.floor(amount + 0.000001);
  const paise = Math.round((amount - rupees) * 100);
  const parts = [];

  const crore = Math.floor(rupees / 10000000);
  if (crore) {
    parts.push(`${wordsBelowThousand(crore)} Crore`);
    rupees %= 10000000;
  }

  const lakh = Math.floor(rupees / 100000);
  if (lakh) {
    parts.push(`${wordsBelowThousand(lakh)} Lakh`);
    rupees %= 100000;
  }

  const thousand = Math.floor(rupees / 1000);
  if (thousand) {
    parts.push(`${wordsBelowThousand(thousand)} Thousand`);
    rupees %= 1000;
  }

  if (rupees) parts.push(wordsBelowThousand(rupees));
  if (parts.length === 0) parts.push("Zero");

  let result = `Rupees ${parts.join(" ")}`;
  if (paise > 0) result += ` and ${wordsBelowThousand(paise)} Paise`;
  return `${result} Only`;
}

function compactAddress(parts) {
  return parts.filter((part) => String(part || "").trim()).join(", ");
}

function SalesInvoicePrint() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [invoiceResponse, companyResponse] = await Promise.all([
          api.get(`/sales/${id}`),
          api.get("/company"),
        ]);
        setInvoice(invoiceResponse.data.invoice || null);
        setCompany(companyResponse.data.company || null);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Unable to load invoice.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  useEffect(() => {
    if (!loading && invoice && searchParams.get("print") === "1") {
      const timer = window.setTimeout(() => window.print(), 450);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [loading, invoice, searchParams]);

  const documentData = useMemo(() => {
    if (!invoice) return null;

    const seller = {
      name: invoice.seller_name || company?.name || "Riseora",
      legalName: invoice.seller_legal_name || company?.legal_name || "",
      gstin: invoice.seller_gstin || company?.gstin || "",
      address: invoice.seller_address || company?.address || "",
      city: invoice.seller_city || company?.city || "",
      state: invoice.seller_state || company?.state || "",
      pincode: invoice.seller_pincode || company?.pincode || "",
      phone: invoice.seller_phone || company?.phone || "",
      email: invoice.seller_email || company?.email || "",
      bankName: invoice.seller_bank_name || company?.bank_name || "",
      bankAccountName:
        invoice.seller_bank_account_name || company?.bank_account_name || "",
      bankAccountNo:
        invoice.seller_bank_account_no || company?.bank_account_no || "",
      bankIfsc: invoice.seller_bank_ifsc || company?.bank_ifsc || "",
      upiId: invoice.seller_upi_id || company?.upi_id || "",
      terms: invoice.invoice_terms_snapshot || company?.invoice_terms || "",
    };

    const buyer = {
      code: invoice.buyer_code || invoice.customer_code || "",
      name: invoice.buyer_name || invoice.customer_name || "",
      phone: invoice.buyer_phone || invoice.customer_phone || "",
      email: invoice.buyer_email || invoice.customer_email || "",
      gstin: invoice.buyer_gstin || invoice.customer_gstin || "",
      address: invoice.buyer_address || invoice.customer_address || "",
      city: invoice.buyer_city || invoice.customer_city || "",
      state: invoice.buyer_state || invoice.customer_state || "",
      pincode: invoice.buyer_pincode || invoice.customer_pincode || "",
    };

    const subtotal = Number(invoice.subtotal || 0);
    const invoiceDiscount = Number(invoice.discount_amount || 0);
    const taxType = invoice.tax_type || "INTRA_STATE";

    const lines = (invoice.items || []).map((item) => {
      const baseTaxable = Number(item.taxable_amount || 0);
      const discountShare =
        subtotal > 0 ? invoiceDiscount * (baseTaxable / subtotal) : 0;
      const taxableAfterInvoiceDiscount = Math.max(0, baseTaxable - discountShare);
      const tax = Number(item.gst_amount || 0);

      return {
        ...item,
        invoice_discount_share: discountShare,
        print_taxable: taxableAfterInvoiceDiscount,
        print_tax: tax,
        print_total: taxableAfterInvoiceDiscount + tax,
      };
    });

    return { seller, buyer, lines, taxType };
  }, [invoice, company]);

  if (loading) {
    return <div className="invoice-loading">Loading invoice...</div>;
  }

  if (error || !invoice || !documentData) {
    return (
      <div className="invoice-loading text-danger">
        {error || "Invoice not found."}
      </div>
    );
  }

  const { seller, buyer, lines, taxType } = documentData;
  const gst = Number(invoice.gst_amount || 0);
  const cgst = taxType === "INTRA_STATE" ? gst / 2 : 0;
  const sgst = taxType === "INTRA_STATE" ? gst / 2 : 0;
  const igst = taxType === "INTER_STATE" ? gst : 0;
  const buyerAddress = compactAddress([
    buyer.address,
    buyer.city,
    buyer.state,
    buyer.pincode,
  ]);
  const sellerAddress = compactAddress([
    seller.address,
    seller.city,
    seller.state,
    seller.pincode,
  ]);

  return (
    <div className="invoice-print-screen">
      <div className="invoice-screen-toolbar no-print">
        <button type="button" className="btn btn-outline-secondary" onClick={() => window.close()}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <main className="invoice-paper">
        {invoice.status === "CANCELLED" && (
          <div className="invoice-cancelled-watermark">CANCELLED</div>
        )}

        <header className="invoice-company-header">
          <div className="invoice-brand-block">
            <img src={logo} alt="Riseora" className="invoice-logo" />
            <div>
              <div className="invoice-company-name">{seller.name}</div>
              {seller.legalName && seller.legalName !== seller.name && (
                <div className="invoice-muted">{seller.legalName}</div>
              )}
              {sellerAddress && <div>{sellerAddress}</div>}
              <div className="invoice-contact-line">
                {seller.phone && <span>Phone: {seller.phone}</span>}
                {seller.email && <span>Email: {seller.email}</span>}
              </div>
              {seller.gstin && <div><strong>GSTIN:</strong> {seller.gstin}</div>}
            </div>
          </div>
          <div className="invoice-title-block">
            <div className="invoice-title">TAX INVOICE</div>
            <div className="invoice-copy-label">Original for Recipient</div>
          </div>
        </header>

        <section className="invoice-meta-grid">
          <div className="invoice-box">
            <div className="invoice-box-title">Bill To</div>
            <div className="invoice-party-name">{buyer.name}</div>
            {buyer.code && <div className="invoice-muted">Customer Code: {buyer.code}</div>}
            {buyerAddress && <div>{buyerAddress}</div>}
            {buyer.phone && <div>Phone: {buyer.phone}</div>}
            {buyer.email && <div>Email: {buyer.email}</div>}
            {buyer.gstin && <div><strong>GSTIN:</strong> {buyer.gstin}</div>}
          </div>

          <div className="invoice-box invoice-document-meta">
            <div><span>Invoice No.</span><strong>{invoice.invoice_no}</strong></div>
            <div><span>Invoice Date</span><strong>{formatDate(invoice.invoice_date)}</strong></div>
            <div><span>Due Date</span><strong>{formatDate(invoice.due_date || invoice.invoice_date)}</strong></div>
            <div><span>Place of Supply</span><strong>{invoice.place_of_supply || buyer.state || "-"}</strong></div>
            <div><span>Tax Type</span><strong>{taxType === "INTER_STATE" ? "IGST" : "CGST + SGST"}</strong></div>
            <div><span>Customer Ref.</span><strong>{invoice.customer_reference || "-"}</strong></div>
          </div>
        </section>

        <table className="invoice-items-table">
          <thead>
            <tr>
              <th className="text-center">#</th>
              <th>Description</th>
              <th>HSN</th>
              <th className="text-end">Qty</th>
              <th>Unit</th>
              <th className="text-end">Rate</th>
              <th className="text-end">Discount</th>
              <th className="text-end">Taxable</th>
              <th className="text-end">GST %</th>
              <th className="text-end">GST</th>
              <th className="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((item, index) => (
              <tr key={item.id}>
                <td className="text-center">{index + 1}</td>
                <td>
                  <div className="invoice-item-name">{item.item_name}</div>
                  <div className="invoice-muted small">{item.item_code}</div>
                  {item.lot_no && <div className="invoice-muted small">Lot: {item.lot_no}</div>}
                </td>
                <td>{item.hsn_code || "-"}</td>
                <td className="text-end">{qty(item.quantity)}</td>
                <td>{item.unit_code || "-"}</td>
                <td className="text-end">₹{money(item.rate)}</td>
                <td className="text-end">₹{money(item.discount_amount)}</td>
                <td className="text-end">₹{money(item.print_taxable)}</td>
                <td className="text-end">{Number(item.gst_rate || 0).toFixed(2)}%</td>
                <td className="text-end">₹{money(item.print_tax)}</td>
                <td className="text-end">₹{money(item.print_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="invoice-summary-section">
          <div className="invoice-words-bank">
            <div className="invoice-box-title">Amount in Words</div>
            <div className="invoice-amount-words">{amountToWords(invoice.grand_total)}</div>

            {(seller.bankName || seller.bankAccountNo || seller.upiId) && (
              <div className="invoice-bank-block">
                <div className="invoice-box-title">Payment Details</div>
                {seller.bankName && <div><strong>Bank:</strong> {seller.bankName}</div>}
                {seller.bankAccountName && <div><strong>Account Name:</strong> {seller.bankAccountName}</div>}
                {seller.bankAccountNo && <div><strong>Account No.:</strong> {seller.bankAccountNo}</div>}
                {seller.bankIfsc && <div><strong>IFSC:</strong> {seller.bankIfsc}</div>}
                {seller.upiId && <div><strong>UPI:</strong> {seller.upiId}</div>}
              </div>
            )}
          </div>

          <div className="invoice-total-box">
            <div><span>Taxable Subtotal</span><strong>₹{money(invoice.subtotal)}</strong></div>
            {Number(invoice.discount_amount || 0) > 0 && (
              <div><span>Invoice Discount</span><strong>- ₹{money(invoice.discount_amount)}</strong></div>
            )}
            {taxType === "INTRA_STATE" ? (
              <>
                <div><span>CGST</span><strong>₹{money(cgst)}</strong></div>
                <div><span>SGST</span><strong>₹{money(sgst)}</strong></div>
              </>
            ) : (
              <div><span>IGST</span><strong>₹{money(igst)}</strong></div>
            )}
            {Number(invoice.other_charges || 0) > 0 && (
              <div><span>Other Charges</span><strong>₹{money(invoice.other_charges)}</strong></div>
            )}
            <div className="invoice-grand-total"><span>Grand Total</span><strong>₹{money(invoice.grand_total)}</strong></div>
            <div><span>Paid</span><strong>₹{money(invoice.net_amount_paid ?? invoice.amount_paid)}</strong></div>
            <div><span>Balance</span><strong>₹{money(invoice.balance_amount)}</strong></div>
          </div>
        </section>

        <section className="invoice-footer-grid">
          <div>
            {invoice.notes && (
              <div className="invoice-footer-block">
                <div className="invoice-box-title">Notes</div>
                <div>{invoice.notes}</div>
              </div>
            )}
            {seller.terms && (
              <div className="invoice-footer-block">
                <div className="invoice-box-title">Terms & Conditions</div>
                <div className="invoice-pre-line">{seller.terms}</div>
              </div>
            )}
          </div>

          <div className="invoice-signature">
            <div>For <strong>{seller.name}</strong></div>
            <div className="invoice-signature-space" />
            <div>Authorised Signatory</div>
          </div>
        </section>

        <footer className="invoice-document-footer">
          This is a computer-generated invoice. Verify statutory tax configuration with your accountant before live GST use.
        </footer>
      </main>
    </div>
  );
}

export default SalesInvoicePrint;
