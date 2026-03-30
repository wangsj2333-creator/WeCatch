import React from 'react';
import { formatRelativeTime } from './useStatus';
import './status-card.css';

/**
 * StatusCard — frosted glass card showing capture status.
 * Sprint 2: driven by props from SidePanel (via useStatus hook).
 *
 * @param {object} props
 * @param {string|null} props.lastRun  ISO 8601 timestamp or null
 * @param {number|null} props.newCount Number of new top-level comments, or null
 * @param {string}      props.countdown Countdown string in mm:ss format
 */
export default function StatusCard({ lastRun, newCount, countdown }) {
  const lastRunText = formatRelativeTime(lastRun);
  const newCountText = newCount === null ? '-' : String(newCount);

  return (
    <div className="sp-card">
      <div className="status-row">
        <span className="status-label">上次抓取</span>
        <span className="status-value">{lastRunText}</span>
      </div>
      <div className="status-row">
        <span className="status-label">新增留言</span>
        <span className="status-value--accent">{newCountText}</span>
      </div>
      <div className="status-divider" />
      <div className="status-countdown">
        <span className="status-countdown-time">{countdown}</span>
        <span className="status-countdown-label">后自动抓取</span>
      </div>
    </div>
  );
}
