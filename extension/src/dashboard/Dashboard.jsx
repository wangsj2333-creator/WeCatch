import React, { useEffect, useState } from 'react';
import FilterBar from './components/FilterBar';
import CommentList from './components/CommentList';
import ArticleList from './components/ArticleList';
import ExportModal from './components/ExportModal';
import { exportToExcel } from './export';

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null); // null = all articles
  const [categoryFilter, setCategoryFilter] = useState(''); // '' = all
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    chrome.storage.session.get('wecatchResults', (data) => {
      setArticles(data.wecatchResults || []);
    });
  }, []);

  const allComments = selectedIdx === null
    ? articles.flatMap(a => a.comments || [])
    : (articles[selectedIdx]?.comments || []);

  const topLevel = allComments.filter(c => {
    if (c.reply_to_wx_id) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    return true;
  });

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
        <FilterBar
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />
        <CommentList comments={sortedTopLevel} repliesFor={repliesFor} />
      </div>

      {showExportModal && (
        <ExportModal
          articles={articles}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
