# WeCatch v1.1 — Side Panel + Auto-Poll Spec

> Generated: 2026-03-30
> Source: `docs/superpowers/specs/2026-03-30-sidebar-autopoll-design.md`

---

## 1. 现有功能基线（v1 现状）

### 1.1 Popup（320px 弹窗）

- 用户点击插件图标打开 Popup
- Popup 向 Content Script 发送 `FETCH_ARTICLES`，获取文章列表（含标题、comment_id、留言数量）
- 用户勾选目标文章，点击"开始抓取"
- Popup 向 Service Worker 发送 `START_CAPTURE`，Service Worker 逐篇向 Content Script 发送 `CAPTURE_COMMENTS`
- 抓取过程中 Popup 显示进度条（N / M）
- 抓取完成后显示"打开数据看板"按钮
- 数据存储于 `chrome.storage.session`（临时，窗口关闭即丢失）

### 1.2 Service Worker

- 仅处理 `START_CAPTURE` 消息，循环调用 Content Script 抓取每篇文章评论
- 抓取结果通过 `/api/analyze` 发送至后端进行大模型分类
- 分类结果存入 `chrome.storage.session.wecatchResults`
- 向 Popup 广播 `PROGRESS` 和 `CAPTURE_DONE` 消息

### 1.3 Content Script

- 注入 `mp.weixin.qq.com`，`document_start` 时机
- 处理两种消息：
  - `FETCH_ARTICLES`：调用微信后台 API 获取文章列表
  - `CAPTURE_COMMENTS`：全量抓取指定文章的顶层留言 + 回复，分页处理
- 留言数据归一化为后端接口格式

### 1.4 Dashboard

- 全屏页面，左侧深绿侧边栏（#1a3a2e）+ 右侧内容区
- 侧边栏：文章列表（含"全部"选项）、导出按钮
- 内容区：分类筛选下拉框、排序下拉框、留言卡片列表（磨砂玻璃风格）
- 已实现 Ethereal Greenhouse 设计系统
- 导出为 Excel

### 1.5 Manifest

- Manifest V3，权限：`storage`、`activeTab`
- `action.default_popup: popup.html`
- Content Script 匹配 `mp.weixin.qq.com/*`

### 1.6 当前痛点（本次改进出发点）

1. **每次都要手动打开 Popup 触发抓取**：运营人员需要持续监控留言，手动操作频繁且容易遗忘
2. **Popup 关闭即断**：Popup 是弹窗形态，切到其他标签页就关闭，无法常驻
3. **全量发送后端**：每次抓取把所有留言都送大模型分类，没有增量对比，浪费调用额度
4. **数据存 session storage**：浏览器关闭后数据丢失，无法持久化

---

## 2. 本次改进范围

### 做什么

| 编号 | 改进项 | 说明 |
|------|--------|------|
| S1 | Popup 改为 Side Panel | 常驻侧边栏，不会因切换标签页关闭 |
| S2 | 引入 chrome.alarms 自动轮询 | 按设定间隔（2/5/10 分钟）自动触发抓取 |
| S3 | 合并抓取流程为 FETCH_AND_CAPTURE | 取代原来的两步（FETCH_ARTICLES + CAPTURE_COMMENTS），一步完成 |
| S4 | 增量对比机制 | 对比 `wecatch_seen_ids`，仅将新增顶层留言送大模型，回复仅本地存储 |
| S5 | 持久化存储迁移 | 从 `chrome.storage.session` 迁移到 `chrome.storage.local` |
| S6 | 微信后台检测 + 引导状态 | 检测是否有 mp.weixin.qq.com 活跃 Tab，无则显示引导 |
| S7 | Side Panel 状态展示 | 上次抓取时间、新增数量、下次抓取倒计时 |

### 不做什么

- Dashboard UI 改版（已在另一个设计文档中独立处理）
- LLM Prompt 优化（独立任务）
- 方案 C 双层控制（后期优化）
- 抓取历史记录查看（本次只保留最新一次结果）
- 后端 API 变更（现有 `/api/analyze` 接口不变）

---

## 3. 视觉设计语言

基于 Ethereal Greenhouse 设计系统，Side Panel 延续 Popup 的设计风格，但适配侧边栏常驻形态。

### 3.1 整体布局

- **宽度**：Side Panel 默认宽度由 Chrome 控制（约 360px），内容自适应
- **背景**：渐变 `linear-gradient(160deg, #effcf7, #ddf2ec)`
- **内容区**：`padding: 16px`，内部分为状态卡片、控制卡片、导航区三个区域

### 3.2 状态卡片（Status Card）

磨砂玻璃卡片：
```
background: rgba(255, 255, 255, 0.70)
backdrop-filter: blur(12px)
border-radius: 24px
padding: 16px
box-shadow: 0px 8px 24px rgba(31, 55, 49, 0.06)
```

内部布局：
- **上次抓取时间**：左侧 label-sm `#4b645e` "上次抓取"，右侧 body-sm `#1f3731` "5 分钟前"
- **新增留言数**：左侧 label-sm `#4b645e` "新增留言"，右侧 title-sm `#006d48` 加粗数字 + "条"
- **下次抓取倒计时**：居中显示，title-md `#006d48`，格式 "03:42"，下方 label-sm `#4b645e` "后自动抓取"

### 3.3 控制卡片（Control Card）

同样磨砂玻璃卡片，与状态卡片间距 `spacing-3`（12px）。

- **间隔选择器**：三个胶囊按钮并排（2分钟 / 5分钟 / 10分钟）
  - 未选中：`background: #ddf2ec`、`color: #1f3731`、`border-radius: 9999px`、`padding: 6px 16px`
  - 选中：`background: linear-gradient(135deg, #006d48, #92f7c3)`、`color: #ffffff`
  - 字体：Manrope 13px 500
- **手动抓取按钮**：Primary CTA 风格，全宽
  - `background: linear-gradient(135deg, #006d48, #52b788)`、`color: #ffffff`
  - `border-radius: 16px`、`padding: 13px 24px`
  - 文案："立即抓取"
  - 点击后展开文章列表（动画滑出），勾选后确认

### 3.4 文章选择列表（手动抓取展开时）

复用 Popup 已有的文章列表样式：
- 磨砂玻璃容器内，`max-height: 240px`、`overflow-y: auto`
- 每项：`padding: 10px 12px`、`border-radius: 12px`
- hover：`background: #f5fef9`
- selected：`background: #ddf2ec`
- 圆形 checkbox：`20px`，选中 `#006d48` 填充
- 全选行 + 确认按钮

### 3.5 导航区

- "打开数据看板"：Ghost 按钮，全宽，`color: #006d48`、`border-radius: 16px`

### 3.6 异常状态（微信后台未打开）

- 整个内容区替换为引导界面
- 居中显示提示图标（叶子 emoji 或 SVG）
- 标题：title-md `#1f3731` "请先打开微信公众号后台"
- 描述：body-sm `#4b645e` "WeCatch 需要在微信后台页面中运行"
- 按钮：Primary CTA "打开微信后台"，点击跳转 `https://mp.weixin.qq.com`

### 3.7 抓取进行中状态

- 状态卡片内显示进度条（复用 Popup 进度条样式）
- 进度文字：body-sm `#4b645e` "抓取中 2 / 5"
- 进度条：`height: 6px`、`background: #ddf2ec`、`fill: linear-gradient(135deg, #006d48, #52b788)`
- 手动抓取按钮变为 disabled 状态（opacity 0.4）

### 3.8 字体

- 标题 / 数字重点：**Plus Jakarta Sans**，700 weight
- 正文 / 标签 / 按钮：**Manrope**，400-600 weight
- 不使用纯黑色，所有文字最深色为 `#1f3731`

---

## 4. 功能列表

### F1: Side Panel 入口替换 Popup

**用户故事**：作为运营人员，我想要一个常驻的侧边栏界面，以便在浏览其他页面时也能随时查看抓取状态，无需反复点击插件图标。

**详细描述**：
- 点击插件图标打开 Chrome Side Panel（而非 Popup）
- Side Panel 保持打开状态，不随标签页切换关闭
- 新增 `sidepanel.html` 作为 Side Panel 入口页
- Manifest 新增 `sidePanel` 权限和 `side_panel.default_path` 配置
- 移除 `action.default_popup`

**边界情况**：
- Chrome 版本不支持 Side Panel API（Manifest V3 要求 Chrome 114+）：不做降级处理，在文档中注明最低版本要求
- Side Panel 已经打开时再次点击图标：Chrome 原生行为是 toggle（关闭/打开）

### F2: 状态展示面板

**用户故事**：作为运营人员，我想要一眼看到上次抓取的结果和下次自动抓取的时间，以便了解系统是否在正常工作。

**详细描述**：
- 显示上次抓取时间（相对时间："5 分钟前"、"刚刚"、"1 小时前"）
- 显示上次抓取新增的顶层留言数量
- 显示距下次自动抓取的倒计时（mm:ss 格式，每秒更新）
- 数据来源：`chrome.storage.local`（`wecatch_last_run`、`wecatch_last_new_count`）
- 倒计时计算：`chrome.alarms.get('wecatch-poll')` 获取 `scheduledTime` 与当前时间差值

**边界情况**：
- 从未抓取过：显示"尚未抓取"、新增数量显示 "-"、倒计时正常运行
- alarm 被系统杀死后恢复：Service Worker 唤醒时重建 alarm

### F3: 轮询间隔控制

**用户故事**：作为运营人员，我想要调整自动抓取的频率，以便在热点事件期间加快检查频率，平时降低频率节省资源。

**详细描述**：
- 提供 2 / 5 / 10 分钟三个选项，默认 5 分钟
- 选择后立即生效：向 Service Worker 发送 `SET_INTERVAL` 消息
- Service Worker 收到后：更新 `chrome.storage.local.wecatch_interval`，清除旧 alarm，创建新 alarm
- Side Panel 倒计时重置

**边界情况**：
- 抓取进行中切换间隔：当前抓取继续完成，新间隔在下次 alarm 触发时生效
- Service Worker 休眠后恢复：从 `chrome.storage.local` 读取 interval 重建 alarm

### F4: 自动轮询抓取（chrome.alarms）

**用户故事**：作为运营人员，我想要系统每隔几分钟自动检查一次新留言，以便我不需要记住去手动触发。

**详细描述**：
- Service Worker 启动时（`onInstalled` + `onStartup`）从 storage 读取 interval，创建 `chrome.alarms.create('wecatch-poll', { periodInMinutes })`
- alarm 触发时：
  1. 检查是否存在 `mp.weixin.qq.com` 的活跃 Tab（`chrome.tabs.query({ url: 'https://mp.weixin.qq.com/*' })`）
  2. 不存在：向 Side Panel 广播 `NO_WX_TAB` 消息，结束
  3. 存在：向该 Tab 的 Content Script 发送 `FETCH_AND_CAPTURE` 消息
  4. Content Script 执行抓取 + 增量对比 + 后端分类
  5. 返回结果后更新 storage，广播 `POLL_DONE`

**数据流**：
```
chrome.alarms.onAlarm('wecatch-poll')
  -> Service Worker 查找微信后台 Tab
  -> [Tab 不存在] -> 广播 NO_WX_TAB -> Side Panel 显示引导
  -> [Tab 存在] -> sendMessage(tabId, { type: 'FETCH_AND_CAPTURE' })
  -> Content Script 全量抓取所有文章的留言
  -> Content Script 对比 wecatch_seen_ids，找出新增顶层留言
  -> Content Script 将新增顶层留言 POST 到 /api/analyze
  -> Content Script 返回 { articles, newTopLevelCount } 给 Service Worker
  -> Service Worker 更新 storage: wecatch_articles, wecatch_seen_ids, wecatch_last_run, wecatch_last_new_count
  -> Service Worker 广播 POLL_DONE { lastRun, newCount }
  -> Side Panel 刷新状态显示
```

**边界情况**：
- 多个微信后台 Tab 打开：使用第一个匹配的 Tab
- 抓取过程中 alarm 再次触发：加锁机制，正在抓取时跳过本次 alarm
- Content Script 未注入（Tab 早于插件安装就打开）：捕获 sendMessage 错误，提示用户刷新页面
- 后端不可达：Content Script 捕获 fetch 错误，返回部分结果（已抓取的留言仍然存储，仅分类失败）
- 微信登录态过期：Content Script 的 API 调用返回非预期数据，返回错误消息

### F5: 手动立即抓取

**用户故事**：作为运营人员，我想要随时手动触发一次抓取，以便在不等待自动轮询的情况下立刻获取最新留言。

**详细描述**：
- 点击"立即抓取"按钮
- 展开文章列表（从 Content Script 获取），用户勾选目标文章
- 确认后向 Service Worker 发送 `TRIGGER_NOW` 消息，携带选中文章的 comment_id 列表
- Service Worker 执行与自动轮询相同的抓取流程，但仅抓取指定文章
- 抓取期间 Side Panel 显示进度状态
- 抓取完成后收起文章列表，刷新状态面板

**边界情况**：
- 自动轮询正在进行时点击手动抓取：提示"正在抓取中，请稍候"
- 微信后台 Tab 不存在时点击：直接显示引导状态
- 文章列表为空（没有有留言的文章）：显示"暂无可抓取的文章"

### F6: 合并消息类型 FETCH_AND_CAPTURE

**用户故事**：作为系统，我需要一个统一的抓取指令，以便一步完成文章列表获取 + 留言抓取 + 增量对比 + 后端分类。

**详细描述**：
- 新增 Content Script 消息类型 `FETCH_AND_CAPTURE`
- 参数：`{ articleIds?: string[] }`
  - 传入 articleIds：仅抓取指定文章（手动抓取场景）
  - 不传：抓取所有有留言的文章（自动轮询场景）
- 执行流程：
  1. 获取文章列表（复用 `fetchArticleList()`）
  2. 按 articleIds 过滤（如有传入）
  3. 对每篇文章全量抓取留言（顶层 + 回复）
  4. 从 `chrome.storage.local` 读取 `wecatch_seen_ids`
  5. 对比找出新增留言
  6. 新增顶层留言 -> 调用 `/api/analyze` 获取分类
  7. 新增回复 -> 仅记录，不送大模型
  8. 更新 `wecatch_seen_ids`
  9. 返回 `{ articles: [...], newTopLevelCount: number }`
- 保留原有的 `FETCH_ARTICLES` 和 `CAPTURE_COMMENTS` 消息类型（手动抓取展开文章列表时仍需 `FETCH_ARTICLES`）

**边界情况**：
- 第一次运行（`wecatch_seen_ids` 不存在）：所有留言视为新增
- 某篇文章的留言被删除（seen 中有但实际不存在）：不影响，seen_ids 只增不减
- 大量新增留言（如首次运行时数百条）：分批调用 `/api/analyze`，避免单次请求过大

### F7: 增量对比存储

**用户故事**：作为系统，我需要记住已经处理过的留言 ID，以便自动轮询时只将新增留言送入大模型分类，节省 API 调用额度。

**详细描述**：
- 存储结构：`chrome.storage.local.wecatch_seen_ids`
  ```json
  {
    "comment_id_A": ["content_id_1", "content_id_2", ...],
    "comment_id_B": ["content_id_3", ...]
  }
  ```
  - key 为文章的 `comment_id`
  - value 为该文章下所有已见的顶层留言 `content_id` 数组
- 对比逻辑：抓取到的顶层留言 content_id 不在 seen_ids 中 -> 视为新增
- 更新时机：每次抓取完成后，将本次全量 content_id 写入 seen_ids

### F8: 微信后台检测与引导

**用户故事**：作为运营人员，当我忘记打开微信公众号后台时，我想要看到清晰的提示，以便我知道需要做什么。

**详细描述**：
- 检测时机：Side Panel 打开时、每次 alarm 触发时
- 检测方式：`chrome.tabs.query({ url: 'https://mp.weixin.qq.com/*' })`
- 未检测到：Side Panel 显示引导状态（居中提示 + 按钮）
- 点击"打开微信后台"：`chrome.tabs.create({ url: 'https://mp.weixin.qq.com' })`
- 检测到 Tab 后自动切换回正常状态（监听 `chrome.tabs.onUpdated`）

### F9: Dashboard 导航

**用户故事**：作为运营人员，我想要从侧边栏一键跳转到数据看板，以便快速查看详细的留言分析结果。

**详细描述**：
- Side Panel 底部常驻 Ghost 按钮"打开数据看板"
- 点击逻辑：
  1. 查找是否已有 `dashboard.html` 的 Tab（`chrome.tabs.query({ url: chrome.runtime.getURL('dashboard.html') })`）
  2. 已有：`chrome.tabs.update(tabId, { active: true })` + `chrome.tabs.reload(tabId)`
  3. 没有：`chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })`
- Dashboard 数据来源从 `chrome.storage.session` 改为 `chrome.storage.local`（对应 S5 存储迁移）

---

## 5. 本地存储结构（chrome.storage.local）

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `wecatch_interval` | number | 5 | 轮询间隔（分钟） |
| `wecatch_last_run` | string (ISO 8601) | null | 上次抓取完成时间 |
| `wecatch_last_new_count` | number | 0 | 上次新增顶层留言数 |
| `wecatch_articles` | object[] | [] | 最新全量文章 + 留言数据（Dashboard 读取） |
| `wecatch_seen_ids` | object | {} | `{ [comment_id]: string[] }` 各文章已见顶层留言 ID |

---

## 6. Manifest 变更清单

```diff
 {
   "permissions": [
     "storage",
-    "activeTab"
+    "activeTab",
+    "sidePanel",
+    "alarms"
   ],
-  "action": {
-    "default_popup": "popup.html"
-  },
+  "action": {},
+  "side_panel": {
+    "default_path": "sidepanel.html"
+  },
 }
```

- 新增 webpack entry：`sidepanel: './src/sidepanel/index.jsx'`
- 新增 HTML：`dist/sidepanel.html`
- Popup 入口和文件可以保留但不再使用（后续清理）

---

## 7. 消息协议汇总

### Side Panel -> Service Worker

| Message | Payload | Response |
|---------|---------|----------|
| `SET_INTERVAL` | `{ interval: number }` | `{ ok: true }` |
| `TRIGGER_NOW` | `{ articleIds: string[] }` | `{ ok: true }` |
| `GET_STATUS` | - | `{ lastRun, newCount, nextAlarmTime }` |

### Service Worker -> Content Script

| Message | Payload | Response |
|---------|---------|----------|
| `FETCH_ARTICLES` | - | `{ ok, data: { account, articles } }` |
| `FETCH_AND_CAPTURE` | `{ articleIds?: string[] }` | `{ ok, data: { articles, newTopLevelCount } }` |
| `CAPTURE_COMMENTS` | `{ articleId }` | `{ ok, data: { account, article, comments } }` (preserved for compatibility) |

### Service Worker -> Side Panel (broadcast)

| Message | Payload |
|---------|---------|
| `POLL_DONE` | `{ lastRun, newCount }` |
| `NO_WX_TAB` | - |
| `PROGRESS` | `{ current, total }` |

---

## 8. Sprint 划分

### Sprint 1: Side Panel 基础 + Manifest 变更

**目标**：将入口从 Popup 切换到 Side Panel，实现基本 UI 框架。

**功能**：
- Manifest 变更：新增 `sidePanel`、`alarms` 权限，配置 `side_panel.default_path`，移除 `default_popup`
- webpack 新增 `sidepanel` entry
- 创建 `sidepanel.html` + `src/sidepanel/` 目录
- Side Panel 基础布局：Header（logo + 标题）、状态卡片（静态占位）、导航按钮
- 点击图标打开 Side Panel（Service Worker 中注册 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`）
- Dashboard 导航按钮逻辑（F9：查找已有 Tab / 新建 Tab）
- 微信后台检测 + 引导状态（F8）

**验收标准**：
- [ ] 点击插件图标打开 Side Panel（不是 Popup）
- [ ] Side Panel 显示 WeCatch logo、标题、状态区域（静态）
- [ ] 未打开微信后台时显示引导状态 + "打开微信后台"按钮可点击跳转
- [ ] "打开数据看板"按钮可正确打开 / 切换到 Dashboard Tab
- [ ] Side Panel 在切换标签页后依然保持打开

### Sprint 2: 自动轮询 + 间隔控制

**目标**：实现 chrome.alarms 自动轮询机制和间隔选择器。

**功能**：
- Service Worker 中实现 alarm 管理：创建、更新、监听
- 处理 `SET_INTERVAL` 消息
- 处理 `GET_STATUS` 消息
- Side Panel 间隔选择器 UI（2/5/10 分钟胶囊按钮）
- Side Panel 状态面板：上次抓取时间（相对时间）、新增留言数、倒计时
- 倒计时每秒更新（`setInterval` 1s，计算 alarm scheduledTime 与 now 差值）
- 抓取锁机制（防止 alarm 重叠触发）

**验收标准**：
- [ ] 默认 5 分钟间隔，alarm 正确创建
- [ ] 切换间隔后 alarm 重置，倒计时刷新
- [ ] 间隔选择器正确高亮当前选中项
- [ ] 倒计时每秒更新，格式 mm:ss
- [ ] Service Worker 休眠恢复后 alarm 自动重建
- [ ] `GET_STATUS` 返回正确数据

### Sprint 3: FETCH_AND_CAPTURE + 增量对比

**目标**：实现合并抓取消息和增量对比逻辑，将存储迁移到 chrome.storage.local。

**功能**：
- Content Script 新增 `FETCH_AND_CAPTURE` 消息处理
- 增量对比逻辑：读取 `wecatch_seen_ids`，找出新增顶层留言
- 仅新增顶层留言调用 `/api/analyze`
- 更新 `wecatch_seen_ids`
- Service Worker alarm 触发时调用 `FETCH_AND_CAPTURE`
- 存储迁移：结果写入 `chrome.storage.local.wecatch_articles`
- Dashboard 数据读取从 `chrome.storage.session` 改为 `chrome.storage.local`
- Service Worker 广播 `POLL_DONE`，Side Panel 刷新状态

**验收标准**：
- [ ] 自动轮询触发后 Content Script 正确执行全量抓取
- [ ] 增量对比正确：第二次抓取时已见留言不再送后端
- [ ] `wecatch_seen_ids` 正确更新
- [ ] `wecatch_last_run` 和 `wecatch_last_new_count` 正确写入
- [ ] Side Panel 收到 `POLL_DONE` 后刷新状态面板
- [ ] Dashboard 能从 `chrome.storage.local` 正确读取数据
- [ ] 微信后台 Tab 不存在时 Side Panel 收到 `NO_WX_TAB` 并显示引导

### Sprint 4: 手动抓取 + 进度展示 + 收尾

**目标**：实现手动抓取流程，完善进度展示和异常处理。

**功能**：
- Side Panel "立即抓取"按钮：点击展开文章列表
- 文章列表 UI（复用 Popup 组件样式）：全选、勾选、确认
- `TRIGGER_NOW` 消息处理
- 抓取进行中状态展示（进度条 + 文字）
- 异常处理：网络错误、登录态过期、Content Script 未注入
- 抓取锁：自动轮询进行中禁用手动抓取按钮

**验收标准**：
- [ ] 点击"立即抓取"后文章列表正确展开
- [ ] 勾选文章后确认，触发抓取
- [ ] 抓取过程中显示进度
- [ ] 抓取完成后文章列表收起，状态面板刷新
- [ ] 自动轮询进行中点击手动抓取提示"正在抓取中"
- [ ] 微信后台 Tab 不存在时点击手动抓取显示引导
- [ ] 网络错误时显示友好错误信息
- [ ] 端到端测试：打开微信后台 -> Side Panel 自动轮询 -> 新增留言正确分类 -> Dashboard 数据更新
