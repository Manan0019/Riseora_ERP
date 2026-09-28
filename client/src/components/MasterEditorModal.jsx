import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function MasterEditorModal({
  open,
  title,
  subtitle,
  onRequestClose,
  children,
  footer,
  size = "lg",
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const firstEditable = dialogRef.current?.querySelector(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
      );
      firstEditable?.focus?.();
    }, 30);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onRequestClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onRequestClose]);

  if (!open || typeof document === "undefined") return null;

  const modal = (
    <div
      className="master-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onRequestClose?.();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={`master-modal master-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="master-modal-header">
          <div className="master-modal-heading-copy">
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            ref={closeRef}
            type="button"
            className="master-modal-close"
            aria-label="Close"
            title="Close"
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

  return createPortal(modal, document.body);
}

export default MasterEditorModal;
