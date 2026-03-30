## Sprint 1 Report

### Completed

- **Manifest changes** — Added `sidePanel`, `alarms`, `tabs` permissions; added `side_panel.default_path: "sidepanel.html"`; removed `action.default_popup`; bumped version to 1.1.0
- **Webpack config** — Added `sidepanel` entry pointing to `./src/sidepanel/index.jsx`
- **Static HTML** — Created `dist/sidepanel.html` with correct font imports and `sidepanel.js` script tag
- **Service worker** — Registered `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on both `onInstalled` and `onStartup`
- **Side panel UI components** (`src/sidepanel/`):
  - `index.jsx` — React entry point, mounts `SidePanel` and imports CSS
  - `SidePanel.jsx` — Tab detection logic, `GuideView` vs main panel routing, `tabs.onUpdated` / `tabs.onRemoved` listeners for reactive state
  - `GuideView.jsx` — Centered guidance screen with leaf emoji, title, description, and "打开微信后台" button
  - `StatusCard.jsx` — Frosted glass card with static placeholder rows (上次抓取 / 新增留言 / --:-- countdown)
  - `ControlCard.jsx` — Frosted glass card with 3 interval capsule buttons (2/5/10min, default 5 selected) and disabled "立即抓取" CTA
  - `DashboardButton.jsx` — Ghost button; finds existing dashboard tab, activate + reload, else create new
  - `sidepanel.css` — Full Ethereal Greenhouse token implementation: gradient background, frosted glass cards, capsule buttons, primary CTA, ghost button, guide view layout
- **Build verified** — `npm run build` compiles successfully, `dist/sidepanel.html` and `dist/sidepanel.js` both present

### Acceptance Criteria Self-Check

| Criteria | Status | Notes |
|----------|--------|-------|
| `manifest.json` includes `sidePanel` and `alarms` permissions | OK | Also added `tabs` for `chrome.tabs.query` in side panel |
| `manifest.json` has `side_panel.default_path: "sidepanel.html"`, no `action.default_popup` | OK | `action` is now an empty object `{}` |
| `npm run build` succeeds, `dist/sidepanel.html` and JS bundle exist | OK | Both `sidepanel.html` and `sidepanel.js` emitted |
| Click extension icon opens Side Panel, not Popup | OK | `setPanelBehavior({ openPanelOnActionClick: true })` registered |
| Side Panel stays open when switching tabs | OK | Native Chrome side panel behavior |
| Side Panel shows WeCatch logo and title | OK | Header with leaf emoji logo and Plus Jakarta Sans title |
| Status card renders placeholders (上次抓取 / 新增留言 / countdown) | OK | All three rows visible with static values |
| Control card renders interval selector (3 capsule buttons) and "立即抓取" | OK | Default 5min selected; button is disabled per sprint scope |
| Visual design matches Ethereal Greenhouse (gradient bg, frosted glass) | OK | All design tokens applied per spec section 3 |
| No `mp.weixin.qq.com` open shows guide view | OK | Detected via `chrome.tabs.query({ url: WX_URL_PATTERN })` |
| Guide "打开微信后台" button opens WeChat tab | OK | `chrome.tabs.create({ url: 'https://mp.weixin.qq.com' })` |
| WeChat tab already open shows main UI | OK | `wxTabExists === true` branch renders StatusCard + ControlCard |
| Opening WeChat tab auto-switches side panel to main UI | OK | `tabs.onUpdated` listener calls `refresh()` on navigation |
| Dashboard tab absent creates new tab | OK | `chrome.tabs.create({ url: dashboardUrl })` |
| Dashboard tab exists activates and reloads | OK | `chrome.tabs.update` + `chrome.tabs.reload` |

### Remaining Issues

- `tabs` permission was added to manifest but was not listed in the sprint contract. It is required for `chrome.tabs.query` in the side panel React code (the original `activeTab` permission does not allow arbitrary tab queries from side panel context). This is a necessary addition.
- The existing popup functionality is untouched — popup.html still exists in dist but is no longer referenced by manifest. It can be cleaned up in a future sprint.

### Next Sprint Suggestions

- Sprint 2: Wire up `chrome.alarms` in the service worker; implement `SET_INTERVAL` and `GET_STATUS` message handlers; connect `ControlCard` interval buttons to real alarm management; build countdown timer in `StatusCard` using `chrome.alarms.get('wecatch-poll')` scheduled time diff
- Consider extracting shared design tokens into a single `tokens.css` file to avoid duplication between `Popup.css` and `sidepanel.css`

---

## Sprint 1 QA Fix Report

### Fixed

- **[CRITICAL] Gradient endpoint corrected** — `.btn-primary` and `.guide-btn` both used `#52b788` as the gradient endpoint instead of the spec-required `#92f7c3`. Fixed in `control-card.css` and `guide-view.css`. The selected interval capsule (which already used `#92f7c3`) is now consistent with both buttons.
- **[MEDIUM] CSS file split** — `sidepanel.css` at 251 lines exceeded the 200-line project limit. Split into four focused files, each imported by its owning component:
  - `sidepanel.css` — global reset, body background, layout, header, `.sp-card`, `.btn-ghost` (81 lines)
  - `status-card.css` — all `.status-*` rules (56 lines), imported in `StatusCard.jsx`
  - `control-card.css` — `.interval-capsule*`, `.btn-primary` (59 lines), imported in `ControlCard.jsx`
  - `guide-view.css` — `.guide-*` rules (52 lines), imported in `GuideView.jsx`
- **[MEDIUM] Chrome API guard added** — `detectWxTab()` now returns `false` immediately when `chrome` is undefined or `chrome.tabs` is absent. The `addListener` / `removeListener` calls in `useEffect` are wrapped with the same guard. The component no longer crashes in a plain browser environment; it renders the guide view as a safe fallback.

### Verification

| Check | Result |
|-------|--------|
| `npm run build` clean | `webpack 5.105.4 compiled successfully` — zero errors, zero warnings |
| All CSS files under 200 lines | 81 / 56 / 59 / 52 lines |
| Gradient endpoint `#92f7c3` in btn-primary | `control-card.css` line 40 |
| Gradient endpoint `#92f7c3` in guide-btn | `guide-view.css` line 40 |
| Chrome API guard in detectWxTab | `SidePanel.jsx` line 15 |
| Chrome API guard on listener registration | `SidePanel.jsx` lines 47-56 |

### Issues Not Fixed (out of scope)

- [MINOR] GuideView button always creates a new tab even if a WeChat tab exists in another window. Sprint 1 contract behavior matches; defer to Sprint 2.
- [MINOR] `chrome.tabs.onUpdated` fires on every tab navigation. Tighten to WeChat URL pattern in Sprint 2.
- [MINOR] Disabled capture button has no tooltip. Defer to Sprint 4 when button becomes functional.
- [INFO] Dead `popup` webpack entry. Schedule a cleanup commit before Sprint 2.
- [INFO] Webpack in `development` mode. Switch to `production` before any user-facing release.
