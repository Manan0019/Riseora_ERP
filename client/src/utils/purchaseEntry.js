export const unitSpecs = {
  ML: { family: "VOLUME", factor: 1 },
  L: { family: "VOLUME", factor: 1000 },
  G: { family: "WEIGHT", factor: 1 },
  KG: { family: "WEIGHT", factor: 1000 },
  PCS: { family: "COUNT", factor: 1 },
};

export function matchingUnits(baseUnitCode, units) {
  const base = unitSpecs[String(baseUnitCode || "").toUpperCase()];
  return units.filter((unit) => {
    const spec = unitSpecs[String(unit.code || "").toUpperCase()];
    return unit.code === baseUnitCode || (base && spec && spec.family === base.family);
  });
}

export function convertEntryQuantity(quantity, fromCode, toCode) {
  const from = unitSpecs[String(fromCode || "").toUpperCase()];
  const to = unitSpecs[String(toCode || "").toUpperCase()];
  if (!from || !to || from.family !== to.family) return null;
  return Number(quantity) * from.factor / to.factor;
}

export function purchaseLineValues(line) {
  const quantity = Number(line.quantity || 0);
  const rate = Number(line.rate || 0);
  const taxable = line.pricingBasis === "TAXABLE" ? Number(line.taxableAmount || 0) : quantity * rate;
  const effectiveRate = line.pricingBasis === "TAXABLE" && quantity > 0 ? taxable / quantity : rate;
  const gst = taxable * (Number(line.gstRate || 0) / 100);
  return { taxable, rate: effectiveRate, gst, total: taxable + gst };
}

export const blankPurchaseLine = () => ({ itemId: "", quantity: "", unitId: "", rate: "", taxableAmount: "", pricingBasis: "RATE", gstRate: "0", lotNo: "", mfgDate: "", expiryDate: "" });

export const blankPurchaseForm = (today) => ({ purchaseDate: today, supplierId: "", supplierInvoiceNo: "", paymentDate: "", paymentAccount: "", freightAmount: "0", otherCharges: "0", notes: "" });
