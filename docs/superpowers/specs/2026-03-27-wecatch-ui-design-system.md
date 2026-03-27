# WeCatch UI Design System: The Ethereal Greenhouse

> Adapted from Stitch "Digital Conservatory" design. This is the implementation reference for Phase 2 (Popup) and Phase 3 (Dashboard).

---

## 1. Design Philosophy

**"The Digital Conservatory"** — an organic, breathing interface that feels like nature captured behind frosted glass. Depth comes from tonal layering, not borders. White space is intentional. Every element should feel approachable and premium.

**Core rules:**
- Never use 1px solid borders. Use background color shifts for separation.
- Never use pure black. Use `on-surface` (#1f3731) for all text.
- Never use 90-degree corners. Minimum radius is `radius-sm` (8px).
- No standard drop shadows. Use ambient diffused shadows only.

---

## 2. Color Tokens

### Surface Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `surface` | #effcf7 | Page / popup background base |
| `surface-container-low` | #e6f8f1 | Sidebar, section backgrounds |
| `surface-container` | #ddf2ec | Hover states, selected backgrounds |
| `surface-container-lowest` | #ffffff | Cards (70% opacity + blur) |
| `surface-bright` | #f5fef9 | List item hover |

### Brand & Text

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | #006d48 | Icons, active states, ghost button text |
| `primary-container` | #92f7c3 | Gradient end, badge backgrounds |
| `on-primary` | #ffffff | Text on primary buttons |
| `on-surface` | #1f3731 | Primary text |
| `on-surface-variant` | #4b645e | Secondary text, timestamps, metadata |
| `outline-variant` | #9db8b0 | Ghost borders at 15% opacity only |

### Sidebar (Deep Green)

| Token | Value | Usage |
|-------|-------|-------|
| `sidebar-bg` | #1a3a2e | Left sidebar background |
| `sidebar-text` | #c8ead8 | Sidebar nav text (unselected) |
| `sidebar-active-bg` | #006d48 | Selected nav item fill |
| `sidebar-active-text` | #ffffff | Selected nav item text |

### Category Badge Colors

| Category | Background | Text |
|----------|-----------|------|
| 提问 | #e0f2fe | #0369a1 |
| 负面 | #fee2e2 | #b91c1c |
| 建议 | #fef9c3 | #854d0e |
| 讨论 | #ede9fe | #6d28d9 |
| 赞扬 | #dcfce7 | #15803d |
| 合作 | #fff7ed | #c2410c |
| 未分类 | #f1f5f9 | #475569 |
| 无价值 | #f1f5f9 | #94a3b8 |

---

## 3. Typography

**Font families:**
- Headlines / Display: **Plus Jakarta Sans**
- Body / Labels: **Manrope**

| Role | Font | Size | Weight | Letter-spacing |
|------|------|------|--------|----------------|
| `headline-sm` | Plus Jakarta Sans | 24px / 1.5rem | 700 | -0.02em |
| `title-md` | Plus Jakarta Sans | 16px / 1rem | 600 | -0.01em |
| `title-sm` | Plus Jakarta Sans | 14px / 0.875rem | 600 | 0 |
| `body-md` | Manrope | 14px / 0.875rem | 400 | 0 |
| `body-sm` | Manrope | 13px / 0.8125rem | 400 | 0 |
| `label-sm` | Manrope | 11px / 0.6875rem | 500 | 0.01em |

---

## 4. Spacing

Base unit: 4px.

| Name | Value | Usage |
|------|-------|-------|
| `spacing-1` | 4px | Icon gap, tight inline |
| `spacing-2` | 8px | Tight grouping within a card |
| `spacing-3` | 12px | List item padding vertical |
| `spacing-4` | 16px | Card padding, section gap |
| `spacing-6` | 24px | Between sections |
| `spacing-8` | 32px | Large section breaks |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8px | Badges, small elements |
| `radius-md` | 16px | Buttons, inputs, list items |
| `radius-lg` | 24px | Cards, panels, modals |
| `radius-full` | 9999px | Pills, avatars, glass capsule |

---

## 6. Elevation & Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-ambient` | 0px 8px 24px rgba(31,55,49,0.06) | Cards |
| `shadow-modal` | 0px 16px 48px rgba(31,55,49,0.12) | Modals, export dialog |

**Frosted glass card:**
```css
background: rgba(255, 255, 255, 0.70);
backdrop-filter: blur(12px);
border-radius: 24px;
box-shadow: 0px 8px 24px rgba(31, 55, 49, 0.06);
```

---

## 7. Component Specs

### Buttons

**Primary (CTA):**
```css
background: linear-gradient(135deg, #006d48, #92f7c3);
color: #ffffff;
font: Manrope 14px 600;
padding: 12px 24px;
border-radius: 16px;
border: none;
```

**Secondary:**
```css
background: #ddf2ec;
color: #1f3731;
font: Manrope 14px 500;
padding: 10px 20px;
border-radius: 16px;
border: none;
```

**Ghost:**
```css
background: transparent;
color: #006d48;
font: Manrope 14px 500;
padding: 8px 16px;
border-radius: 16px;
border: none;
```
Use for low-emphasis actions (e.g., "取消", "打开数据看板").

---

### Category Badge (Pill)

```css
display: inline-flex;
padding: 2px 10px;
border-radius: 9999px;
font: Manrope 11px 500;
/* color and background per category table */
```

**Filter pill selected state:** filled per category color.
**Filter pill unselected state:** `surface-container` background + `on-surface-variant` text.

---

### Letter Avatar

```css
width: 32px;
height: 32px;
border-radius: 9999px;
background: #92f7c3;
color: #006d48;
font: Plus Jakarta Sans 14px 600;
display: flex;
align-items: center;
justify-content: center;
```

Content: first character of nickname. No profile image fetch (deferred to next version).

Small variant (for replies): 24px × 24px, font 12px.

---

### Article List Item (Popup & Dashboard Sidebar)

```
[ checkbox / selected indicator ]  Article title          [N条]
```

```css
padding: 12px 16px;
border-radius: 16px;
background: transparent;
cursor: pointer;

/* hover */
background: #f5fef9;

/* selected */
background: #ddf2ec;
border-left: 3px solid #006d48;
```

Title: `title-sm`, `on-surface` (#1f3731) — **except in the Dashboard sidebar** where text is `sidebar-text` (#c8ead8) and selected item text is `sidebar-active-text` (#ffffff).
Comment count badge: `label-sm`, background `surface-container`, `radius-full`, padding 2px 8px.

---

### Comment Card

```
[ Avatar ]  Nickname            timestamp  [ Category Badge ]
            Comment content text...
            [ N条回复 ▾ ]   (only if replies exist)
```

```css
background: rgba(255, 255, 255, 0.70);
backdrop-filter: blur(12px);
border-radius: 24px;
padding: 16px;
box-shadow: 0px 8px 24px rgba(31,55,49,0.06);
margin-bottom: 12px;
```

- Nickname: `title-sm`, `on-surface`
- Timestamp: `label-sm`, `on-surface-variant`, right-aligned
- Content: `body-md`, `on-surface`
- "N条回复" button: ghost style, `label-sm`

---

### Reply (Expanded Under Comment)

```css
margin-left: 40px;
background: #e6f8f1;
border-radius: 16px;
padding: 12px 16px;
margin-top: 8px;
```

Avatar: small variant (24px). Font same scale as comment card.

---

### Filter Pills Bar

```css
display: flex;
gap: 8px;
flex-wrap: wrap;
align-items: center;
margin-bottom: 16px;
```

Right side: sort toggle ghost button ("最新优先 ↕").

---

### Export Modal

```
Overlay: rgba(31, 55, 49, 0.4)

Modal card:
  background: rgba(255,255,255,0.92)
  backdrop-filter: blur(20px)
  border-radius: 24px
  padding: 24px
  max-width: 480px
  box-shadow: 0px 16px 48px rgba(31,55,49,0.12)

  Header: "导出数据" (title-md)
  Article checklist (same style as popup list)
  Footer row:
    Left: "全选" checkbox
    Right: Primary button "导出（N篇）" — N updates reactively
```

---

## 8. Layout Specs

### Popup (320px wide)

```
Background: linear-gradient(160deg, #effcf7, #ddf2ec)

Outer container: padding 16px

Frosted glass card:
  background: rgba(255,255,255,0.70)
  backdrop-filter: blur(12px)
  border-radius: 24px
  padding: 16px

Header row:
  Left: leaf icon + "WeCatch" (headline-sm, primary)
  Right: settings icon (on-surface-variant)

"全选" row:
  padding: 8px 0
  border-bottom via background shift (no line)

Article list:
  max-height: 240px
  overflow-y: auto
  gap: 4px between items

Bottom area (always visible):
  Primary button "开始抓取" — full width
  Ghost button "打开数据看板" — full width, below
```

---

### Dashboard (Full width)

```
Background: linear-gradient(160deg, #effcf7 0%, #ddf2ec 100%)

Left sidebar: 260px, fixed height, background #1a3a2e
  Logo area: 64px, WeCatch title (white)
  Article list: scrollable, gap 4px between items
  Export icon button: top-right of sidebar header

Right content area: flex-1, padding 24px
  Filter pills bar: top
  Sort toggle: right-aligned in same row
  Comment list: scrollable, gap 12px between cards
```
