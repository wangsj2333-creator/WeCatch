import React, { useState } from 'react';

/**
 * ArticleSelector — frosted-glass article selection panel.
 * Shows a checkbox list of articles with comment counts.
 * Only renders articles with comment_count > 0 (caller should pre-filter,
 * but this component also guards internally).
 *
 * @param {object}   props
 * @param {Array}    props.articles        Articles from FETCH_ARTICLES ({ comment_id, title, comment_count })
 * @param {Function} props.onConfirm       Called with selected comment_id[] when user confirms
 * @param {Function} props.onCancel        Called when user cancels / closes
 */
export default function ArticleSelector({ articles, onConfirm, onCancel }) {
  const eligible = articles.filter((a) => a.comment_count > 0);
  const [selected, setSelected] = useState(() => new Set(eligible.map((a) => a.comment_id)));

  const allSelected = selected.size === eligible.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((a) => a.comment_id)));
    }
  };

  const toggleItem = (commentId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
  };

  if (eligible.length === 0) {
    return (
      <div className="article-selector">
        <p className="article-selector-empty">暂无可抓取的文章</p>
        <div className="article-selector-footer">
          <button className="btn-ghost" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="article-selector">
      {/* Select-all row */}
      <label className="article-selector-item article-selector-all">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="article-checkbox"
        />
        <span className="article-title">全选</span>
      </label>

      {/* Article list */}
      {eligible.map((article) => (
        <label
          key={article.comment_id}
          className={`article-selector-item${selected.has(article.comment_id) ? ' selected' : ''}`}
        >
          <input
            type="checkbox"
            checked={selected.has(article.comment_id)}
            onChange={() => toggleItem(article.comment_id)}
            className="article-checkbox"
          />
          <span className="article-title">{article.title}</span>
          <span className="article-count-badge">{article.comment_count}</span>
        </label>
      ))}

      {/* Footer: cancel + confirm */}
      <div className="article-selector-footer">
        <button className="btn-ghost" onClick={onCancel}>
          取消
        </button>
        <button
          className="btn-confirm"
          disabled={selected.size === 0}
          onClick={handleConfirm}
        >
          抓取（{selected.size} 篇）
        </button>
      </div>
    </div>
  );
}
