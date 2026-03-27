import React, { useState } from 'react';
import { exportToExcel } from '../export';

// articles: full articles array
// onClose: () => void
export default function ExportModal({ articles, onClose }) {
  const [checked, setChecked] = useState(() => new Set(articles.map((_, i) => i)));

  const toggle = (idx) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const allChecked = checked.size === articles.length;
  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(articles.map((_, i) => i)));
  };

  const handleExport = () => {
    const selected = articles.filter((_, i) => checked.has(i));
    exportToExcel(selected);
    onClose();
  };

  return (
    // Overlay
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(31, 55, 49, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        padding: 24,
        maxWidth: 480,
        width: '90%',
        boxShadow: '0px 16px 48px rgba(31,55,49,0.12)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 600, color: '#1f3731' }}>
          导出数据
        </h3>

        {/* Article checklist */}
        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {articles.map((a, idx) => {
            const topLevelCount = (a.comments || []).filter(c => !c.reply_to_wx_id).length;
            return (
              <label
                key={a.article.url}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: checked.has(idx) ? '#ddf2ec' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked.has(idx)}
                  onChange={() => toggle(idx)}
                />
                <span style={{ flex: 1, fontSize: 13, color: '#1f3731', fontFamily: 'Manrope, sans-serif' }}>
                  {a.article.title}
                </span>
                <span style={{
                  fontSize: 11, color: '#4b645e', fontFamily: 'Manrope, sans-serif',
                  background: '#ddf2ec', borderRadius: 9999, padding: '2px 8px',
                }}>
                  {topLevelCount}条
                </span>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1f3731', fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            全选
          </label>
          <button
            onClick={handleExport}
            disabled={checked.size === 0}
            style={{
              background: checked.size === 0 ? '#ddf2ec' : 'linear-gradient(135deg, #006d48, #92f7c3)',
              color: checked.size === 0 ? '#9db8b0' : '#ffffff',
              border: 'none',
              borderRadius: 16,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'Manrope, sans-serif',
              cursor: checked.size === 0 ? 'default' : 'pointer',
            }}
          >
            导出（{checked.size}篇）
          </button>
        </div>
      </div>
    </div>
  );
}
