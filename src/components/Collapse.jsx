import { useRef } from 'react';

/* Animated expand/collapse (grid-row technique: no measured heights). Children mount on first open and stay mounted so closing animates too. */
export default function Collapse({ open, children, className = '' }) {
  const ever = useRef(open);
  if (open) ever.current = true;
  return (
    <div className={`collapse ${open ? 'open' : ''} ${className}`} aria-hidden={!open}>
      <div className="collapse-inner">{ever.current && children}</div>
    </div>
  );
}
