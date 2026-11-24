// Scope keyboard and focus operations to the topmost visible editor. Native
// dialogs occupy the browser top layer, confirmations sit above master editors.
export function visibleControl(el) {
  return Boolean(el && el.isConnected && el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]') && (!el.ownerDocument?.defaultView || el.ownerDocument.defaultView.getComputedStyle(el).visibility !== 'hidden'));
}
export function topEditorDialog(doc = document) {
  for (const selector of ['dialog[open]', '.ui-dialog-card[role="alertdialog"]', '.master-modal[role="dialog"]']) {
    const dialogs = Array.from(doc.querySelectorAll(selector)).filter(visibleControl);
    if (dialogs.length) return dialogs.at(-1);
  }
  return null;
}
export function focusableControls(scope) {
  return Array.from(scope?.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]') || [])
    .filter(el => visibleControl(el) && !el.matches(':disabled') && el.tabIndex >= 0);
}
export function canRunEntryShortcut(event, page, doc = document) {
  if (!visibleControl(page) || event.isComposing || event.keyCode === 229) return false;
  if (event.target?.closest?.('.workspace-global-search, .notification-panel')) return false;
  const top = topEditorDialog(doc);
  return !top || (top.matches('.master-modal') && top.contains(page));
}
export function restoreEditorFocus(previous, doc = document) {
  if (!visibleControl(previous) || previous.matches(':disabled')) return false;
  const top = topEditorDialog(doc);
  if (top && !top.contains(previous)) return false;
  const active = doc.activeElement;
  if (active && active !== doc.body && active !== doc.documentElement && visibleControl(active) && active !== previous) return false;
  previous.focus({preventScroll:true});
  return true;
}

// Nested master/confirmation dialogs can close in either React cleanup order.
const bodyLocks = new WeakMap();
export function lockEditorScroll(doc = document) {
  const body = doc.body;
  let lock = bodyLocks.get(body);
  if (!lock) { lock = {count:0, overflow:body.style.overflow}; bodyLocks.set(body,lock); }
  lock.count++; body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lock.count === 0) { body.style.overflow = lock.overflow; bodyLocks.delete(body); }
  };
}
