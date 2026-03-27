import React, { useEffect, useState } from 'react';
import FilterBar from './components/FilterBar';
import CommentList from './components/CommentList';
import ArticleList from './components/ArticleList';
import ExportModal from './components/ExportModal';
import { exportToExcel } from './export';
import './Dashboard.css';

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
    <div className="dashboard-root">
      {/* Left sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">WeCatch</h1>
          <button className="sidebar-export-btn" onClick={() => setShowExportModal(true)} title="导出数据">
            ↗
          </button>
        </div>
        <div className="sidebar-article-list">
          <ArticleList
            articles={articles}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
          />
        </div>
      </div>

      {/* Right content */}
      <div className="content-area">
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
