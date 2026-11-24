import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function WorkspaceDialog({ title, children, onClose, className = '' }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, []);
  return createPortal(<dialog ref={ref} className={`pro-dialog workspace-enhancement-dialog ${className}`} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}}>
    <header><h2 id={titleId}>{title}</h2><button type="button" className="btn btn-outline-secondary" autoFocus onClick={onClose}>Close</button></header>
    {children}
  </dialog>, document.body);
}
