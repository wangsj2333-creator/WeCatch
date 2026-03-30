# WeCatch 侧边栏 + 自动轮询设计

> 2026-03-30 brainstorm 产出。将 Popup 改为 Chrome Side Panel，并引入 chrome.alarms 自动轮询机制。

---

## 一、需求背景

朱总反馈两个核心改进方向：

1. **入口形态**：弹窗（Popup）改为侧边栏（Side Panel），常驻可见，不需要每次点击打开
2. **触发方式**：从用户手动触发改为每隔几分钟自动检查一次，用户无需操作

---

## 二、功能范围

### Side Panel（侧边栏）

**状态区**
- 上次抓取时间（"5 分钟前"）
- 上次抓取新增的顶层留言数量
- 距下次自动抓取的倒计时

**控制区**
- 间隔选择器：2 / 5 / 10 分钟（默认 5 分钟）
- 手动立即抓取按钮：点击后展开文章列表，勾选目标文章后确认触发

**导航区**
- 打开 Dashboard 按钮（常驻）
  - Dashboard Tab 已打开：切换到该 Tab 并刷新
  - Dashboard Tab 未打开：新建 Tab

**异常状态**
- 检测到微信公众号后台未打开时：显示提示文字 + "打开微信后台"按钮，点击跳转 `https://mp.weixin.qq.com`

---

### Service Worker（后台守护）

- 使用 `chrome.alarms` 按设定间隔自动触发抓取任务
- 支持以下消息指令：
  - `SET_INTERVAL`：更新轮询间隔（同时重置 alarm）
  - `TRIGGER_NOW`：立即触发一次抓取（传入选中文章 ID 列表）
  - `GET_STATUS`：返回当前状态（上次抓取时间、新增数量、下次触发时间）
- 抓取完成后：更新本地存储，向 Side Panel 广播 `POLL_DONE` 消息

---

### Content Script（网页内）

**新增消息类型 `FETCH_AND_CAPTURE`（取代原 FETCH_ARTICLES + CAPTURE_COMMENTS 两步）**

执行流程：
1. 全量抓取指定文章的所有留言（顶层 + 回复）
2. 与本地存储中已有的留言对比，找出新增的留言
3. 筛选出新增的**顶层留言**，送入后端进行大模型分类
4. 新增的**回复**不送大模型，仅做本地存储更新
5. 将最新全量留言数据返回给 Service Worker 存储

**微信后台检测**
- 若当前没有 `mp.weixin.qq.com` 的活跃 Tab，Service Worker 通知 Side Panel 显示引导状态

---

### 本地存储结构（chrome.storage.local）

| Key | 类型 | 说明 |
|-----|------|------|
| `wecatch_interval` | number | 轮询间隔（分钟），默认 5 |
| `wecatch_last_run` | string (ISO) | 上次抓取完成时间 |
| `wecatch_last_new_count` | number | 上次新增顶层留言数 |
| `wecatch_articles` | object[] | 最新全量文章 + 留言数据（供 Dashboard 读取） |
| `wecatch_seen_ids` | object | `{ [comment_id]: wx_comment_id[] }` 各文章已见留言 ID 集合，用于增量对比 |

---

### Manifest 变更

新增权限：
- `"sidePanel"`
- `"alarms"`

新增配置：
```json
"side_panel": {
  "default_path": "sidepanel.html"
}
```

移除：
- `action.default_popup`（改为点击图标打开 Side Panel）

---

## 三、数据流

```
chrome.alarms 触发
        ↓
Service Worker 检查微信后台 Tab 是否存在
        ├── 不存在 → 通知 Side Panel 显示引导状态，结束
        └── 存在 ↓
Service Worker 发送 FETCH_AND_CAPTURE 给 Content Script
        ↓
Content Script 全量抓取 → 对比 wecatch_seen_ids → 找出新增顶层留言
        ↓
Content Script 调用后端 /api/analyze（仅新增顶层留言）
        ↓
Service Worker 收到结果 → 更新 wecatch_articles / wecatch_seen_ids / wecatch_last_run / wecatch_last_new_count
        ↓
Service Worker 广播 POLL_DONE → Side Panel 刷新状态显示
```

---

## 四、不在本次范围内

- 方案 C（Side Panel + Alarms 双层控制）：后期优化再做
- LLM Prompt 优化：独立任务，不影响本次
- Dashboard UI 改版：已在另一个设计文档中

---

## 五、后续演进方向

- 升级为方案 C：在 Side Panel 增加独立的倒计时控制，Alarm 和 Side Panel 双层协同
- 支持抓取历史记录查看（本次只保留最新一次）
