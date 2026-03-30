import React, { useEffect, useState } from 'react';
import './Popup.css';

export default function Popup() {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState({});
  const [progress, setProgress] = useState(null); // {current, total}
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_ARTICLES' }, (resp) => {
        if (!resp?.ok) { setError(resp?.error || 'unknown error'); return; }
        const list = (resp.data?.articles || []).filter(a => a.comment_count > 0);
        setArticles(list);
        const sel = {};
        list.forEach(a => sel[a.comment_id] = true);
        setSelected(sel);
      });
    });

    const listener = (msg) => {
      if (msg.type === 'PROGRESS') setProgress({ current: msg.current, total: msg.total });
      if (msg.type === 'CAPTURE_DONE') setDone(true);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const selectedIds = Object.keys(selected).filter(id => selected[id]);
  const allSelected = articles.length > 0 && articles.every(a => selected[a.comment_id]);

  const toggleAll = () => {
    const sel = {};
    articles.forEach(a => sel[a.comment_id] = !allSelected);
    setSelected(sel);
  };

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const startCapture = () => {
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', articleIds: selectedIds });
    setProgress({ current: 0, total: selectedIds.length });
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-logo">🌿</span>
        <span className="popup-title">WeCatch</span>
      </div>

      <div className="popup-card">
        {error && <div className="error-text">{error}</div>}

        {!error && !progress && (
          <>
            <div className="select-all-row">
              <div
                className={`checkbox ${allSelected ? 'checked' : ''}`}
                onClick={toggleAll}
              />
              <span className="select-all-label">全选</span>
              {selectedIds.length > 0 && (
                <span className="selected-count">{selectedIds.length} 篇已选</span>
              )}
            </div>
            <div className="article-list">
              {articles.map(a => (
                <div
                  key={a.comment_id}
                  className={`article-item ${selected[a.comment_id] ? 'selected' : ''}`}
                  onClick={() => toggle(a.comment_id)}
                >
                  <div className={`checkbox ${selected[a.comment_id] ? 'checked' : ''}`} />
                  <div className="article-info">
                    <div className="article-title">{a.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {progress && !done && (
          <>
            <div className="progress-text">
              抓取中 {progress.current} / {progress.total}
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </>
        )}

        {done && (
          <div className="done-text">✓ 抓取完成</div>
        )}
      </div>

      {!error && !progress && (
        <button
          className="btn-primary"
          onClick={startCapture}
          disabled={selectedIds.length === 0}
        >
          开始抓取
        </button>
      )}

      {done && (
        <button className="btn-ghost" onClick={openDashboard}>
          打开数据看板
        </button>
      )}
    </div>
  );
}
