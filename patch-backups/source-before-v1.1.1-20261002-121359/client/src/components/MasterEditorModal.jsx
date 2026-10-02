import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceTab } from "../context/WorkspaceTabContext";

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
  const closeHandlerRef = useRef(onRequestClose);
  const { active: workspaceTabActive } = useWorkspaceTab();

  /* Keep the newest close callback without restarting the focus effect. */
  useEffect(() => {
    closeHandlerRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!open || !workspaceTabActive) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /*
     * Focus only once when the popup opens. The old implementation depended on
     * onRequestClose, which is recreated by many pages on every keystroke. That
     * caused this effect to rerun and move focus to the X button while typing.
     */
    const focusTimer = window.setTimeout(() => {
      const firstEditable = dialogRef.current?.querySelector(
        '.master-modal-body input:not([disabled]):not([type="hidden"]), .master-modal-body select:not([disabled]), .master-modal-body textarea:not([disabled])',
      );
      firstEditable?.focus?.();
    }, 30);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandlerRef.current?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, workspaceTabActive]);

  if (!open || !workspaceTabActive || typeof document === "undefined") return null;

  const modal = (
    <div
      className="master-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeHandlerRef.current?.();
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
            type="button"
            className="master-modal-close"
            aria-label="Close"
            title="Close"
            onClick={() => closeHandlerRef.current?.()}
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
