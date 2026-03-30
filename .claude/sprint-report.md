## Sprint 2 报告

### 已完成

- **Service Worker alarm 管理**：`onInstalled` / `onStartup` 时调用 `ensureAlarm()` 创建 `wecatch-poll` alarm（默认 5 分钟）；`SET_INTERVAL` 消息触发 `resetAlarm()`，清除旧 alarm 并创建新 alarm，同时写入 `chrome.storage.local.wecatch_interval`
- **Service Worker 休眠恢复保障**：`chrome.alarms.onAlarm` 处理开始前调用 `ensureAlarm()`，确保 alarm 被系统回收后自动重建
- **抓取锁机制**：alarm 触发时读取 `wecatch_is_capturing`，锁存在时跳过并 log
- **GET_STATUS 消息**：返回 `{ lastRun, newCount, nextAlarmTime }`，`nextAlarmTime` 直接取自 `chrome.alarms.get('wecatch-poll').scheduledTime`
- **POLL_DONE 广播**：alarm 触发后广播 `POLL_DONE`，携带 storage 中的当前值（Sprint 2 无真实抓取）
- **useStatus hook**（`src/sidepanel/useStatus.js`）：提升状态到共享 hook，管理 `lastRun`、`newCount`、`countdown`、`interval`；倒计时用 `setInterval(1000)` 每秒更新；监听 `POLL_DONE` 自动刷新
- **StatusCard 接入真实数据**：由 SidePanel 通过 props 驱动，不再自行管理状态；相对时间格式化（刚刚 / N 分钟前 / N 小时前 / 尚未抓取）
- **ControlCard 接入真实逻辑**：初始从 storage 读取 interval 高亮初始项；点击后调用 `onChangeInterval` 回调，等待 SW 响应后高亮切换；切换间隔后 `refreshStatus()` 立即更新 `nextAlarmTime`，倒计时实时重置
- **SidePanel 重构**：提升 `useStatus` 到顶层，将 `lastRun`、`newCount`、`countdown`、`interval`、`changeInterval` 作为 props 传给子组件，确保状态同步

### 验收标准自检

| 标准 | 状态 | 说明 |
|------|------|------|
| 插件安装/启动后存在 `wecatch-poll` alarm，周期 5 分钟 | ✅ | `onInstalled` + `onStartup` 调用 `ensureAlarm()` |
| 切换为 2 分钟后旧 alarm 清除，新 alarm 周期 2 分钟 | ✅ | `resetAlarm()` 先 clear 再 create |
| 切换为 10 分钟后 alarm 周期正确更新 | ✅ | 同上 |
| `wecatch_interval` 写入 `chrome.storage.local` | ✅ | `resetAlarm()` 中 `storage.local.set` |
| Service Worker 休眠恢复后 alarm 自动重建 | ✅ | `onAlarm` 处理前调用 `ensureAlarm()` + `onStartup` 重建 |
| Side Panel 发送 `GET_STATUS` 后收到含三个字段的响应 | ✅ | `handleGetStatus()` 返回 `{ lastRun, newCount, nextAlarmTime }` |
| `nextAlarmTime` 值与 alarm `scheduledTime` 一致 | ✅ | 直接取 `alarm.scheduledTime` |
| Side Panel 初始化正确高亮当前 interval（默认 5 分钟） | ✅ | `useStatus` mount 时读 `chrome.storage.local.wecatch_interval` |
| 点击不同间隔按钮后高亮正确切换 | ✅ | `changeInterval` 成功后 `setIntervalValue(value)` |
| 切换间隔后倒计时立即重置 | ✅ | `changeInterval` 内调用 `refreshStatus()` 更新 `nextAlarmTime`，触发 `useEffect` 重启 tick |
| 从未抓取时显示"尚未抓取"，新增显示"-" | ✅ | `formatRelativeTime(null)` 返回 "尚未抓取"，`newCount===null` 显示 "-" |
| 倒计时 mm:ss 格式每秒更新，持续递减 | ✅ | `setInterval(1000)` + `formatCountdown()` |
| `wecatch_last_run` 有值时显示正确相对时间 | ✅ | `formatRelativeTime` 覆盖刚刚/分钟/小时/天 |
| 收到 `POLL_DONE` 后状态面板自动刷新 | ✅ | `useStatus` 中监听 `POLL_DONE` 调用 `refreshStatus()` |
| `npm run build` 成功，无报错 | ✅ | `webpack compiled successfully` |

### 遗留问题

- 无技术障碍。Sprint 2 alarm 触发只打印日志和广播 `POLL_DONE`（携带旧值），真实抓取行为留 Sprint 3 实现，符合 contract 约定。

### 下一步建议

- Sprint 3：实现 `FETCH_AND_CAPTURE` Content Script 消息，增量对比逻辑（`wecatch_seen_ids`），alarm 触发时接入真实抓取，Dashboard 数据源迁移到 `chrome.storage.local`
- Sprint 3 开始前建议手动测试 alarm 触发流程（chrome://extensions -> Service Worker -> DevTools Console 查看 `[wecatch] alarm fired` 日志）

---

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
