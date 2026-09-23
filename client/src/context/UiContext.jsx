import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ToastViewport from "../components/ui/ToastViewport";

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const confirmationResolver = useRef(null);
  const nextToastId = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ type = "info", title = "", message = "", duration = 4200 } = {}) => {
      const id = nextToastId.current++;
      const entry = { id, type, title, message, duration };
      setToasts((current) => [...current.slice(-3), entry]);
      return id;
    },
    [],
  );

  const success = useCallback(
    (message, title = "Saved successfully") => toast({ type: "success", title, message }),
    [toast],
  );

  const error = useCallback(
    (message, title = "Action could not be completed") =>
      toast({ type: "danger", title, message, duration: 6200 }),
    [toast],
  );

  const warning = useCallback(
    (message, title = "Attention required") =>
      toast({ type: "warning", title, message, duration: 5600 }),
    [toast],
  );

  const info = useCallback(
    (message, title = "Information") => toast({ type: "info", title, message }),
    [toast],
  );

  const confirm = useCallback((options = {}) => {
    if (confirmationResolver.current) {
      confirmationResolver.current(false);
    }

    return new Promise((resolve) => {
      confirmationResolver.current = resolve;
      setConfirmation({
        title: options.title || "Confirm action",
        message: options.message || "Are you sure you want to continue?",
        detail: options.detail || "",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Keep unchanged",
        variant: options.variant || "primary",
        icon: options.icon || null,
      });
    });
  }, []);

  const resolveConfirmation = useCallback((result) => {
    const resolver = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolver?.(result);
  }, []);

  const value = useMemo(
    () => ({ toast, success, error, warning, info, confirm }),
    [toast, success, error, warning, info, confirm],
  );

  return (
    <UiContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={Boolean(confirmation)}
        {...confirmation}
        onConfirm={() => resolveConfirmation(true)}
        onCancel={() => resolveConfirmation(false)}
      />
    </UiContext.Provider>
  );
}

export function useUi() {
  const context = useContext(UiContext);
  if (!context) {
    throw new Error("useUi must be used inside UiProvider.");
  }
  return context;
}
