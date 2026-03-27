# Phase 3: Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Dashboard from a flat single-column layout into a left-right split panel with article selection, reply folding, filter pills, export modal, and the Ethereal Greenhouse visual design system.

**Architecture:** All state lives in `Dashboard.jsx`. Child components receive props only — no component-level data fetching. Data comes from `chrome.storage.session` (already in place). Layout: 260px left sidebar (dark green) + flex-1 right content area.

**Tech Stack:** React (JSX), inline styles + CSS file, existing `export.js` (xlsx), `categories.js`

**Spec:** `docs/superpowers/specs/2026-03-27-wecatch-v1-final-design.md`, `docs/superpowers/specs/2026-03-27-wecatch-ui-design-system.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `extension/src/dashboard/Dashboard.jsx` | Modify | Root layout: left-right split, article selection state, sort state, filter state, export modal toggle |
| `extension/src/dashboard/Dashboard.css` | Create | All Ethereal Greenhouse design tokens and layout styles |
| `extension/src/dashboard/components/ArticleList.jsx` | Create | Left sidebar article list: title + comment count, click to select |
| `extension/src/dashboard/components/CommentList.jsx` | Modify | Render top-level comments with collapsed replies; expand/collapse on click |
| `extension/src/dashboard/components/FilterBar.jsx` | Modify | Category filter pills (multi-select) + sort toggle button |
| `extension/src/dashboard/components/ExportModal.jsx` | Create | Export dialog: article checklist, "全选", "导出（N篇）" primary button |

> **Note:** `categories.js` and `export.js` are unchanged.

---

## Task D1: Left-Right Layout + Article Selection

**Files:**
- Modify: `extension/src/dashboard/Dashboard.jsx`
- Create: `extension/src/dashboard/components/ArticleList.jsx`

**What it does:** Replace the current single-column `<div>` with a two-column layout. Left side shows the article list; right side shows comments for the selected article. No styling yet — plain HTML structure only.

**Data shape reminder:** `articles` is an array. Each element has:
- `article.title` — the article title
- `article.url` — the article URL
- `comments` — array of comment objects (top-level and replies mixed)
- A comment is a reply if it has `reply_to_wx_id` set

- [ ] **Step 1: Create ArticleList component (plain, no styles)**

Create `extension/src/dashboard/components/ArticleList.jsx`:

```jsx
import React from 'react';

// articles: array of article objects from session storage
// selectedIdx: index of currently selected article (integer)
// onSelect: (idx) => void
export default function ArticleList({ articles, selectedIdx, onSelect }) {
  return (
    <div>
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
```

- [ ] **Step 2: Rewrite Dashboard.jsx with two-column layout**

Replace the content of `extension/src/dashboard/Dashboard.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import FilterBar from './components/FilterBar';
import CommentList from './components/CommentList';
import ArticleList from './components/ArticleList';
import { exportToExcel } from './export';

const DEFAULT_CATS = ['question','correction','negative','suggestion','discussion','cooperation','unclassified'];

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_CATS);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    chrome.storage.session.get('wecatchResults', (data) => {
      setArticles(data.wecatchResults || []);
    });
  }, []);

  const toggleFilter = (cat) => {
    setActiveFilters(f =>
      f.includes(cat) ? f.filter(c => c !== cat) : [...f, cat]
    );
  };

  const currentArticle = articles[selectedIdx];
  const allComments = currentArticle ? (currentArticle.comments || []) : [];

  // Top-level comments that pass the category filter
  const visibleTopIds = new Set(
    allComments
      .filter(c => !c.reply_to_wx_id && activeFilters.includes(c.category))
      .map(c => c.wx_comment_id)
  );

  // Collect top-level comments + their replies
  const topLevel = allComments
    .filter(c => !c.reply_to_wx_id && visibleTopIds.has(c.wx_comment_id));

  const sortedTopLevel = [...topLevel].sort((a, b) => {
    const diff = new Date(a.comment_time) - new Date(b.comment_time);
    return sortOrder === 'newest' ? -diff : diff;
  });

  const repliesFor = (wx_comment_id) =>
    allComments.filter(c => c.reply_to_wx_id === wx_comment_id);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left sidebar */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' }}>
          <span>WeCatch</span>
          <button onClick={() => setShowExportModal(true)}>导出</button>
        </div>
        <ArticleList
          articles={articles}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <FilterBar
          active={activeFilters}
          onChange={toggleFilter}
          sortOrder={sortOrder}
          onSortChange={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
        />
        <CommentList comments={sortedTopLevel} repliesFor={repliesFor} />
      </div>

      {showExportModal && (
        <div>Export modal placeholder</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Load extension and verify layout**

In Chrome: `chrome://extensions` → reload the extension → open Popup → click "打开数据看板".

Expected: Two-column layout visible. Left shows article titles with comment counts. Clicking an article changes the right side. Sort and filter still work (no visual polish yet).

- [ ] **Step 4: Commit**

```bash
git add extension/src/dashboard/Dashboard.jsx extension/src/dashboard/components/ArticleList.jsx
git commit -m "feat(dashboard): two-column layout with article selection"
```

---

## Task D2: Reply Folding in CommentList

**Files:**
- Modify: `extension/src/dashboard/components/CommentList.jsx`

**What it does:** Rewrite CommentList so each top-level comment shows its replies collapsed by default. A "N条回复" button toggles expand/collapse. `repliesFor` is a function passed from Dashboard.

- [ ] **Step 1: Rewrite CommentList.jsx**

```jsx
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
```

- [ ] **Step 2: Verify in browser**

Open dashboard with articles that have replies. Expected: replies collapsed by default, "N条回复" button appears, clicking expands/collapses correctly.

- [ ] **Step 3: Commit**

```bash
git add extension/src/dashboard/components/CommentList.jsx
git commit -m "feat(dashboard): reply collapse/expand in comment list"
```

---

## Task D3: Filter Pills + Sort Button

**Files:**
- Modify: `extension/src/dashboard/components/FilterBar.jsx`

**What it does:** Replace checkbox-based filters with pill buttons. Add a sort toggle button on the right. Props: `active` (string[]), `onChange` (cat => void), `sortOrder` ('newest'|'oldest'), `onSortChange` (() => void).

**Design reference:** See `docs/superpowers/specs/2026-03-27-wecatch-ui-design-system.md` §7 "Filter Pills Bar".

Category pill colors from design spec:
```
question:    bg #e0f2fe  text #0369a1
correction:  bg #fee2e2  text #b91c1c  (reuse negative)
negative:    bg #fee2e2  text #b91c1c
suggestion:  bg #fef9c3  text #854d0e
discussion:  bg #ede9fe  text #6d28d9
cooperation: bg #fff7ed  text #c2410c
worthless:   bg #f1f5f9  text #94a3b8
unclassified:bg #f1f5f9  text #475569
```

- [ ] **Step 1: Rewrite FilterBar.jsx with pills**

```jsx
import React from 'react';
import { CATEGORIES } from '../categories';

// NOTE: 'correction' is not in the UI spec's color table; reusing 'negative' colors by decision.
// 'praise' appears in the spec color table but has no key in categories.js — omitted here.
const PILL_COLORS = {
  question:     { bg: '#e0f2fe', text: '#0369a1' },
  correction:   { bg: '#fee2e2', text: '#b91c1c' }, // reuses negative colors (undocumented in spec)
  negative:     { bg: '#fee2e2', text: '#b91c1c' },
  suggestion:   { bg: '#fef9c3', text: '#854d0e' },
  discussion:   { bg: '#ede9fe', text: '#6d28d9' },
  cooperation:  { bg: '#fff7ed', text: '#c2410c' },
  worthless:    { bg: '#f1f5f9', text: '#94a3b8' },
  unclassified: { bg: '#f1f5f9', text: '#475569' },
};

// Inactive: surface-container (#ddf2ec) bg + on-surface-variant (#4b645e) text
const INACTIVE_STYLE = { bg: '#ddf2ec', text: '#4b645e' };

export default function FilterBar({ active, onChange, sortOrder, onSortChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      {Object.entries(CATEGORIES).map(([key, label]) => {
        const isActive = active.includes(key);
        const colors = isActive ? PILL_COLORS[key] : INACTIVE_STYLE;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display: 'inline-flex',
              padding: '2px 10px',
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'Manrope, sans-serif',
              background: colors.bg,
              color: colors.text,
            }}
          >
            {label}
          </button>
        );
      })}
      <button
        onClick={onSortChange}
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#006d48',
          fontSize: 13,
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 500,
        }}
      >
        {sortOrder === 'newest' ? '最新优先 ↕' : '最早优先 ↕'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Expected: Pill buttons visible, clicking toggles active/inactive states. Sort toggle button on the right, clicking switches between newest/oldest order.

- [ ] **Step 3: Commit**

```bash
git add extension/src/dashboard/components/FilterBar.jsx
git commit -m "feat(dashboard): category filter pills + sort toggle"
```

---

## Task D4: Export Modal

**Files:**
- Create: `extension/src/dashboard/components/ExportModal.jsx`
- Modify: `extension/src/dashboard/Dashboard.jsx` (replace placeholder with `<ExportModal>`)

**What it does:** A modal overlay with a checklist of all articles. "全选" checkbox at the bottom-left. Primary button shows "导出（N篇）" — N updates reactively as user checks/unchecks. On confirm, calls `exportToExcel` with selected articles only (full comments, not filtered).

**Design reference:** See `docs/superpowers/specs/2026-03-27-wecatch-ui-design-system.md` §7 "Export Modal".

- [ ] **Step 1: Create ExportModal.jsx**

```jsx
import React, { useState } from 'react';
import { exportToExcel } from '../export';

// articles: full articles array
// onClose: () => void
export default function ExportModal({ articles, onClose }) {
  const [checked, setChecked] = useState(() => new Set(articles.map((_, i) => i)));

  const toggle = (idx) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const allChecked = checked.size === articles.length;
  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(articles.map((_, i) => i)));
  };

  const handleExport = () => {
    const selected = articles.filter((_, i) => checked.has(i));
    exportToExcel(selected);
    onClose();
  };

  return (
    // Overlay
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(31, 55, 49, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        padding: 24,
        maxWidth: 480,
        width: '90%',
        boxShadow: '0px 16px 48px rgba(31,55,49,0.12)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 600, color: '#1f3731' }}>
          导出数据
        </h3>

        {/* Article checklist */}
        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {articles.map((a, idx) => {
            const topLevelCount = (a.comments || []).filter(c => !c.reply_to_wx_id).length;
            return (
              <label
                key={a.article.url}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: checked.has(idx) ? '#ddf2ec' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked.has(idx)}
                  onChange={() => toggle(idx)}
                />
                <span style={{ flex: 1, fontSize: 13, color: '#1f3731', fontFamily: 'Manrope, sans-serif' }}>
                  {a.article.title}
                </span>
                <span style={{
                  fontSize: 11, color: '#4b645e', fontFamily: 'Manrope, sans-serif',
                  background: '#ddf2ec', borderRadius: 9999, padding: '2px 8px',
                }}>
                  {topLevelCount}条
                </span>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1f3731', fontFamily: 'Manrope, sans-serif', cursor: 'pointer' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            全选
          </label>
          <button
            onClick={handleExport}
            disabled={checked.size === 0}
            style={{
              background: checked.size === 0 ? '#ddf2ec' : 'linear-gradient(135deg, #006d48, #92f7c3)',
              color: checked.size === 0 ? '#9db8b0' : '#ffffff',
              border: 'none',
              borderRadius: 16,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'Manrope, sans-serif',
              cursor: checked.size === 0 ? 'default' : 'pointer',
            }}
          >
            导出（{checked.size}篇）
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire ExportModal into Dashboard.jsx**

In `Dashboard.jsx`, replace the placeholder `<div>Export modal placeholder</div>` with:

```jsx
import ExportModal from './components/ExportModal';

// ... inside JSX, replace placeholder:
{showExportModal && (
  <ExportModal
    articles={articles}
    onClose={() => setShowExportModal(false)}
  />
)}
```

Also add the import at the top of `Dashboard.jsx`.

- [ ] **Step 3: Verify in browser**

Click the "导出" button in the sidebar header. Expected: modal overlay appears, all articles pre-checked, unchecking updates the count, "全选" toggles all, Export downloads file with only selected articles, clicking outside modal closes it.

- [ ] **Step 4: Commit**

```bash
git add extension/src/dashboard/components/ExportModal.jsx extension/src/dashboard/Dashboard.jsx
git commit -m "feat(dashboard): export modal with article selection"
```

---

## Task D5: Ethereal Greenhouse Visual Styling

**Files:**
- Create: `extension/src/dashboard/Dashboard.css`
- Modify: `extension/src/dashboard/Dashboard.jsx` (add CSS import + class names)
- Modify: `extension/src/dashboard/components/ArticleList.jsx` (apply styles)
- Modify: `extension/src/dashboard/components/CommentList.jsx` (apply styles)

**Design reference:** `docs/superpowers/specs/2026-03-27-wecatch-ui-design-system.md` — full document is the reference.

**Font import note:** Fonts are loaded via `@import url(...)` at the top of `Dashboard.css` (see Step 5). Do NOT edit `dashboard.html` — it is a build artifact.

- [ ] **Step 1: Create Dashboard.css with design tokens**

Create `extension/src/dashboard/Dashboard.css`:

```css
/* Ethereal Greenhouse — WeCatch Design System */

/* === LAYOUT === */
.dashboard-root {
  display: flex;
  height: 100vh;
  background: linear-gradient(160deg, #effcf7 0%, #ddf2ec 100%);
  font-family: 'Manrope', sans-serif;
  color: #1f3731;
}

/* === LEFT SIDEBAR === */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: #1a3a2e;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 16px 12px;
  flex-shrink: 0;
}

.sidebar-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.02em;
  margin: 0;
}

.sidebar-export-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #c8ead8;
  font-size: 18px;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}
.sidebar-export-btn:hover {
  background: rgba(255,255,255,0.1);
}

.sidebar-article-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 16px;
}

/* === ARTICLE LIST ITEM === */
.article-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;
}
.article-item:hover {
  background: rgba(255,255,255,0.08);
}
.article-item.selected {
  background: #006d48;
  border-left: 3px solid #92f7c3;
  padding-left: 9px;
}
.article-item-title {
  font-family: 'Manrope', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  color: #c8ead8;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}
.article-item.selected .article-item-title {
  color: #ffffff;
}
.article-item-count {
  font-family: 'Manrope', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #c8ead8;
  background: rgba(255,255,255,0.12);
  border-radius: 9999px;
  padding: 2px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
.article-item.selected .article-item-count {
  background: rgba(255,255,255,0.2);
  color: #ffffff;
}

/* === RIGHT CONTENT AREA === */
.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* === COMMENT CARD === */
.comment-card {
  background: rgba(255, 255, 255, 0.70);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 16px;
  box-shadow: 0px 8px 24px rgba(31, 55, 49, 0.06);
  margin-bottom: 12px;
}

.comment-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  background: #92f7c3;
  color: #006d48;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.comment-nickname {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f3731;
  flex: 1;
}

.comment-timestamp {
  font-family: 'Manrope', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #4b645e;
  letter-spacing: 0.01em;
}

.comment-content {
  font-family: 'Manrope', sans-serif;
  font-size: 0.875rem;
  color: #1f3731;
  line-height: 1.5;
  margin-bottom: 8px;
}

/* Reply section */
.reply-toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #006d48;
  font-family: 'Manrope', sans-serif;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 16px;
}
.reply-toggle-btn:hover {
  background: #ddf2ec;
}

.reply-card {
  margin-left: 40px;
  background: #e6f8f1;
  border-radius: 16px;
  padding: 12px 16px;
  margin-top: 8px;
}

.reply-avatar {
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  background: #92f7c3;
  color: #006d48;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* === EMPTY STATE === */
.empty-state {
  text-align: center;
  color: #4b645e;
  font-family: 'Manrope', sans-serif;
  padding: 48px 16px;
}
```

- [ ] **Step 2: Apply CSS classes to Dashboard.jsx**

Update the JSX in `Dashboard.jsx` to use class names from Dashboard.css:

```jsx
import './Dashboard.css';

// In the return:
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
        active={activeFilters}
        onChange={toggleFilter}
        sortOrder={sortOrder}
        onSortChange={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
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
```

- [ ] **Step 3: Apply CSS classes to ArticleList.jsx**

Update `ArticleList.jsx` to use class names:

```jsx
import React from 'react';

export default function ArticleList({ articles, selectedIdx, onSelect }) {
  return (
    <div>
      {articles.map((a, idx) => {
        const topLevelCount = (a.comments || []).filter(c => !c.reply_to_wx_id).length;
        const isSelected = idx === selectedIdx;
        return (
          <div
            key={a.article.url}
            className={`article-item${isSelected ? ' selected' : ''}`}
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
```

- [ ] **Step 4: Apply CSS classes to CommentList.jsx**

Update `CommentList.jsx` to use class names:

```jsx
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
            <div key={r.wx_comment_id} className="reply-card"> {/* padding: 12px 16px from CSS */}
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
```

- [ ] **Step 5: Add font import to Dashboard.css**

> **Note:** `dashboard.html` is a build artifact in `dist/` — do NOT edit it directly. Instead, add the Google Fonts `@import` at the **very top** of `Dashboard.css` (before all other rules):

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Manrope:wght@400;500;600&display=swap');
```

- [ ] **Step 6: Build and verify full visual**

```bash
cd extension && npm run build
```

Open dashboard in Chrome. Verify:
- Dark green left sidebar with white "WeCatch" title
- Article items show with correct hover/selected states (dark green highlight + border)
- Right area has gradient background
- Comment cards are frosted glass (white 70% opacity)
- Category badges show correct colors
- Reply toggle button works, replies show in light green indented cards
- Filter pills show correct colors (active = category color, inactive = grey-green)
- Sort toggle right-aligned
- Export modal has glass card style

- [ ] **Step 7: Commit**

```bash
git add extension/src/dashboard/Dashboard.css extension/src/dashboard/Dashboard.jsx extension/src/dashboard/components/ArticleList.jsx extension/src/dashboard/components/CommentList.jsx
git commit -m "feat(dashboard): apply Ethereal Greenhouse design system"
```

> **Note:** `FilterBar.jsx` is NOT modified in this task — its styling (inline styles) was fully applied in Task D3.

---

## Execution Order

```
D1 (layout + article selection)
  ↓
D2 (reply folding)        D3 (filter pills + sort)
  ↓                             ↓
D4 (export modal)
  ↓
D5 (full styling)
```

D2 and D3 can be done in parallel after D1. D4 requires D1. D5 is done last (applies styles to everything).
