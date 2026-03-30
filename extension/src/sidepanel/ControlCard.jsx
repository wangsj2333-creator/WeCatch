import React, { useState } from 'react';
import './control-card.css';

const INTERVALS = [
  { label: '2分钟', value: 2 },
  { label: '5分钟', value: 5 },
  { label: '10分钟', value: 10 },
];

/**
 * ControlCard — frosted glass card with interval selector and capture button.
 * Sprint 2: interval selection sends SET_INTERVAL via onChangeInterval callback.
 * Sprint 4: capture button will trigger manual capture flow.
 *
 * @param {object}   props
 * @param {number}   props.interval           Currently selected interval in minutes
 * @param {Function} props.onChangeInterval   Called with new interval value when user clicks a capsule
 */
export default function ControlCard({ interval, onChangeInterval }) {
  const [loading, setLoading] = useState(false);

  const handleIntervalClick = async (value) => {
    if (value === interval || loading) return;
    setLoading(true);
    try {
      await onChangeInterval(value);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sp-card">
      <div className="control-interval-row">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            className={`interval-capsule${interval === value ? ' interval-capsule--selected' : ''}`}
            onClick={() => handleIntervalClick(value)}
            disabled={loading}
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
