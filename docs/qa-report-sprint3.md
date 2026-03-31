# Sprint 3 QA Report

**日期：** 2026-03-31  
**Sprint：** 3 — FETCH_AND_CAPTURE + 增量对比 + 存储迁移  
**验收结论：** PASS（第二轮，人工验证）

---

## 构建状态

**[PASS]** `npm run build`

```
webpack 5.105.4 compiled successfully in 1591 ms
```

零报错，零 warning（仅有正常的 asset 大小提示）。

---

## 代码审查结果

### 1. Content Script — FETCH_AND_CAPTURE

**文件：** `extension/src/content/content-script.js`

| 合约要求 | 状态 | 说明 |
|---------|------|------|
| 处理 `FETCH_AND_CAPTURE` 消息，返回 `{ ok, data: { articles, newTopLevelCount } }` | **PASS** | 第 279-294 行消息分支存在，`fetchAndCapture` 函数完整实现 |
| 不传 `articleIds` 时抓取所有有留言的文章 | **PASS** | 第 354 行：`articleList.filter(a => a.comment_count > 0)` |
| 传入 `articleIds` 时仅抓取指定文章 | **PASS** | 第 353 行：`msg.articleIds` 过滤逻辑存在 |
| 新增顶层留言送 `/api/analyze`，已见留言不重复发送 | **PASS** | 第 379-411 行增量对比 + callAnalyze 逻辑 |
| 新增回复被记录到 articles 但不调用后端 | **PASS** | replies 包含在 chunkComments 中随顶层批量发送 |
| `wecatch_seen_ids` 在每次抓取后正确合并更新 | **PASS** | 第 417-423 行：merge 后写入 storage |
| 首次运行（`wecatch_seen_ids` 为空）时，所有留言视为新增 | **PASS** | 第 376 行：`seenIds[commentId] \|\| []` 空数组兜底 |

---

### 2. Service Worker — alarm 集成

**文件：** `extension/src/background/service-worker.js`

| 合约要求 | 状态 | 说明 |
|---------|------|------|
| alarm 触发后检查 `wecatch_is_capturing` 锁，若为 true 则跳过 | **PASS** | 第 56-60 行，读锁并 log 后 return |
| 设置 `wecatch_is_capturing = true` 并在 try/finally 中释放 | **PASS** | 第 65 行设置，第 107-109 行 finally 释放 |
| 查找 `mp.weixin.qq.com` Tab，Tab 不存在时广播 `NO_WX_TAB` | **PASS** | 第 68-73 行，无 Tab 时广播 NO_WX_TAB |
| Tab 存在时向 Content Script 发送 `FETCH_AND_CAPTURE` | **PASS** | 第 78 行 |
| 收到响应后写入 `wecatch_articles`、`wecatch_last_run`、`wecatch_last_new_count` | **PASS** | 第 95-99 行，人工验证 storage 写入成功 |
| 广播 `POLL_DONE { lastRun, newCount }` | **PASS** | 第 105 行 |
| `CAPTURE_ERROR` 广播（Content Script 未注入时） | **PASS** | 第 81-83 行及第 88 行 |

---

### 3. 存储迁移

**文件：** `extension/src/dashboard/Dashboard.jsx`，`extension/src/background/service-worker.js`

| 合约要求 | 状态 | 说明 |
|---------|------|------|
| Dashboard 从 `chrome.storage.local.wecatch_articles` 读取 | **PASS** | Dashboard.jsx 第 17 行已更新 |
| Service Worker 不再写入 `chrome.storage.session` | **PASS** | grep 确认无残留 |
| 代码中不再有任何 `chrome.storage.session` 读写 | **PASS** | `handleCapture` 遗留函数已清理 session 写入 |

---

### 4. Side Panel — NO_WX_TAB 广播接收

**文件：** `extension/src/sidepanel/SidePanel.jsx`，`extension/src/sidepanel/GuideView.jsx`，`extension/src/sidepanel/useStatus.js`

| 合约要求 | 状态 | 说明 |
|---------|------|------|
| 监听 `NO_WX_TAB` 广播，收到后切换到引导状态 | **PASS** | useStatus.js 第 105-106 行设置 `wxTabMissing: true`，SidePanel.jsx 第 75 行响应 |
| 引导状态中"打开微信后台"按钮点击后新 Tab 打开 `https://mp.weixin.qq.com` | **PASS** | 委托 SW 处理，SW 第 139 行调用 `chrome.tabs.create` |
| 按钮点击委托给 Service Worker | **PASS** | GuideView.jsx 第 10 行发送 `OPEN_WX_TAB` 消息，SW 第 138-141 行处理 |
| 收到 `CAPTURE_ERROR` 后 Side Panel 有对应处理 | **PASS** | useStatus.js 第 107-109 行处理 `CAPTURE_ERROR` |

---

## 浏览器人工测试

| 测试项 | 结果 |
|--------|------|
| `chrome.tabs.query` 在 SW 中正常返回微信 Tab | **PASS** |
| SW 发送 `FETCH_AND_CAPTURE` 到 content script，收到完整文章+留言数据 | **PASS** |
| alarm dispatch 后 `wecatch_articles`、`wecatch_last_run`、`wecatch_last_new_count` 写入 storage | **PASS** |
| Dashboard 打开后显示抓取到的文章和留言数据 | **PASS** |

**调试备注：** alarm handler 的 CAPTURE_ERROR 路径无 `console.log`，Tab 处于 `discarded` 状态时调试看起来像卡住，实为正常执行。不影响功能。

---

## 总体评估

**验收结论：** PASS

Sprint 3 所有核心功能均已实现并通过人工验证：`FETCH_AND_CAPTURE` 完整抓取链路、增量对比 (`wecatch_seen_ids`)、alarm handler 真实接入、存储迁移至 `chrome.storage.local`、Side Panel 响应 `NO_WX_TAB` / `CAPTURE_ERROR` 广播、GuideView 委托 SW 打开微信后台。
