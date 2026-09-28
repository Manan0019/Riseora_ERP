export function toTitleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9][A-Z0-9+./&-]{1,7}$/.test(word) && /[A-Z]/.test(word)) {
        return word;
      }
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export function normalizeTitleCaseFields(form, fields) {
  const next = { ...form };
  for (const field of fields) {
    next[field] = toTitleCase(next[field]);
  }
  return next;
}

export function sameForm(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
