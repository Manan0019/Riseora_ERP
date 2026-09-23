import { useEffect, useState } from "react";
import AppIcon from "../AppIcon";

const iconByType = {
  success: "check",
  danger: "warning",
  warning: "warning",
  info: "info",
};

function ToastItem({ toast, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => onDismiss(toast.id), 180);
    }, toast.duration || 4200);

    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(() => onDismiss(toast.id), 180);
  };

  return (
    <div
      className={`ui-toast ${toast.type || "info"} ${leaving ? "leaving" : ""}`}
      role={toast.type === "danger" ? "alert" : "status"}
    >
      <div className="ui-toast-icon">
        <AppIcon name={iconByType[toast.type] || "info"} size={18} />
      </div>
      <div className="ui-toast-copy">
        {toast.title && <strong>{toast.title}</strong>}
        {toast.message && <span>{toast.message}</span>}
      </div>
      <button type="button" className="ui-toast-close" aria-label="Dismiss notification" onClick={dismiss}>
        ×
      </button>
      <div className="ui-toast-progress" style={{ animationDuration: `${toast.duration || 4200}ms` }} />
    </div>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="ui-toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default ToastViewport;
