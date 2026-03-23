import React, { useState } from 'react';
import { CATEGORY_LABELS, STATUS_LABELS, type Comment, type CommentStatus } from '../types';
import { api } from '../api/client';

const C = {
  primary: '#2D4B3E',
  primaryLight: '#DDE6E1',
  border: '#BFC9C3',
  borderLight: 'rgba(191,201,195,0.4)',
  text: '#191C1B',
  muted: '#56635B',
  error: '#BA1A1A',
  errorBg: 'rgba(186,26,26,0.08)',
  success: '#1a6b3a',
  successBg: '#e8f5e9',
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  question:     { bg: '#e8f0ec', color: '#2D4B3E' },
  correction:   { bg: '#fff3e0', color: '#e65100' },
  negative:     { bg: '#fce4ec', color: '#880e4f' },
  suggestion:   { bg: '#e3f2fd', color: '#0d47a1' },
  discussion:   { bg: '#f3e5f5', color: '#4a148c' },
  cooperation:  { bg: '#e8f5e9', color: '#1b5e20' },
  worthless:    { bg: '#f5f5f5', color: '#757575' },
  unclassified: { bg: '#f5f5f5', color: '#9e9e9e' },
};

interface Props {
  comment: Comment;
  onStatusChange: (id: number, status: CommentStatus) => void;
}

export function CommentCard({ comment, onStatusChange }: Props) {
  const [busy, setBusy] = useState(false);
  const catStyle = CATEGORY_COLORS[comment.category] || CATEGORY_COLORS.unclassified;

  const changeStatus = async (status: CommentStatus) => {
    setBusy(true);
    try {
      await api.updateCommentStatus(comment.id, status);
      onStatusChange(comment.id, status);
    } finally {
      setBusy(false);
    }
  };

  const isPending = comment.status === 'pending';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 20,
      border: `1px solid ${C.borderLight}`,
      boxShadow: '0 1px 4px rgba(45,75,62,0.04)',
      transition: 'border-color 0.15s',
      opacity: comment.status === 'ignored' ? 0.65 : 1,
    }}>
      {/* Header: nickname + time + badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
            {comment.nickname || '匿名用户'}
          </span>
          <span style={{ marginLeft: 10, fontSize: 12, color: C.muted }}>
            {comment.comment_time
              ? new Date(comment.comment_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* AI category badge */}
          <span style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: catStyle.bg, color: catStyle.color,
          }}>
            {CATEGORY_LABELS[comment.category]}
          </span>
          {/* Status badge */}
          {comment.status !== 'pending' && (
            <span style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: comment.status === 'replied' ? C.successBg : '#f5f5f5',
              color: comment.status === 'replied' ? C.success : C.muted,
            }}>
              {STATUS_LABELS[comment.status]}
            </span>
          )}
        </div>
      </div>

      {/* Reply indicator */}
      {comment.reply_to_wx_id && (
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
          ↩ 回复了一条留言
        </p>
      )}

      {/* Content */}
      <p style={{
        fontSize: 14, lineHeight: 1.65, color: C.text,
        marginBottom: isPending ? 14 : 0,
        borderLeft: isPending ? `3px solid ${C.primaryLight}` : undefined,
        paddingLeft: isPending ? 12 : 0,
      }}>
        {comment.content}
      </p>

      {/* Actions (only for pending) */}
      {isPending && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => changeStatus('replied')}
            disabled={busy}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: C.primary, color: '#fff', border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            标记已回复
          </button>
          <button
            onClick={() => changeStatus('ignored')}
            disabled={busy}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#EDF1EF', color: C.muted, border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            忽略
          </button>
        </div>
      )}
    </div>
  );
}
