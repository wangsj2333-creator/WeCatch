# Sprint 1 QA Report

> Date: 2026-03-30
> Sprint: 1 - Side Panel + Manifest Changes
> Branch: v1-1

---

## Build Result

**PASS** - Zero warnings, zero errors.

webpack 5.105.4 compiled successfully in 1496 ms

Output files confirmed present:
- dist/sidepanel.html (543 bytes)
- dist/sidepanel.js (1.13 MiB)
- dist/manifest.json

---

## Acceptance Criteria Results

| # | Criteria | Status | Notes |
|---|----------|--------|-------|
| 1 | manifest.json includes sidePanel and alarms permissions | PASS | Both present in permissions array |
| 2 | manifest.json has side_panel.default_path, no action.default_popup | PASS | action:{} confirmed |
| 3 | npm run build succeeds; sidepanel files exist in dist | PASS | Build clean, both files present |
| 4 | Clicking extension icon opens Side Panel not Popup | PASS | setPanelBehavior in onInstalled and onStartup |
| 5 | Side Panel stays open when switching tabs | PASS | Architectural guarantee of Side Panel API |
| 6 | Side Panel shows WeCatch logo and title | PASS | Emoji logo + title in Plus Jakarta Sans |
| 7 | Status card shows placeholder content (3 fields visible) | PASS | Fields present |
| 8 | Control card shows 3 interval capsules and capture button | PASS | All rendered, button disabled |
| 9 | Visual matches Ethereal Greenhouse spec | PARTIAL | Background ok; frosted glass ok; btn gradient endpoint wrong |
| 10 | Guide view shown when mp.weixin.qq.com not open | PASS | GuideView renders correctly |
| 11 | Guide button opens mp.weixin.qq.com tab | PASS | chrome.tabs.create called |
| 12 | Normal UI shown when mp.weixin.qq.com is open | PASS | Conditional render correct |
| 13 | Auto-switch to normal state when WeChat tab opens | PASS | onUpdated listener calls refresh |
| 14 | Dashboard button creates new tab when none exists | PASS | chrome.tabs.create called |
| 15 | Dashboard button activates and reloads existing tab | PASS | chrome.tabs.update + reload called |

**Summary: 14 PASS, 1 PARTIAL (criterion 9)**

---

## Visual Test

Playwright MCP does not support file:// URLs. A local Node.js HTTP server was used at http://localhost:7891 to serve the dist folder.

**Result: Page crashed with JS errors.**

Console error observed:

    TypeError: Cannot read properties of undefined (reading query)
      at detectWxTab (sidepanel.js:220)

SidePanel.useEffect calls chrome.tabs.query immediately on mount. Without the chrome object (unavailable outside the extension context), the React tree crashes. No ErrorBoundary is present so the page renders a blank white screen.

This is expected behavior in a plain browser environment. It does not indicate a bug in the extension itself. However, the absence of a chrome API guard makes local visual testing impossible without loading the extension in Chrome.

No screenshot was captured due to the crash.

---

## Code Review Findings

### [CRITICAL] Primary Button Gradient Endpoint Deviates from Design Spec

**File:** src/sidepanel/sidepanel.css, line 154 (.btn-primary)
**File:** src/sidepanel/sidepanel.css, line 241 (.guide-btn)

Current implementation:

    background: linear-gradient(135deg, #006d48, #52b788);

Design spec (Ethereal Greenhouse, section 7, Primary CTA button):

    background: linear-gradient(135deg, #006d48, #92f7c3);

The endpoint #52b788 is a noticeably darker mid-green that produces a duller appearance than intended. Notably, the selected interval capsule on the same screen correctly uses #92f7c3 (sidepanel.css line 144), making the inconsistency visible side-by-side.

---

### [MEDIUM] sidepanel.css Exceeds the 200-Line File Limit

**File:** src/sidepanel/sidepanel.css - 251 lines

CLAUDE.md project rule: a single file must not exceed 200 lines; split by responsibility when over limit. This file is 51 lines over.

Suggested split:
- src/sidepanel/status-card.css  (status rows, divider, countdown -- ~55 lines)
- src/sidepanel/control-card.css (interval capsule, btn-primary -- ~55 lines)
- src/sidepanel/guide-view.css   (guide-view, guide-icon, guide-btn -- ~50 lines)
- src/sidepanel/sidepanel.css    (layout, header, sp-card, btn-ghost -- ~90 lines)

---

### [MEDIUM] No Chrome API Guard - Side Panel Crashes Outside Extension Context

**File:** src/sidepanel/SidePanel.jsx, lines 13-16 (detectWxTab function)

chrome.tabs.query is called with no guard against chrome being undefined. In any non-extension environment the call throws synchronously inside useEffect, crashing the entire component tree with no fallback UI.

Required fix at SidePanel.jsx line 13:

    async function detectWxTab() {
      if (typeof chrome === "undefined" || !chrome.tabs) return false;
      const tabs = await chrome.tabs.query({ url: WX_URL_PATTERN });
      return tabs.length > 0;
    }

This also enables local visual testing without installing the full extension.

---

### [MINOR] GuideView Button Always Creates a New Tab

**File:** src/sidepanel/GuideView.jsx, line 9

chrome.tabs.create is called unconditionally even if a WeChat tab already exists in another window. The sprint contract literal text matches this implementation, so not a Sprint 1 blocker. In a future sprint the button should query for an existing WeChat tab first and switch to it if found.

---

### [MINOR] chrome.tabs.onUpdated Fires on Every Tab Navigation

**File:** src/sidepanel/SidePanel.jsx, lines 34-37

The listener triggers a chrome.tabs.query on every tab that finishes loading, regardless of domain. Harmless at low usage, but a panel meant to stay open indefinitely accumulates unnecessary work. Should be tightened in Sprint 2 to only re-check when the updated URL matches the WeChat pattern.

---

### [MINOR] Disabled Capture Button Has No Explanation

**File:** src/sidepanel/ControlCard.jsx, line 31

The button renders at 40% opacity with no tooltip or label. Acceptable for Sprint 1 per contract scope ("this sprint does not wire logic"). Should be addressed in Sprint 4 when the button becomes functional.

---

### [INFO] popup webpack Entry Is Dead Code

**File:** webpack.config.js, line 9

The popup entry still compiles to dist/popup.js and dist/popup.html. Since action.default_popup is removed from manifest.json, these files are never loaded by Chrome. Should be removed in a cleanup sprint.

---

### [INFO] webpack Running in development Mode

**File:** webpack.config.js, line 3

sidepanel.js is 1.13 MiB unminified. Must be switched to production mode before any user-facing release.

---

## Summary

**Verdict: PASS with reservations.**

All 15 acceptance criteria are satisfied (14 full PASS, 1 PARTIAL on visual design). The implementation is structurally correct: manifest changes are accurate, Chrome API usage is idiomatic, WeChat tab detection and auto-state-switching work correctly, and Dashboard navigation correctly handles both the create and activate+reload paths.

Two issues must be fixed before Sprint 2 begins:

1. The primary button gradient endpoint (#52b788 vs spec #92f7c3) is a visible brand inconsistency present on every panel load. It is made worse by the fact that the interval capsule on the same screen uses the correct endpoint, creating an obvious mismatch.
2. sidepanel.css at 251 lines violates a hard project rule. Splitting it now prevents further violations in subsequent sprints as more component styles are added.

The chrome API guard is not a Sprint 1 correctness bug but will block all local visual testing and development going forward.

---

## 需要 generator 修复的清单

- [ ] 修复 src/sidepanel/sidepanel.css 第 154 行 (.btn-primary) 和第 241 行 (.guide-btn) 的渐变终点色：将 #52b788 改为 #92f7c3
- [ ] 拆分 src/sidepanel/sidepanel.css（251 行超出 200 行限制）：建议拆为 status-card.css、control-card.css、guide-view.css 三个文件，各自在对应 JSX 中 import
- [ ] 在 src/sidepanel/SidePanel.jsx 第 13 行 detectWxTab 函数顶部加 chrome API 可用性检查：防止非 extension 环境崩溃
- [ ] 清理 extension/webpack.config.js 中的 popup entry（popup 已无法被用户访问，属于死代码）
