import React from 'react';

/**
 * StatusCard — frosted glass card showing capture status.
 * Sprint 1: static placeholder content only.
 * Sprint 2: will be wired to real storage data and alarm countdown.
 */
export default function StatusCard() {
  return (
    <div className="sp-card">
      <div className="status-row">
        <span className="status-label">上次抓取</span>
        <span className="status-value">尚未抓取</span>
      </div>
      <div className="status-row">
        <span className="status-label">新增留言</span>
        <span className="status-value--accent">-</span>
      </div>
      <div className="status-divider" />
      <div className="status-countdown">
        <span className="status-countdown-time">--:--</span>
        <span className="status-countdown-label">后自动抓取</span>
      </div>
    </div>
  );
}
