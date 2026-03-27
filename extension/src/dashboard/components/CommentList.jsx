import React, { useState } from 'react';
import { CATEGORIES } from '../categories';

// Category badge colors (inline — small enough to keep here)
const BADGE = {
  question:     { background: '#e0f2fe', color: '#0369a1' },
  correction:   { background: '#fee2e2', color: '#b91c1c' },
  negative:     { background: '#fee2e2', color: '#b91c1c' },
  suggestion:   { background: '#fef9c3', color: '#854d0e' },
  discussion:   { background: '#ede9fe', color: '#6d28d9' },
  cooperation:  { background: '#fff7ed', color: '#c2410c' },
  worthless:    { background: '#f1f5f9', color: '#94a3b8' },
  unclassified: { background: '#f1f5f9', color: '#475569' },
};

function CategoryBadge({ category }) {
  const style = BADGE[category] || BADGE.unclassified;
  return (
    <span style={{
      ...style,
      display: 'inline-flex',
      padding: '2px 10px',
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 500,
      fontFamily: 'Manrope, sans-serif',
    }}>
      {CATEGORIES[category] || category}
    </span>
  );
}

function CommentCard({ comment, repliesFor }) {
  const replies = repliesFor(comment.wx_comment_id);
  const [expanded, setExpanded] = useState(false);
  const initial = comment.nickname ? comment.nickname[0] : '?';

  return (
    <div className="comment-card">
      <div className="comment-card-header">
        <div className="comment-avatar">{initial}</div>
        <span className="comment-nickname">{comment.nickname}</span>
        <span className="comment-timestamp">
          {new Date(comment.comment_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <CategoryBadge category={comment.category} />
      </div>
      <div className="comment-content">{comment.content}</div>
      {replies.length > 0 && (
        <>
          <button className="reply-toggle-btn" onClick={() => setExpanded(e => !e)}>
            {expanded ? '▲ 收起回复' : `▼ ${replies.length}条回复`}
          </button>
          {expanded && replies.map(r => (
            <div key={r.wx_comment_id} className="reply-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className="reply-avatar">{r.nickname ? r.nickname[0] : '?'}</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1f3731', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{r.nickname}</span>
                <span style={{ fontSize: 11, color: '#4b645e', marginLeft: 'auto', fontFamily: 'Manrope, sans-serif' }}>
                  {new Date(r.comment_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#1f3731', fontFamily: 'Manrope, sans-serif', lineHeight: 1.5 }}>{r.content}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// comments: top-level comments only (replies excluded from this list)
// repliesFor: (wx_comment_id) => reply[]
export default function CommentList({ comments, repliesFor }) {
  if (!comments.length) {
    return <div className="empty-state">暂无符合条件的留言</div>;
  }
  return (
    <div>
      {comments.map(c => (
        <CommentCard key={c.wx_comment_id} comment={c} repliesFor={repliesFor} />
      ))}
    </div>
  );
}
