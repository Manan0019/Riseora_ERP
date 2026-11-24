export const APPEARANCE_DEFAULTS = Object.freeze({ theme: 'light', font: 100 });
export const FONT_SIZES = [90, 100, 110, 120];
export function normalizeAppearance(value) {
  return { theme: value?.theme === 'dark' ? 'dark' : 'light', font: FONT_SIZES.includes(value?.font) ? value.font : 100 };
}
export const DASHBOARD_WIDGETS = [
  ['metrics', 'Business summary'], ['activity', 'Sales and purchase activity'], ['stock', 'Low stock items'], ['production', 'Recent production'],
];
export function normalizeDashboard(value) {
  const ids = DASHBOARD_WIDGETS.map(([id]) => id);
  const order = Array.isArray(value?.order) ? [...new Set(value.order.filter(id => ids.includes(id)))] : [];
  const hidden = Array.isArray(value?.hidden) ? [...new Set(value.hidden.filter(id => ids.includes(id)))] : [];
  return { order: [...order, ...ids.filter(id => !order.includes(id))], hidden: hidden.length === ids.length ? [] : hidden };
}
export function moveDashboardWidget(order, id, delta) {
  const next = [...order], i = next.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= next.length || Math.abs(delta) !== 1) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
export const MAX_NOTIFICATIONS = 100;
export function appendNotification(history, entry) {
  return [{ ...entry, read: false }, ...history].slice(0, MAX_NOTIFICATIONS);
}
export function markNotificationsRead(history) { return history.map(entry => entry.read ? entry : { ...entry, read: true }); }
