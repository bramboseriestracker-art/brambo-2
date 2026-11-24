import { useId, useState } from 'react';

/* Rating tiers on the 0-10 scale: low = burst, mid = normal, high = strong. */
export const tierOf = (v) => (v < 5 ? 'burst' : v < 7.5 ? 'normal' : 'strong');
const TIER_LABEL = { burst: 'Burst', normal: 'Solid', strong: 'Strong' };

function Bucket({ dim }) {
  return (
    <>
      <path d="M6.6 12.4 17.4 12.4 16 22.4 8 22.4Z" fill={dim ? '#7b3d39' : '#E8453C'} />
      <path d="M10.2 12.4 9.8 22.4M13.8 12.4 14.2 22.4" stroke="#fff" strokeWidth="1.5" opacity={dim ? 0.55 : 1} />
      <rect x="5.4" y="11.2" width="13.2" height="1.9" rx=".95" fill={dim ? '#5c2a27' : '#C62E2E'} />
    </>
  );
}

function Icon({ tier, uid }) {
  if (tier === 'burst') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <Bucket dim />
        <polygon points="12,1 13.6,4.4 17.4,2.8 16.4,6.6 21.2,7.6 17.2,9.8 18.6,11.4 12,10.6 5.6,11.4 7.2,9.4 2.8,7.8 7.4,6.4 6.6,2.8 10.4,4.4" fill="#A98348" stroke="#5b4222" strokeWidth=".6" strokeLinejoin="round" />
        <path d="M12 12.6 10.9 15.4 13.2 17.2 11.9 22" fill="none" stroke="#2c1210" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3.6" cy="3.4" r=".9" fill="#A98348" /><circle cx="20.6" cy="2.6" r=".8" fill="#A98348" /><circle cx="22" cy="10.4" r=".7" fill="#7a5a30" /><circle cx="2.4" cy="11" r=".7" fill="#7a5a30" />
      </svg>
    );
  }
  if (tier === 'strong') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE680" /><stop offset="1" stopColor="#FFB82E" /></linearGradient>
          <filter id={`f${uid}`} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation=".9" floodColor="#FFC21A" floodOpacity=".95" /></filter>
        </defs>
        <Bucket />
        <g fill={`url(#g${uid})`} stroke="#E0A020" strokeWidth=".45" filter={`url(#f${uid})`}>
          <circle cx="7.2" cy="9.2" r="3.3" /><circle cx="16.8" cy="9.2" r="3.3" /><circle cx="9.6" cy="5.6" r="3.5" /><circle cx="14.6" cy="5.4" r="3.5" /><circle cx="12" cy="8.6" r="3.5" /><circle cx="12" cy="3.6" r="2.5" />
        </g>
        <path d="M20.6 1.2 21.2 3 23 3.6 21.2 4.2 20.6 6 20 4.2 18.2 3.6 20 3Z" fill="#fff" opacity=".95" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <Bucket />
      <g fill="#FFF1B8" stroke="#E2BE63" strokeWidth=".5">
        <circle cx="8.4" cy="8.6" r="3" /><circle cx="15.6" cy="8.6" r="3" /><circle cx="12" cy="6.4" r="3.3" /><circle cx="12" cy="9.6" r="2.8" />
      </g>
    </svg>
  );
}

function Empty() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 12.4 17.4 12.4 16 22.4 8 22.4Z" fill="#ffffff" opacity=".12" />
      <g fill="#ffffff" opacity=".12"><circle cx="8.4" cy="8.6" r="3" /><circle cx="15.6" cy="8.6" r="3" /><circle cx="12" cy="6.4" r="3.3" /></g>
    </svg>
  );
}

/* value: 0-10. Pass onChange to make it an input (click left/right half for half steps). */
export default function Popcorn({ value = 0, size = 22, onChange, label = 'Rating', showValue = true, className = '' }) {
  const uid = useId().replace(/\W/g, '');
  const [hover, setHover] = useState(0);
  const shown = onChange && hover ? hover : value;
  const tier = tierOf(shown);
  const interactive = typeof onChange === 'function';

  const half = (e, i) => { const r = e.currentTarget.getBoundingClientRect(); return i * 2 + (e.clientX - r.left < r.width / 2 ? 1 : 2); };
  const onKey = (e) => {
    if (!interactive) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(10, Math.round(value) + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, Math.round(value) - 1)); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onChange(0); }
  };

  return (
    <span
      className={`popcorn ${tier} ${interactive ? 'is-input' : ''} ${className}`}
      style={{ '--pc': size + 'px' }}
      role={interactive ? 'slider' : 'img'}
      aria-label={interactive ? `${label}, ${value || 'not rated'} out of 10` : `${label}: ${shown ? shown.toFixed(1) : 'no rating'} out of 10, ${TIER_LABEL[tier]} popcorn`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 10 : undefined}
      aria-valuenow={interactive ? value : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={onKey}
      onMouseLeave={interactive ? () => setHover(0) : undefined}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, shown / 2 - i));
        return (
          <span
            key={i}
            className="pc-cell"
            onMouseMove={interactive ? (e) => setHover(half(e, i)) : undefined}
            onClick={interactive ? (e) => { const v = half(e, i); onChange(v === value ? 0 : v); } : undefined}
          >
            <Empty />
            {fill > 0 && <span className="pc-fill" style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}><Icon tier={tier} uid={uid + i} /></span>}
          </span>
        );
      })}
      {showValue && <span className="pc-num">{shown ? shown.toFixed(1) : '–'}</span>}
    </span>
  );
}

/* Single popcorn + number, for posters and badges. */
export function PopcornMini({ value, label = 'Rating' }) {
  const uid = useId().replace(/\W/g, '');
  if (!value || value <= 0) return null;
  const tier = tierOf(value);
  return <span className={`pc-mini ${tier}`} role="img" aria-label={`${label}: ${value.toFixed(1)} out of 10`}><Icon tier={tier} uid={uid} /><span>{value.toFixed(1)}</span></span>;
}
