/** Update the current validation map without hiding errors in unrelated fields. */
export function clearInvalidField(setInvalidFields, field) {
  setInvalidFields((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
}

/** On submit, show and focus the first red field, including custom search/date controls. */
export function focusInvalidEntryField(root, field) {
  if (!root || !field) return;
  const all = root.querySelectorAll("[data-entry-field]");
  const matching = Array.from(all).find((element) => element.getAttribute("data-entry-field") === field);
  if (!matching) return;
  const focusable = matching.matches("input,select,textarea")
    ? matching
    : matching.querySelector("input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])");
  matching.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
  focusable?.focus?.({ preventScroll: true });
}
