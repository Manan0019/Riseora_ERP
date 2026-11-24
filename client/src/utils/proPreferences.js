export function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(`riseora.pro.${key}`)) ?? fallback; } catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem(`riseora.pro.${key}`, JSON.stringify(value)); } catch { /* optional preference */ }
}
export function pricingEstimate(cost, margin) {
  const c = Number(cost), m = Number(margin);
  if (!Number.isFinite(c) || c < 0 || !Number.isFinite(m) || m < 0 || m >= 100) return null;
  return c / (1 - m / 100);
}
export function scaleQuantity(quantity, base, target) {
  const q = Number(quantity), b = Number(base), t = Number(target);
  return [q,b,t].every(Number.isFinite) && q >= 0 && b > 0 && t > 0 ? q / b * t : null;
}
