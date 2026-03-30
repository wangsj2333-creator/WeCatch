import React, { useState } from 'react';
import './control-card.css';

const INTERVALS = [
  { label: '2分钟', value: 2 },
  { label: '5分钟', value: 5 },
  { label: '10分钟', value: 10 },
];

/**
 * ControlCard — frosted glass card with interval selector and capture button.
 * Sprint 1: UI only, no logic wired.
 * Sprint 2: interval selection will send SET_INTERVAL to service worker.
 * Sprint 4: capture button will trigger manual capture flow.
 */
export default function ControlCard() {
  const [selectedInterval, setSelectedInterval] = useState(5);

  return (
    <div className="sp-card">
      <div className="control-interval-row">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            className={`interval-capsule${selectedInterval === value ? ' interval-capsule--selected' : ''}`}
            onClick={() => setSelectedInterval(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="btn-primary" disabled>
        立即抓取
      </button>
    </div>
  );
}
