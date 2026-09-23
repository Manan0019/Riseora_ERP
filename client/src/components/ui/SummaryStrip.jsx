function SummaryStrip({ items = [], className = "" }) {
  return (
    <div className={`summary-strip ${className}`.trim()}>
      {items.map((item) => (
        <div className="summary-strip-item" key={item.label}>
          <span>{item.label}</span>
          <strong className={item.className || ""}>{item.value}</strong>
          {item.hint && <small>{item.hint}</small>}
        </div>
      ))}
    </div>
  );
}

export default SummaryStrip;
