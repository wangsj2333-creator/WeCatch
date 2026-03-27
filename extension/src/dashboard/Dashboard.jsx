import React, { useEffect, useState } from 'react';
import FilterBar from './components/FilterBar';
import CommentList from './components/CommentList';
import { exportToExcel } from './export';

// worthless excluded from defaults — user can enable it via filter
const DEFAULT_CATS = ['question','correction','negative','suggestion','discussion','cooperation','unclassified'];

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_CATS);

  useEffect(() => {
    chrome.storage.session.get('wecatchResults', (data) => {
      setArticles(data.wecatchResults || []);
    });
  }, []);

  const toggleFilter = (cat) => {
    setActiveFilters(f =>
      f.includes(cat) ? f.filter(c => c !== cat) : [...f, cat]
    );
  };

  const visibleComments = articles.flatMap(a => {
    const comments = a.comments || [];
    // Build set of visible top-level comment IDs
    const visibleTopIds = new Set(
      comments
        .filter(c => !c.reply_to_wx_id && activeFilters.includes(c.category))
        .map(c => c.wx_comment_id)
    );
    // Include top-level comments that pass filter, and replies whose parent is visible
    return comments.filter(c =>
      c.reply_to_wx_id ? visibleTopIds.has(c.reply_to_wx_id) : activeFilters.includes(c.category)
    );
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>WeCatch 数据看板</h2>
        <button onClick={() => exportToExcel(articles)}>导出 Excel</button>
      </div>
      <FilterBar active={activeFilters} onChange={toggleFilter} />
      <CommentList comments={visibleComments} />
    </div>
  );
}
