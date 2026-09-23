function FormSection({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section className={`form-section ${className}`.trim()}>
      {(title || subtitle || badge || actions) && (
        <header className="form-section-header">
          <div>
            <div className="form-section-title-row">
              {title && <h5 className="form-section-title">{title}</h5>}
              {badge && <span className="form-section-badge">{badge}</span>}
            </div>
            {subtitle && <p className="form-section-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="form-section-actions">{actions}</div>}
        </header>
      )}
      <div className={`form-section-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

export default FormSection;
