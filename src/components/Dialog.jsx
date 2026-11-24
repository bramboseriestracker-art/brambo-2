import { useEffect, useRef } from 'react';

export default function Dialog({ open, onClose, children, className = '', label }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog ${className}`} aria-label={label} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && <div className="dialog-panel"><button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>✕</button>{children}</div>}
    </dialog>
  );
}
