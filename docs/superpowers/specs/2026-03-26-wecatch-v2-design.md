# WeCatch 设计文档（v2）

> 本文档为全新简化版设计，替代原 v1.1 方案。核心变化：去掉数据库和用户系统，后端仅作为无状态处理服务。

## 项目概述

WeCatch 是一个 Chrome 插件，用于抓取微信公众号留言，通过大模型自动分类，筛选出需要处理的留言，并支持导出数据。

### 核心价值

公众号作者每天收到大量留言，大部分是"写得好"之类无需处理的内容。WeCatch 帮助运营人员快速识别需要关注的留言（读者提问、负面评论、合作意向等）。

### 目标用户

公司内部公众号运营人员。

## 系统架构

```
┌─────────────────────────────────────────────┐
│                  Chrome 插件                 │
│                                             │
│  ┌─────────────┐     ┌──────────────────┐   │
│  │ Content     │     │ Dashboard        │   │
│  │ Script      │     │ (React SPA)      │   │
│  │             │     │                  │   │
│  │ 抓取微信    │     │ 展示留言         │   │
│  │ 留言数据    │     │ 本地筛选         │   │
│  └──────┬──────┘     │ 导出 CSV/Excel   │   │
│         │ sendMessage└──────────────────┘   │
│  ┌──────▼──────┐                            │
│  │  Background │ POST 原始留言数据           │
│  │ Service     ├────────────────────────►   │
│  │ Worker      │                            │
│  └──────┬──────┘                            │
│  ┌──────▼──────┐                            │
│  │   Popup     │                            │
│  │ 触发抓取    │                            │
│  │ 显示进度    │                            │
│  └─────────────┘                            │
└─────────────────────────────────────────────┘
          │ POST /api/analyze
          ▼
┌─────────────────────────────────────────────┐
│             Go 后端（无状态）                │
│                                             │
│  ┌─────────────┐   ┌─────────────────────┐  │
│  │ Tree Builder│   │    LLM Analyzer     │  │
│  │ 整理留言树  │──▶│ 串行调通义千问      │  │
│  │ 结构        │   │ 返回分类结果        │  │
│  └─────────────┘   └─────────────────────┘  │
│                                             │
│  通义千问 API Key 仅存于后端环境变量         │
└─────────────────────────────────────────────┘
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 浏览器插件 | Chrome Extension (Manifest V3) |
| 管理后台前端 | React（打包在插件内） |
| 后端 | Go (REST API，无状态) |
| 大模型 | 通义千问 |
| 导出 | CSV / Excel |

## 数据流

1. 用户在 `mp.weixin.qq.com` 打开插件 Popup
2. Popup 向 Content Script 发消息 `FETCH_ARTICLES`，拉取文章列表（含留言计数）
3. 用户勾选文章，点击"抓取"
4. Popup 向 Content Script 发消息 `CAPTURE_COMMENTS`，Content Script 调微信后台接口（天然携带 Cookie），逐篇拉取全量留言（含分页、回复）
5. Content Script 将每篇文章的原始数据通过 `chrome.runtime.sendMessage` 传给 Background Service Worker
6. Service Worker 逐篇调用后端 `POST /api/analyze`（一篇文章一个请求），并将进度更新发给 Popup 显示
7. 后端整理为顶层留言 + 回复的树结构，串行逐条调通义千问分类，返回完整结构化结果
8. Service Worker 将所有文章的结果合并后写入 `chrome.storage.session`
9. 用户点击"打开 Dashboard"，Dashboard 从 `chrome.storage.session` 读取数据展示
10. 用户在 Dashboard 本地筛选，可随时导出

## Chrome 插件结构

### Popup

- 仅在 `mp.weixin.qq.com` 下显示"抓取"入口
- 展示有留言的文章列表（含留言计数），支持勾选
- 点击"抓取选中文章"触发 Content Script
- 显示逐篇处理进度（当前第几篇 / 共几篇）和最终结果摘要
- 提供"打开 Dashboard"按钮

### Content Script

- 匹配 `https://mp.weixin.qq.com/*`
- 从当前 URL 提取 `token` 等参数，调微信后台接口
- 响应两类消息：
  - `FETCH_ARTICLES`：拉取有留言的文章列表，返回文章标题 + 留言计数
  - `CAPTURE_COMMENTS`：对选中文章逐篇拉取全量留言（含分页和回复），逐篇回传给 Service Worker

**分页说明：** 微信后台留言接口使用游标分页，具体参数名（`begin` / `offset` 等）和游标字段需在实现前通过 Network 面板确认真实接口，不得凭猜测编码。每篇文章循环请求直到接口返回"无更多数据"为止。

### Background Service Worker

- 接收 Content Script 传来的每篇文章原始数据
- 逐篇调用后端 `POST /api/analyze`，携带 `X-API-Key` 请求头
- 将进度（当前篇 / 总篇数）推送给 Popup
- 收集所有文章的分析结果，全部完成后写入 `chrome.storage.session`

### Dashboard（dashboard.html）

- React SPA，打包在插件内，通过 `chrome-extension://xxx/dashboard.html` 访问
- 从 `chrome.storage.session` 读取抓取结果（session 期间跨页面可访问，关闭浏览器后清除）
- 功能：
  - 留言列表展示（顶层留言 + 缩进回复，显示父留言摘要）
  - 按分类筛选（客户端过滤）
  - 默认隐藏 `worthless` 类留言
  - 导出为 CSV 或 Excel

## 后端 API

### 认证

所有接口需在请求头携带 `X-API-Key: <key>`，Key 在后端环境变量中配置，同一个 Key 也配置在 Chrome 插件的 manifest 或构建时注入的环境变量中。

> **安全边界说明：** 此 Key 仅用于内部工具，部署在公网是为了让内部员工远程使用。Chrome 插件可被解压查看，Key 对知情的内部人员可见，此风险在内部使用场景下可接受。

### 接口

#### POST /api/analyze

插件提交一篇文章的原始留言数据，后端整理树结构 + 调大模型分析，返回完整结构化结果。

**请求体：**

```json
{
  "account": {
    "wx_account_id": "公众号原始ID",
    "name": "公众号名称"
  },
  "article": {
    "title": "文章标题",
    "url": "文章链接",
    "published_at": "2026-03-21T10:00:00Z"
  },
  "comments": [
    {
      "wx_comment_id": "微信留言原始ID",
      "reply_to_wx_id": "",
      "reply_to_nickname": "",
      "content": "留言内容",
      "nickname": "留言者昵称",
      "comment_time": 1742558400
    }
  ]
}
```

**字段说明：**
- 一次请求对应一篇文章，多篇文章由 Service Worker 串行发多个请求
- `reply_to_wx_id`：顶层留言为空字符串 `""`，回复留言为其父留言的 `wx_comment_id`；Tree Builder 以空字符串判断是否为顶层留言，不接受 `null`
- `comment_time`：Unix 时间戳（秒），整数；微信后台接口返回的原始格式，Content Script 直接透传，由后端统一转换为 ISO 8601

**响应体（HTTP 200）：**

顶层留言示例：

```json
{
  "wx_comment_id": "100",
  "reply_to_wx_id": "",
  "reply_to_nickname": "",
  "content": "请问作者...",
  "nickname": "张三",
  "comment_time": "2026-03-21T12:00:00Z",
  "category": "question",
  "parent_content_preview": ""
}
```

回复留言示例（无 `category` 字段）：

```json
{
  "wx_comment_id": "100_1",
  "reply_to_wx_id": "100",
  "reply_to_nickname": "",
  "content": "感谢解答！",
  "nickname": "李四",
  "comment_time": "2026-03-21T13:00:00Z",
  "parent_content_preview": "请问作者..."
}
```

**字段说明：**
- `category`：仅顶层留言有此字段；回复留言不返回该字段
- `parent_content_preview`：顶层留言为空字符串；回复留言为父留言内容截断至 50 个 Unicode 码点的摘要。若父留言在请求数据中不存在，返回空字符串

**错误响应：**

| HTTP 状态码 | 场景 |
|-------------|------|
| 400 | 请求体格式错误或必填字段缺失 |
| 401 | `X-API-Key` 缺失或错误 |
| 500 | 后端内部错误（LLM 全部失败时仍返回 200，各条标为 `unclassified`） |

## 后端处理逻辑

### Tree Builder

- 接收平铺的留言列表
- `reply_to_wx_id` 为空字符串 → 顶层留言；非空字符串 → 回复留言
- 为每条回复生成 `parent_content_preview`（截断至 50 个 Unicode 码点）
- 若父留言不在请求数据中，`parent_content_preview` 返回空字符串

### LLM Analyzer（通义千问）

**分析单位：** 以顶层留言为单位，将"顶层留言 + 它下面所有的回复"作为一个整体发给通义千问，让模型判断这条留言串属于哪种类型。分类标签只打在顶层留言上；回复留言不单独分类。

**prompt 内容：** 文章标题 + 顶层留言内容 + 该顶层留言下所有回复内容。

**并发策略：** 串行逐条（顶层留言）调用，不并发。单篇文章顶层留言量通常在数十条以内，串行耗时可接受。后续如遇性能问题再引入并发。

**失败兜底：**
- 大模型调用失败：该顶层留言分类标为 `unclassified`（大模型调用失败，分类未知），不影响其他留言处理，整体接口仍返回 200

## 留言分类

| 分类值 | 中文名 | 说明 |
|--------|--------|------|
| question | 读者提问 | 读者在问问题，等待作者回答 |
| correction | 纠错质疑 | 指出文章中的错误或不准确之处 |
| negative | 负面不满 | 表达不满或批评 |
| suggestion | 建议需求 | 提出内容建议或需求 |
| discussion | 深度讨论 | 有独到见解或补充信息 |
| cooperation | 合作意向 | 表达合作或商务意向 |
| worthless | 无价值 | 普通留言，不需要特别关注 |
| unclassified | 未分类 | 大模型调用失败，分类未知 |

## 导出格式

导出文件为 CSV 或 Excel，每行一条留言，字段包括：

| 字段 | 说明 |
|------|------|
| 公众号名称 | |
| 文章标题 | |
| 留言者昵称 | |
| 留言内容 | |
| 分类 | 中文名 |
| 是否为回复 | 是/否 |
| 父留言摘要 | 回复留言时显示，顶层留言为空 |
| 留言时间 | ISO 8601 格式 |

## 本版本不包含的功能

- 用户登录 / 权限系统
- 数据持久化（关闭浏览器后数据消失，靠导出保存）
- 从 Dashboard 跳转到微信后台对应留言
- 留言处理状态标记（已回复/已忽略）
- 数据统计
- LLM 分类重试（`unclassified` 留言需重新抓取才能重新分析）
