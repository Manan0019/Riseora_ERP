import { blankPurchaseForm, blankPurchaseLine } from './purchaseEntry.js';

export const draftPrefix = (user, kind) => `riseora.drafts.v1.${encodeURIComponent(String(user))}.${kind}.`;
export function listDrafts(storage, prefix, excluded = new Set()) {
  const records = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix) || excluded.has(key)) continue;
    try {
      const record = JSON.parse(storage.getItem(key));
      if (record?.schema === 1 && ['draft','posting','uncertain'].includes(record.status) && record.payload && Number.isFinite(record.updatedAt)) records.push({ ...record, key });
    } catch { /* ignore corrupt entries */ }
  }
  return records.sort((a,b) => b.updatedAt - a.updatedAt);
}
export function writeDraft(storage, key, payload, status = 'draft', updatedAt = Date.now()) {
  storage.setItem(key, JSON.stringify({ schema: 1, payload, status, updatedAt }));
}
export function rankRecent(options, recent, getKey) {
  const ranks = new Map(recent.map((key,index) => [String(key), index]));
  return [...options].sort((a,b) => (ranks.get(String(getKey(a))) ?? Infinity) - (ranks.get(String(getKey(b))) ?? Infinity));
}
export function rememberRecent(recent, key, limit = 12) {
  const value = String(key ?? '');
  return value ? [value, ...recent.filter(x => String(x) !== value)].slice(0,limit) : recent;
}
export function duplicatePurchase(record, today) {
  return { form: { ...blankPurchaseForm(today), supplierId: String(record.supplier_id || ''), freightAmount: String(record.freight_amount ?? 0), otherCharges: String(record.other_charges ?? 0) },
    lines: (record.items || []).map(line => ({ ...blankPurchaseLine(), itemId: String(line.item_id), quantity: String(line.entry_quantity ?? line.quantity), unitId: String(line.entry_unit_id || ''), rate: String(line.entry_rate ?? line.rate), taxableAmount: String(line.taxable_amount ?? 0), pricingBasis: 'TAXABLE', gstRate: String(line.gst_rate ?? 0), hsnCode: String(line.hsn_code ?? '') })) };
}
export function duplicateSale(record, today) {
  return { form: { invoiceDate: today, customerId: String(record.customer_id || ''), customerReference: '', discountAmount: String(record.discount_amount ?? 0), otherCharges: String(record.other_charges ?? 0), amountPaid: '0', paymentMode: 'CASH', paymentReference: '', notes: '', placeOfSupply: record.place_of_supply || '', taxType: 'AUTO' },
    lines: (record.items || []).map(line => ({ itemId: String(line.item_id), quantity: String(line.quantity), rate: String(line.rate), discountAmount: String(line.discount_amount ?? 0), gstRate: String(line.gst_rate ?? 0), hsnCode: String(line.hsn_code || ''), lotNo: '' })) };
}
