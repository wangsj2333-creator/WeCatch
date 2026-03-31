# Sprint 3 Contract — FETCH_AND_CAPTURE + 增量对比 + 存储迁移

> Sprint: 3 of 4
> Created: 2026-03-31
> Source spec: `.claude/spec.md` §8 Sprint 3

---

## 目标

接通自动轮询的真实抓取逻辑：alarm 触发时调用 Content Script 的 `FETCH_AND_CAPTURE`，执行全量抓取 + 增量对比 + 后端分类，将结果持久化到 `chrome.storage.local`，并更新 Side Panel 状态面板。同时将 Dashboard 数据读取从 `session` 迁移到 `local`。

---

## 功能范围

### 1. Content Script：FETCH_AND_CAPTURE 消息处理

新增 `FETCH_AND_CAPTURE` 消息类型，执行完整的抓取 + 增量对比 + 分类流程：

**执行流程**：
1. 调用现有 `fetchArticleList()` 获取全量文章列表
2. 若 payload 包含 `articleIds`，按该列表过滤（手动抓取场景）；否则处理所有有留言的文章
3. 对每篇文章全量抓取顶层留言 + 回复（复用现有分页抓取逻辑）
4. 从 `chrome.storage.local` 读取 `wecatch_seen_ids`（不存在时视为 `{}`）
5. 对比找出新增顶层留言（`content_id` 不在 seen_ids 中）
6. 新增顶层留言 -> 批量 POST 到 `/api/analyze` 获取分类结果
7. 新增回复 -> 仅记录，不送后端
8. 更新 `wecatch_seen_ids`（将本次全量顶层 `content_id` 合并写入）
9. 返回 `{ ok: true, data: { articles, newTopLevelCount } }`

**批量分类规则**：若新增顶层留言超过 50 条，分批调用 `/api/analyze`，每批不超过 50 条。

**错误处理**：
- `/api/analyze` 请求失败：仍返回已抓取的 articles，`newTopLevelCount` 设为 0，error 字段说明原因
- 微信 API 返回非预期响应（登录态过期等）：返回 `{ ok: false, error: 'wx_api_error' }`
- 保留原有 `FETCH_ARTICLES` 和 `CAPTURE_COMMENTS` 消息处理（兼容性）

### 2. Service Worker：alarm 触发接入真实抓取

替换 Sprint 2 中 alarm 触发时的占位逻辑（仅 log）：

**alarm 触发流程**：
1. 检查 `wecatch_is_capturing` 锁，若为 true 则跳过并 log
2. 设置 `wecatch_is_capturing = true`
3. 查找 `mp.weixin.qq.com` 活跃 Tab（`chrome.tabs.query({ url: 'https://mp.weixin.qq.com/*' })`）
4. **Tab 不存在**：广播 `NO_WX_TAB`，释放锁，结束
5. **Tab 存在**：向该 Tab 发送 `FETCH_AND_CAPTURE`（不传 articleIds，全量抓取）
6. 收到 Content Script 响应后：
   - 将 `articles` 写入 `chrome.storage.local.wecatch_articles`
   - 更新 `wecatch_last_run`（当前 ISO 8601 时间）
   - 更新 `wecatch_last_new_count`（`newTopLevelCount`）
   - 广播 `POLL_DONE { lastRun, newCount }`
7. 释放锁：`wecatch_is_capturing = false`
8. 任何异常均需释放锁（try/finally）

**Content Script 未注入处理**：`sendMessage` 抛出 "Could not establish connection" 错误时，广播 `{ type: 'CAPTURE_ERROR', error: 'content_script_not_injected' }`，提示用户刷新微信后台页面。

### 3. 存储迁移：session -> local

Dashboard 当前从 `chrome.storage.session.wecatchResults` 读取数据，需迁移到 `chrome.storage.local.wecatch_articles`：

- Dashboard 所有读取 `chrome.storage.session` 的代码替换为读取 `chrome.storage.local.wecatch_articles`
- Service Worker 写入抓取结果时使用 `wecatch_articles`（已在上方定义）
- `chrome.storage.session` 相关代码全部清理（不保留兼容层）

### 4. Side Panel：接收 NO_WX_TAB 广播

- 监听 Service Worker 广播的 `NO_WX_TAB` 消息
- 收到后切换到引导状态（替换正常状态面板，显示"请先打开微信公众号后台"）
- 引导状态中"打开微信后台"按钮：向 Service Worker 发消息，由 SW 调用 `chrome.tabs.create({ url: 'https://mp.weixin.qq.com' })`

### 5. 存储 key 汇总（本 sprint 新增写入）

| Key | 写入时机 | 说明 |
|-----|---------|------|
| `wecatch_articles` | 每次抓取完成 | 全量文章 + 留言数据（Dashboard 读取） |
| `wecatch_seen_ids` | 每次抓取完成 | `{ [comment_id]: string[] }` |
| `wecatch_last_run` | 每次抓取完成 | ISO 8601 时间字符串 |
| `wecatch_last_new_count` | 每次抓取完成 | 新增顶层留言数 |
| `wecatch_is_capturing` | 抓取开始/结束 | 抓取锁（boolean） |

---

## 不在本 sprint 范围内

- 手动立即抓取（`TRIGGER_NOW` 消息处理）——Sprint 4
- 抓取进度展示（`PROGRESS` 广播）——Sprint 4
- 异常状态 UI 细化（错误提示卡片）——Sprint 4
- LLM Prompt 优化——独立任务
- Dashboard UI 改版——独立任务

---

## 验收标准

以下所有条件必须全部满足，sprint 才算完成：

### FETCH_AND_CAPTURE 消息

- [ ] Content Script 正确处理 `FETCH_AND_CAPTURE` 消息，返回 `{ ok, data: { articles, newTopLevelCount } }`
- [ ] 不传 `articleIds` 时，抓取所有有留言的文章
- [ ] 传入 `articleIds` 时，仅抓取指定文章
- [ ] 新增顶层留言正确送 `/api/analyze`，已见留言不重复发送
- [ ] 新增回复被记录到 articles 但不调用后端
- [ ] `wecatch_seen_ids` 在每次抓取后正确合并更新（只增不减）
- [ ] 首次运行（`wecatch_seen_ids` 为空）时，所有留言视为新增

### 增量对比逻辑

- [ ] 第一次抓取后，`wecatch_seen_ids` 包含所有已抓取的顶层 `content_id`
- [ ] 第二次抓取时，`newTopLevelCount` 只反映真正新增的留言数（不含第一次已有的）
- [ ] 手动在微信后台删除留言后再次抓取，`seen_ids` 不减少（已见 ID 保留）

### Service Worker alarm 集成

- [ ] alarm 触发后，若微信后台 Tab 存在，Content Script 收到 `FETCH_AND_CAPTURE` 消息并执行抓取
- [ ] 抓取完成后 `wecatch_last_run` 更新为当前时间（ISO 8601）
- [ ] 抓取完成后 `wecatch_last_new_count` 更新为本次新增数量
- [ ] 抓取完成后广播 `POLL_DONE { lastRun, newCount }`
- [ ] `wecatch_articles` 写入 `chrome.storage.local`，包含完整文章 + 留言数据
- [ ] 抓取过程中 alarm 再次触发时被锁跳过（log 可见）
- [ ] 任何异常后 `wecatch_is_capturing` 锁被正确释放

### NO_WX_TAB 处理

- [ ] 微信后台 Tab 不存在时，alarm 触发后 Side Panel 收到 `NO_WX_TAB` 并切换到引导状态
- [ ] 引导状态中"打开微信后台"按钮点击后，新 Tab 打开 `https://mp.weixin.qq.com`
- [ ] Content Script 未注入时（Tab 已打开但插件后装），Side Panel 收到 `CAPTURE_ERROR` 消息

### 存储迁移

- [ ] Dashboard 从 `chrome.storage.local.wecatch_articles` 读取数据，正确渲染留言列表
- [ ] 代码中不再有任何 `chrome.storage.session` 的读写（已全部清理）
- [ ] 自动轮询完成后，立即打开 Dashboard 可看到最新数据

### Side Panel 状态面板联动

- [ ] 收到 `POLL_DONE` 后，Side Panel "上次抓取"显示刚才的时间（如"刚刚"）
- [ ] 收到 `POLL_DONE` 后，Side Panel "新增留言"数字正确更新

### 构建

- [ ] `npm run build` 成功，无报错
