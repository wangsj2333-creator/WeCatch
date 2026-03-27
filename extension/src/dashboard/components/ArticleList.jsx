import React from 'react';

// articles: array of article objects from session storage
// selectedIdx: index of currently selected article (integer), or null for all
// onSelect: (idx) => void — pass null to select "all"
export default function ArticleList({ articles, selectedIdx, onSelect }) {
  const totalCount = articles.reduce((sum, a) =>
    sum + (a.comments || []).filter(c => !c.reply_to_wx_id).length, 0
  );
  return (
    <div>
      <div
        className={`article-item${selectedIdx === null ? ' selected' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="article-item-title">全部</span>
        <span className="article-item-count">{totalCount}条</span>
      </div>
      {articles.map((a, idx) => {
        const topLevelCount = (a.comments || []).filter(c => !c.reply_to_wx_id).length;
        return (
          <div
            key={a.article.url}
            className={`article-item${idx === selectedIdx ? ' selected' : ''}`}
            onClick={() => onSelect(idx)}
          >
            <span className="article-item-title">{a.article.title}</span>
            <span className="article-item-count">{topLevelCount}条</span>
          </div>
        );
      })}
    </div>
  );
}
