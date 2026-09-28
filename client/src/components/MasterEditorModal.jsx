import { useEffect, useRef } from "react";

function MasterEditorModal({ open, title, subtitle, onRequestClose, children, footer, size = "lg" }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeRef.current?.focus(), 25);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onRequestClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onRequestClose]);

  if (!open) return null;

  return (
    <div className="master-modal-backdrop" role="presentation" onMouseDown={onRequestClose}>
      <section
        className={`master-modal master-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="master-modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="master-modal-close"
            aria-label="Close"
            onClick={onRequestClose}
          >
            ×
          </button>
        </header>

        <div className="master-modal-body">{children}</div>

        {footer && <footer className="master-modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}

export default MasterEditorModal;
