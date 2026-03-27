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
        onClick={() => onSelect(null)}
        data-selected={selectedIdx === null}
      >
        <span>全部</span>
        <span>{totalCount}条</span>
      </div>
      {articles.map((a, idx) => {
        const topLevelCount = (a.comments || []).filter(c => !c.reply_to_wx_id).length;
        return (
          <div
            key={a.article.url}
            onClick={() => onSelect(idx)}
            data-selected={idx === selectedIdx}
          >
            <span>{a.article.title}</span>
            <span>{topLevelCount}条</span>
          </div>
        );
      })}
    </div>
  );
}
