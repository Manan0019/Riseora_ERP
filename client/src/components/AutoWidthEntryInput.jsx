/**
 * Compact entry-table field: starts small and expands as the user types.
 * The width follows the *displayed* value rather than a fixed column minimum.
 * No effect on quantities, prices, tax calculations or persisted data.
 */
export default function AutoWidthEntryInput({
  value = "",
  minChars = 5,
  maxChars = 18,
  invalid = false,
  className = "",
  style,
  type = "number",
  ...props
}) {
  const chars = Math.min(maxChars, Math.max(minChars, String(value ?? "").length + 1));
  return (
    <input
      {...props}
      type={type}
      value={value}
      aria-invalid={invalid ? "true" : undefined}
      className={`form-control auto-width-entry-input ${invalid ? "is-invalid" : ""} ${className}`.trim()}
      style={{ ...style, width: `calc(${chars}ch + 1.3rem)` }}
    />
  );
}
