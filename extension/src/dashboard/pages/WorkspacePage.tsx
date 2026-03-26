import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { Article, Comment, CommentStatus } from '../types';
import { CategoryFilter } from '../components/CategoryFilter';
import { CommentCard } from '../components/CommentCard';

const C = {
  primary: '#2D4B3E',
  primaryLight: '#DDE6E1',
  primaryBg: '#e8f0ec',
  surface: '#F9FAFA',
  containerLow: '#EDF1EF',
  white: '#FFFFFF',
  border: '#BFC9C3',
  borderLight: 'rgba(191,201,195,0.3)',
  text: '#191C1B',
  muted: '#56635B',
};

interface Props {
  onLogout: () => void;
}

export function WorkspacePage({ onLogout }: Props) {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const accountName = (location.state as { accountName?: string } | null)?.accountName || '';

  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [category, setCategory] = useState('');
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Load article list
  useEffect(() => {
    if (!accountId) return;
    setArticlesLoading(true);
    api.getArticles(Number(accountId))
      .then((data) => {
        setArticles(data);
        if (data.length > 0) setSelectedArticle(data[0]);
      })
      .catch(() => onLogout())
      .finally(() => setArticlesLoading(false));
  }, [accountId]);

  // Load comments when article or category changes
  const loadComments = useCallback((article: Article | null, cat: string) => {
    if (!article) return;
    setCommentsLoading(true);
    const params = cat ? { category: cat } : undefined;
    api.getComments(article.id, params)
      .then((data) => {
        // Default view hides worthless unless explicitly selected
        setComments(cat ? data : data.filter((c) => c.category !== 'worthless'));
      })
      .catch(() => {/* keep current comments on error */})
      .finally(() => setCommentsLoading(false));
  }, []);

  useEffect(() => {
    loadComments(selectedArticle, category);
  }, [selectedArticle, category]);

  const handleStatusChange = (id: number, status: CommentStatus) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const pendingCount = comments.filter((c) => c.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.surface }}>
      {/* Top nav */}
      <header style={{
        flexShrink: 0, height: 60,
        background: C.white, borderBottom: `1px solid ${C.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1
            onClick={() => navigate('/')}
            style={{ fontSize: 18, fontWeight: 800, color: C.primary, cursor: 'pointer', letterSpacing: '-0.3px' }}
          >
            WeCatch
          </h1>
          <div style={{ width: 1, height: 16, background: C.border }} />
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>
            {`公众号 ${accountName || accountId}`}
          </span>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '6px 14px', fontSize: 13, fontWeight: 600,
            background: C.containerLow, color: C.muted,
            border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer',
          }}
        >
          退出登录
        </button>
      </header>

      {/* Two-column body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left panel: article list */}
        <aside style={{
          width: 280, flexShrink: 0,
          background: C.white, borderRight: `1px solid ${C.borderLight}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 20px 16px',
            borderBottom: `1px solid ${C.borderLight}`,
          }}>
            <button
              onClick={() => navigate('/')}
              style={{
                fontSize: 11, fontWeight: 700, color: C.muted,
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                marginBottom: 10, letterSpacing: '0.5px',
              }}
            >
              ← 所有公众号
            </button>
            <h2 style={{ fontSize: 11, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '1px' }}>
              最近文章
            </h2>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>按文章查看留言</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {articlesLoading ? (
              <p style={{ padding: 12, color: C.muted, fontSize: 13 }}>加载中...</p>
            ) : articles.length === 0 ? (
              <p style={{ padding: 12, color: C.muted, fontSize: 13 }}>暂无文章</p>
            ) : (
              articles.map((article) => {
                const isSelected = selectedArticle?.id === article.id;
                return (
                  <div
                    key={article.id}
                    onClick={() => { setSelectedArticle(article); setCategory(''); }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      marginBottom: 4,
                      background: isSelected ? C.primaryBg : 'transparent',
                      border: isSelected ? `1px solid rgba(45,75,62,0.15)` : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = C.containerLow; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <p style={{
                      fontSize: 13, fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? C.primary : C.text,
                      lineHeight: 1.4, marginBottom: 6,
                    }}>
                      {article.title}
                    </p>
                    <p style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.3px' }}>
                      {article.published_at
                        ? new Date(article.published_at).toLocaleDateString('zh-CN')
                        : ''}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right panel: comments */}
        <main style={{ flex: 1, overflowY: 'auto', background: 'rgba(237,241,239,0.3)' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 40px 40px' }}>

            {selectedArticle ? (
              <>
                {/* Article header */}
                <header style={{
                  marginBottom: 36,
                  paddingBottom: 28,
                  borderBottom: `1px solid ${C.borderLight}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                      <span
                        onClick={() => navigate('/')}
                        style={{ fontSize: 10, fontWeight: 800, color: C.primary, letterSpacing: '1.5px', cursor: 'pointer', textTransform: 'uppercase' }}
                      >
                        公众号
                      </span>
                      <span style={{ fontSize: 12, color: C.muted }}>›</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.primary, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                        留言
                      </span>
                    </div>
                    <h2 style={{
                      fontSize: 28, fontWeight: 800, color: C.text,
                      lineHeight: 1.3, letterSpacing: '-0.5px',
                    }}>
                      {selectedArticle.title}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', paddingBottom: 4 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>总计</p>
                      <p style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{comments.length}</p>
                    </div>
                    <div style={{ width: 1, height: 36, background: C.border }} />
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>待处理</p>
                      <p style={{ fontSize: 28, fontWeight: 800, color: C.primary, lineHeight: 1 }}>{pendingCount}</p>
                    </div>
                  </div>
                </header>

                {/* Category filter */}
                <div style={{ marginBottom: 24 }}>
                  <CategoryFilter selected={category} onChange={setCategory} />
                </div>

                {/* Comments */}
                {commentsLoading ? (
                  <p style={{ color: C.muted }}>加载中...</p>
                ) : comments.length === 0 ? (
                  <div style={{
                    padding: 40, textAlign: 'center', color: C.muted,
                    background: C.white, borderRadius: 12,
                    border: `1px solid ${C.borderLight}`,
                  }}>
                    暂无留言
                  </div>
                ) : (() => {
                  // Build two-level tree: top-level comments with their replies nested below
                  const topLevel = comments.filter((c) => !c.reply_to_wx_id);
                  const repliesMap = new Map<string, typeof comments>();
                  comments.forEach((c) => {
                    if (c.reply_to_wx_id) {
                      const list = repliesMap.get(c.reply_to_wx_id) || [];
                      list.push(c);
                      repliesMap.set(c.reply_to_wx_id, list);
                    }
                  });
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {topLevel.map((comment) => {
                        const replies = repliesMap.get(comment.wx_comment_id) || [];
                        return (
                          <div key={comment.id}>
                            <CommentCard comment={comment} onStatusChange={handleStatusChange} />
                            {replies.length > 0 && (
                              <div style={{
                                marginTop: 4,
                                marginLeft: 20,
                                paddingLeft: 16,
                                borderLeft: '2px solid rgba(45,75,62,0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                paddingTop: 8,
                                paddingBottom: 4,
                              }}>
                                {replies.map((reply) => (
                                  <CommentCard key={reply.id} comment={reply} onStatusChange={handleStatusChange} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: C.muted, paddingTop: 80 }}>
                {articlesLoading ? '加载中...' : '← 从左侧选择一篇文章'}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
