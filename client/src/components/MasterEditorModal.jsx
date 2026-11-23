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
  invalidFields = {},
}) {
  const dialogRef = useRef(null);
  const lastInvalidKeysRef = useRef(new Set());
  const closeHandlerRef = useRef(onRequestClose);
  const focusBeforeModal = useRef(null);
  const { active: workspaceTabActive } = useWorkspaceTab();

  /* Keep the newest close callback without restarting the focus effect. */
  useEffect(() => {
    closeHandlerRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!open || !workspaceTabActive) return undefined;

    const previousOverflow = document.body.style.overflow;
    focusBeforeModal.current = document.activeElement;
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
      if (event.key === "Tab" && dialogRef.current) {
        const candidates = [...dialogRef.current.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        )].filter((element) => element.getClientRects().length > 0);
        if (candidates.length) {
          const first = candidates[0];
          const last = candidates[candidates.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          } else if (!dialogRef.current.contains(document.activeElement)) {
            event.preventDefault(); first.focus();
          }
        }
      }
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
      if (focusBeforeModal.current?.isConnected) focusBeforeModal.current.focus({preventScroll: true});
    };
  }, [open, workspaceTabActive]);

  // Highlight the exact invalid master-data inputs, leaving unrelated fields unchanged.
  useEffect(() => {
    if (!open || !workspaceTabActive || !dialogRef.current) return;
    const fields = dialogRef.current.querySelectorAll(".master-modal-body [name]");
    for (const field of fields) {
      const isInvalid = Boolean(invalidFields[field.name]);
      field.classList.toggle("is-invalid", isInvalid);
      if (isInvalid) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
    const invalidKeys = new Set(Object.keys(invalidFields).filter((key) => invalidFields[key]));
    const hasNewErrors = [...invalidKeys].some((key) => !lastInvalidKeysRef.current.has(key));
    lastInvalidKeysRef.current = invalidKeys;
    // Focus on save failure, not every time a user clears a red field.
    if (hasNewErrors) {
      const firstInvalid = Array.from(fields).find((field) => invalidFields[field.name]);
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
        firstInvalid.focus({ preventScroll: true });
      }
    }
  }, [invalidFields, open, workspaceTabActive]);

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
