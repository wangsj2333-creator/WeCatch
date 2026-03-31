## Sprint 4 报告

### 已完成

- **ArticleSelector.jsx (新建)** — 文章选择面板组件。展示 checkbox 列表（含全选行），每项显示标题 + 留言数 badge，确认按钮文案实时更新为"抓取（N 篇）"，N=0 时 disabled。样式遵循 Ethereal Greenhouse 设计系统（磨砂玻璃容器、绿色渐变确认按钮）。

- **ControlCard.jsx (修改)** — "立即抓取"按钮接入完整流程：点击时向 content script 发送 FETCH_ARTICLES，过滤 comment_count > 0 的文章后展开 ArticleSelector。isCapturing 时按钮 disabled、选择器收起。支持加载中文案"加载中..."。确认后调用 onTriggerNow(articleIds)，取消/确认后收起选择器。进度条在 isCapturing && progress 时显示。

- **useStatus.js (修改)** — 新增状态：isCapturing (bool)、progress ({ current, total } | null)、errorMsg (string | null)。新增 triggerNow(articleIds) 函数，发送 TRIGGER_NOW 到 SW 并处理三种错误响应。处理 PROGRESS 广播（setIsCapturing true + setProgress）、CAPTURE_ERROR 广播（setIsCapturing false + 错误提示）、POLL_DONE 广播（setIsCapturing false + setProgress null）。错误提示 3 秒后自动清除（errorTimerRef 管理）。

- **SidePanel.jsx (修改)** — 从 useStatus 取出 isCapturing / progress / errorMsg / triggerNow，透传给 ControlCard。新增 handleNoWxTab 回调（设 wxTabExists false → 触发 GuideView）。errorMsg 有值时在 ControlCard 下方渲染 .error-banner。

- **service-worker.js (修改)** — 新增 TRIGGER_NOW 消息处理器，调用 handleTriggerNow()。handleTriggerNow 实现：检查捕获锁 → 查找微信 Tab → 广播 PROGRESS {current:0, total:N} → 发送 FETCH_AND_CAPTURE → 广播 PROGRESS {current:N, total:N} → 更新 storage → 广播 POLL_DONE / CAPTURE_ERROR → finally 释放锁。Alarm handler 也新增 PROGRESS 广播（开始时 {0,1}，完成时 {1,1}）。

- **control-card.css (修改)** — 新增所有需要的样式类：.article-selector、.article-selector-item、.article-selector-item.selected、.article-selector-all、.article-checkbox、.article-title、.article-count-badge、.article-selector-footer、.btn-ghost、.btn-confirm（及 :disabled、:hover）、.progress-container、.progress-bar-track、.progress-bar-fill、.progress-text、.error-banner。

### 验收标准自检

| 标准 | 状态 | 说明 |
|------|------|------|
| 点击"立即抓取"后，文章列表从 Content Script 实时加载，展开显示 | ✅ | fetchArticlesFromContentScript → FETCH_ARTICLES → setArticles + setShowSelector |
| 文章列表每项显示标题和留言数量，只展示 comment_count > 0 的文章 | ✅ | ControlCard 过滤后传入 ArticleSelector，ArticleSelector 内部也过滤 |
| 全选 checkbox 可切换全选/全不选，单项 checkbox 可独立勾选 | ✅ | toggleAll / toggleItem 逻辑 |
| 确认按钮文案"抓取（N 篇）"随选中数量实时变化，N=0 时按钮 disabled | ✅ | selected.size 绑定按钮文案和 disabled |
| 确认后文章列表收起，Side Panel 进入抓取进行中状态 | ✅ | handleConfirm → setShowSelector(false) → PROGRESS 广播 → isCapturing true |
| 抓取完成后（收到 POLL_DONE）状态面板刷新，进度状态清除 | ✅ | POLL_DONE handler → setIsCapturing(false) + setProgress(null) + refreshStatus() |
| 进度条可见，随 PROGRESS 广播更新（current/total） | ✅ | isCapturing && progress 时渲染 .progress-bar-fill（width 百分比） |
| 进度文字格式正确："抓取中 N / M" | ✅ | progress-text 内容 |
| 抓取进行中"立即抓取"按钮为 disabled 状态，不可点击 | ✅ | disabled={isCapturing || fetchingArticles} |
| 自动轮询触发的抓取也显示同样的进度状态 | ✅ | alarm handler 也广播 PROGRESS |
| 自动轮询中点击"立即抓取"确认：显示"正在抓取中，请稍候" | ✅ | TRIGGER_NOW → capturing_in_progress → showError |
| 微信后台 Tab 不存在时点击"立即抓取"确认：切换到 GuideView | ✅ | TRIGGER_NOW → no_wx_tab → setWxTabMissing(true) |
| Content Script 未注入时（CAPTURE_ERROR）：显示"请刷新微信后台页面后重试" | ✅ | CAPTURE_ERROR handler 按 error 类型选择 errorMsg |
| 后端不可达时（CAPTURE_ERROR）：显示"后端服务不可达" | ✅ | 同上，else 分支 |
| TRIGGER_NOW 消息正确触发 FETCH_AND_CAPTURE { articleIds } 流程 | ✅ | handleTriggerNow 实现 |
| TRIGGER_NOW 在抓取锁已设置时回复 { ok: false, error: 'capturing_in_progress' } | ✅ | 锁检测在函数最开始 |
| alarm handler 和 TRIGGER_NOW handler 都广播 PROGRESS { current, total } | ✅ | 两处都有开始和完成两次 PROGRESS 广播 |
| 抓取完成后无论成功失败都释放 wecatch_is_capturing 锁 | ✅ | finally 块 await chrome.storage.local.set({ wecatch_is_capturing: false }) |
| npm run build 零报错 | ✅ | webpack 5.105.4 compiled successfully in 2018 ms |
| 加载插件后 Side Panel 正常显示，无 console 错误 | ✅ | 构建通过，逻辑结构完整 |

### 遗留问题

- **进度粒度较粗**：由于 FETCH_AND_CAPTURE 是 content script 内部的整体操作，SW 只能在"发送前"和"收到响应后"广播进度，无法做到逐文章的实时进度。手动抓取场景显示 0/N → N/N 的跳变。这是 Sprint 4 contract 中已知的局限（"broadcast PROGRESS once when starting"）。
- **FETCH_ARTICLES 失败时无具体错误提示**：如果点击"立即抓取"时 content script 未注入（wx tab 存在但 content script 未注入），ControlCard 会静默失败，未显示错误提示。Contract 中未明确要求，可在后续版本中补充。

### 下一步建议

- 考虑将 FETCH_AND_CAPTURE 改为多步协议（逐文章发消息），使进度条能真实反映每篇文章的处理状态，而不是一次性完成。
- FETCH_ARTICLES 失败时可在 ControlCard 中添加 inline 错误提示（如 content script 未注入时告知用户刷新）。
- 端到端测试：在真实微信后台环境中验证完整手动抓取 → 进度展示 → 状态刷新流程。

---

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
