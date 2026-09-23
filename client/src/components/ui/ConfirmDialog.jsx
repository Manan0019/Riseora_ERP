import { useEffect, useRef } from "react";
import AppIcon from "../AppIcon";

function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Keep unchanged",
  variant = "primary",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => cancelRef.current?.focus(), 20);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const danger = variant === "danger";
  const warning = variant === "warning";
  const iconName = danger ? "warning" : warning ? "warning" : "check";

  return (
    <div className="ui-dialog-layer" role="presentation" onMouseDown={onCancel}>
      <section
        className="ui-dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ui-confirm-title"
        aria-describedby="ui-confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`ui-dialog-icon ${danger ? "danger" : warning ? "warning" : "primary"}`}>
          <AppIcon name={iconName} size={22} />
        </div>

        <div className="ui-dialog-copy">
          <h3 id="ui-confirm-title">{title}</h3>
          <p id="ui-confirm-message">{message}</p>
          {detail && <div className="ui-dialog-detail">{detail}</div>}
        </div>

        <div className="ui-dialog-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            ref={cancelRef}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : warning ? "btn-warning" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
