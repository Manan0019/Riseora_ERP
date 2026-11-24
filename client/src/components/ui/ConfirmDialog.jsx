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
  const dialogRef = useRef(null);
  const cancelHandler = useRef(onCancel);
  cancelHandler.current=onCancel;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus=document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer=window.setTimeout(() => cancelRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();event.stopPropagation();cancelHandler.current?.();return;
      }
      if(event.key!=="Tab")return;
      const buttons=Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled)') || []);
      if(!buttons.length)return;
      const current=buttons.indexOf(document.activeElement);
      const next=event.shiftKey?(current<=0?buttons.length-1:current-1):(current<0||current===buttons.length-1?0:current+1);
      event.preventDefault();event.stopPropagation();buttons[next]?.focus();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
      if(previousFocus?.isConnected && previousFocus.getClientRects().length)previousFocus.focus({preventScroll:true});
    };
  }, [open]);

  if (!open) return null;

  const danger = variant === "danger";
  const warning = variant === "warning";
  const iconName = danger ? "warning" : warning ? "warning" : "check";

  return (
    <div className="ui-dialog-layer" role="presentation" onMouseDown={onCancel}>
      <section
        className="ui-dialog-card"
        ref={dialogRef}
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
