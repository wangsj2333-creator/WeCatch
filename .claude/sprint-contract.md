# Sprint 4 Contract — 手动抓取 + 进度展示 + 收尾

> Sprint: 4 of 4
> Created: 2026-03-31
> Source spec: `.claude/spec.md` §8 Sprint 4

---

## 现状基线

Sprint 1-3 已完成：Side Panel 框架、chrome.alarms 自动轮询、FETCH_AND_CAPTURE 增量对比、存储迁移。

当前缺口：
- `ControlCard.jsx` 中"立即抓取"按钮硬编码为 `disabled`，没有任何功能
- `service-worker.js` 中没有 `TRIGGER_NOW` 消息处理器
- Side Panel 没有抓取进行中的状态展示
- 错误场景（网络错误、Content Script 未注入）无用户可见的错误提示

---

## 功能范围

### F1：手动抓取入口 — 展开文章列表

- 点击 ControlCard 的"立即抓取"按钮后，向 Content Script 发送 `FETCH_ARTICLES` 消息获取文章列表
- 展开文章选择面板（动画滑出），列出所有有留言的文章（`comment_count > 0`）
- 每项显示：文章标题 + 留言数量 badge
- 支持单选 / 全选 checkbox，确认按钮文案"抓取（N 篇）"随选中数量实时更新
- 未选中任何文章时确认按钮 disabled
- 再次点击"立即抓取"按钮（或点击取消）收起列表

### F2：TRIGGER_NOW 消息处理

- Side Panel 确认后向 Service Worker 发送 `TRIGGER_NOW { articleIds: string[] }`
- Service Worker 收到后：
  1. 检查 `wecatch_is_capturing` 锁，若已在抓取则直接回复 `{ ok: false, error: 'capturing_in_progress' }`
  2. 设置抓取锁，查找微信后台 Tab
  3. Tab 不存在：回复 `{ ok: false, error: 'no_wx_tab' }`
  4. Tab 存在：向 Content Script 发送 `FETCH_AND_CAPTURE { articleIds }`，执行与 alarm handler 相同的抓取流程
  5. 抓取完成后更新 storage，广播 `POLL_DONE { lastRun, newCount }`
  6. 释放抓取锁

### F3：抓取进行中状态

- Side Panel 在抓取期间显示进度条 + 进度文字（复用 spec §3.7 样式）
- 进度条：`height: 6px`，`background: #ddf2ec`，fill 为绿色渐变（`linear-gradient(135deg, #006d48, #52b788)`）
- 进度文字：body-sm `#4b645e`，格式"抓取中 N / M"（N = 已完成，M = 总数）
- 自动轮询触发的抓取和手动触发的抓取都显示此状态
- 进度数据来源：Service Worker 广播 `PROGRESS { current, total }` 消息
- 抓取进行中："立即抓取"按钮变为 disabled（opacity 0.4），文章列表如已展开则收起

### F4：异常处理与错误提示

- **CAPTURE_ERROR（Content Script 未注入）**：Side Panel inline 错误提示"请刷新微信后台页面后重试"
- **TRIGGER_NOW 返回 capturing_in_progress**：在 Side Panel 显示"正在抓取中，请稍候"提示
- **TRIGGER_NOW 返回 no_wx_tab**：切换到 GuideView 引导状态
- **网络错误（后端不可达）**：CAPTURE_ERROR 广播中携带错误信息，Side Panel 显示"后端服务不可达"提示
- 错误提示持续显示 3 秒后自动消失

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `extension/src/sidepanel/ControlCard.jsx` | 修改 | 添加文章列表展开/收起逻辑，实现确认触发抓取 |
| `extension/src/sidepanel/ArticleSelector.jsx` | 新建 | 文章选择面板组件（checkbox 列表 + 全选 + 确认按钮） |
| `extension/src/sidepanel/SidePanel.jsx` | 修改 | 传入 isCapturing / progress 状态；处理错误提示显示 |
| `extension/src/sidepanel/useStatus.js` | 修改 | 新增 isCapturing、progress、errorMsg 状态；处理 PROGRESS / CAPTURE_ERROR 广播 |
| `extension/src/background/service-worker.js` | 修改 | 新增 TRIGGER_NOW 消息处理器；在 alarm handler 和 TRIGGER_NOW 中广播 PROGRESS 消息 |
| `extension/src/sidepanel/control-card.css` | 修改 | 添加文章选择面板、进度条、disabled 状态样式 |

---

## 消息协议新增

### Side Panel -> Service Worker

| 消息 | Payload | 同步响应 |
|------|---------|---------|
| `TRIGGER_NOW` | `{ articleIds: string[] }` | `{ ok: boolean, error?: string }` |

### Service Worker -> Side Panel (broadcast)

| 消息 | Payload | 说明 |
|------|---------|------|
| `PROGRESS` | `{ current: number, total: number }` | 抓取进度（新增） |

（`POLL_DONE`、`NO_WX_TAB`、`CAPTURE_ERROR` 已存在，本 sprint 利用但不修改协议）

---

## 验收标准

### 手动抓取主流程

- [ ] 点击"立即抓取"后，文章列表从 Content Script 实时加载，展开显示
- [ ] 文章列表每项显示标题和留言数量，只展示 `comment_count > 0` 的文章
- [ ] 全选 checkbox 可切换全选/全不选，单项 checkbox 可独立勾选
- [ ] 确认按钮文案"抓取（N 篇）"随选中数量实时变化，N=0 时按钮 disabled
- [ ] 确认后文章列表收起，Side Panel 进入抓取进行中状态
- [ ] 抓取完成后（收到 `POLL_DONE`）状态面板刷新，进度状态清除

### 抓取进行中状态

- [ ] 进度条可见，随 `PROGRESS` 广播更新（current/total）
- [ ] 进度文字格式正确："抓取中 N / M"
- [ ] 抓取进行中"立即抓取"按钮为 disabled 状态，不可点击
- [ ] 自动轮询触发的抓取也显示同样的进度状态

### 异常处理

- [ ] 自动轮询中点击"立即抓取"确认：显示"正在抓取中，请稍候"，3 秒后消失
- [ ] 微信后台 Tab 不存在时点击"立即抓取"确认：切换到 GuideView
- [ ] Content Script 未注入时（CAPTURE_ERROR）：显示"请刷新微信后台页面后重试"，3 秒后消失
- [ ] 后端不可达时（CAPTURE_ERROR）：显示"后端服务不可达"，3 秒后消失

### Service Worker

- [ ] `TRIGGER_NOW` 消息正确触发 `FETCH_AND_CAPTURE { articleIds }` 流程
- [ ] `TRIGGER_NOW` 在抓取锁已设置时回复 `{ ok: false, error: 'capturing_in_progress' }`
- [ ] alarm handler 和 TRIGGER_NOW handler 都广播 `PROGRESS { current, total }`
- [ ] 抓取完成后无论成功失败都释放 `wecatch_is_capturing` 锁

### 构建与集成

- [ ] `npm run build` 零报错
- [ ] 加载插件后 Side Panel 正常显示，无 console 错误
