import React, { useEffect, useState } from 'react';
import FilterBar from './components/FilterBar';
import CommentList from './components/CommentList';
import ArticleList from './components/ArticleList';
import { exportToExcel } from './export';

const DEFAULT_CATS = ['question','correction','negative','suggestion','discussion','cooperation','unclassified'];

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null); // null = all articles
  const [activeFilters, setActiveFilters] = useState(DEFAULT_CATS);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [showExportModal, setShowExportModal] = useState(false);

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

  const allComments = selectedIdx === null
    ? articles.flatMap(a => a.comments || [])
    : (articles[selectedIdx]?.comments || []);

  // Top-level comments that pass the category filter
  const visibleTopIds = new Set(
    allComments
      .filter(c => !c.reply_to_wx_id && activeFilters.includes(c.category))
      .map(c => c.wx_comment_id)
  );

  // Collect top-level comments + their replies
  const topLevel = allComments
    .filter(c => !c.reply_to_wx_id && visibleTopIds.has(c.wx_comment_id));

  const sortedTopLevel = [...topLevel].sort((a, b) => {
    const diff = new Date(a.comment_time) - new Date(b.comment_time);
    return sortOrder === 'newest' ? -diff : diff;
  });

  const repliesFor = (wx_comment_id) =>
    allComments.filter(c => c.reply_to_wx_id === wx_comment_id);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left sidebar */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' }}>
          <span>WeCatch</span>
          <button onClick={() => setShowExportModal(true)}>导出</button>
        </div>
        <ArticleList
          articles={articles}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <CommentList comments={sortedTopLevel} repliesFor={repliesFor} />
      </div>

      {showExportModal && (
        <div>Export modal placeholder</div>
      )}
    </div>
  );
}
