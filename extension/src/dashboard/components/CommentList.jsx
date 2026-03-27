import React, { useState } from 'react';
import { CATEGORIES } from '../categories';

function CommentCard({ comment, repliesFor }) {
  const replies = repliesFor(comment.wx_comment_id);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {/* Top-level comment */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{comment.nickname}</strong>
        <span style={{ fontSize: 11, color: '#888' }}>
          {new Date(comment.comment_time).toLocaleString()}
        </span>
      </div>
      <span style={{ fontSize: 12 }}>
        {CATEGORIES[comment.category] || comment.category}
      </span>
      <div>{comment.content}</div>

      {replies.length > 0 && (
        <>
          <button onClick={() => setExpanded(e => !e)}>
            {expanded ? '收起回复' : `${replies.length}条回复`}
          </button>
          {expanded && replies.map(r => (
            <div key={r.wx_comment_id} style={{ marginLeft: 40 }}>
              <strong>{r.nickname}</strong>
              <div>{r.content}</div>
              <div style={{ fontSize: 11, color: '#bbb' }}>
                {new Date(r.comment_time).toLocaleString()}
              </div>
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
    return <div>暂无留言</div>;
  }
  return (
    <div>
      {comments.map(c => (
        <CommentCard key={c.wx_comment_id} comment={c} repliesFor={repliesFor} />
      ))}
    </div>
  );
}
