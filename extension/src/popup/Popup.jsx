import React, { useEffect, useState } from 'react';

export default function Popup() {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState({});
  const [progress, setProgress] = useState(null); // {current, total}
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch article list from content script
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_ARTICLES' }, (resp) => {
        if (!resp?.ok) { setError(resp?.error || 'unknown error'); return; }
        const articles = resp.data?.articles || [];
        setArticles(articles);
        const sel = {};
        articles.forEach(a => sel[a.comment_id] = true);
        setSelected(sel);
      });
    });

    // Listen for progress updates
    const listener = (msg) => {
      if (msg.type === 'PROGRESS') setProgress({ current: msg.current, total: msg.total });
      if (msg.type === 'CAPTURE_DONE') setDone(true);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const allSelected = articles.length > 0 && articles.every(a => selected[a.comment_id]);
  const toggleAll = () => {
    const sel = {};
    articles.forEach(a => sel[a.comment_id] = !allSelected);
    setSelected(sel);
  };

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const startCapture = () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', articleIds: ids });
    setProgress({ current: 0, total: ids.length });
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  if (error) return <div style={{padding:12, color:'red'}}>{error}</div>;

  return (
    <div style={{ width: 320, padding: 12, fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 8px' }}>WeCatch</h3>

      {!progress && (
        <>
          <label style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #eee', marginBottom: 4 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>全选</span>
          </label>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 8 }}>
            {articles.map(a => (
              <label key={a.comment_id} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <input type="checkbox" checked={!!selected[a.comment_id]} onChange={() => toggle(a.comment_id)} />
                <span>{a.title} ({a.comment_count}条留言)</span>
              </label>
            ))}
          </div>
          <button onClick={startCapture} disabled={!Object.values(selected).some(Boolean)}>
            开始抓取
          </button>
        </>
      )}

      {progress && !done && (
        <div>处理中：{progress.current} / {progress.total}</div>
      )}

      {done && (
        <>
          <div>✓ 抓取完成</div>
          <button onClick={openDashboard} style={{ marginTop: 8 }}>打开数据看板</button>
        </>
      )}
    </div>
  );
}
