import React from 'react';
import type { Comment } from '../types';

const C = {
  primary: '#2D4B3E',
  text: '#191C1B',
  muted: '#56635B',
  borderLight: 'rgba(191,201,195,0.3)',
};

interface Props {
  reply: Comment;
}

export function ReplyItem({ reply }: Props) {
  const time = reply.comment_time
    ? new Date(reply.comment_time).toLocaleString('zh-CN', {
        month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: `1px solid ${C.borderLight}`,
    }}>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>
        <span style={{ fontWeight: 700 }}>{reply.nickname}</span>
        {reply.reply_to_nickname && (
          <span style={{ color: C.primary, margin: '0 4px' }}>
            回复 @{reply.reply_to_nickname}
          </span>
        )}
        {reply.reply_to_nickname ? '：' : ' '}
        {reply.content}
      </p>
      <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{time}</p>
    </div>
  );
}
