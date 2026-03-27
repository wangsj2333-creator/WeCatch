import React from 'react';
import { CATEGORIES } from '../categories';

export default function CommentList({ comments }) {
  return (
    <div>
      {comments.map(c => (
        <div key={c.wx_comment_id} style={{
          borderBottom: '1px solid #eee',
          padding: '8px 0',
          paddingLeft: c.reply_to_wx_id ? 24 : 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{c.nickname}</strong>
            <span style={{ fontSize: 12, color: '#888' }}>
              {c.category ? CATEGORIES[c.category] : '回复'}
            </span>
          </div>
          <div>{c.content}</div>
          {c.parent_content_preview && (
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              ↩ {c.parent_content_preview}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
            {new Date(c.comment_time).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
