export function toTitleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;

      // Preserve short business/chemical acronyms that were deliberately typed in caps.
      if (/^[A-Z0-9][A-Z0-9+./&-]{1,7}$/.test(word) && /[A-Z]/.test(word)) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}
