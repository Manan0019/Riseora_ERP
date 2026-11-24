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
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  const paused=hovered||focused;
  // Errors stay visible until dismissed; other messages pause while being read.
  const persistent=toast.type==="danger";
  useEffect(() => {
    if(leaving||persistent||paused)return;
    const timer=window.setTimeout(()=>setLeaving(true),toast.duration||4200);
    return ()=>window.clearTimeout(timer);
  },[leaving,persistent,paused,toast.duration]);
  useEffect(()=>{
    if(!leaving)return;
    const timer=window.setTimeout(()=>onDismiss(toast.id),180);
    return ()=>window.clearTimeout(timer);
  },[leaving,toast.id,onDismiss]);
  const dismiss=()=>setLeaving(true);

  return (
    <div
      className={`ui-toast ${toast.type || "info"} ${leaving ? "leaving" : ""}`}
      role={toast.type === "danger" ? "alert" : "status"}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      onFocus={()=>setFocused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}
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
      {!persistent&&!paused&&!leaving&&<div className="ui-toast-progress" style={{ animationDuration: `${toast.duration || 4200}ms` }} />}
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
