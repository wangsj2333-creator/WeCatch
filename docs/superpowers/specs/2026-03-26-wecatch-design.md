# WeCatch 设计文档（v1.1）

> 本文档为 2026-03-21 原始设计文档的更新版，记录了回复留言支持相关的设计变更。

## 项目概述

WeCatch 是一个面向公司内部公众号运营人员的工具，用于抓取微信公众号留言并通过大模型自动分类，筛选出有价值的留言供运营人员关注和处理。

### 核心价值

公众号作者每天可能收到大量留言，其中大部分是"写得好"、"感谢分享"等无需处理的内容。WeCatch 帮助运营人员快速识别需要关注的留言（读者提问、负面评论、合作意向等），避免遗漏重要信息。

### 目标用户

公司内部公众号运营人员，一人可能管理多个公众号。

## 系统架构

系统由两大部分组成：Chrome 插件和 Go 后端。

```
┌──────────────────────────────────────┐
│            Chrome 插件                │
│                                      │
│  ┌────────────┐  ┌────────────────┐  │
│  │ Content    │  │ 管理后台页面    │  │
│  │ Script     │  │ (React SPA)    │  │
│  │            │  │                │  │
│  │ 主动请求    │  │ 查看/筛选/     │  │
│  │ 留言数据    │  │ 管理留言       │  │
│  └─────┬──────┘  └───────┬────────┘  │
│        │    ┌────────┐   │           │
│        │    │ Popup  │   │           │
│        │    │ 跳转按钮│   │           │
│        │    └────────┘   │           │
└────────┼─────────────────┼───────────┘
         │                 │
         ▼                 ▼
┌──────────────────────────────────────┐
│          Go 后端 (REST API)           │
│                                      │
│  ┌──────────┐ ┌──────────┐ ┌─────┐  │
│  │ 留言接收  │ │ 大模型分析│ │ 认证 │  │
│  └──────────┘ └──────────┘ └─────┘  │
│                    │                 │
│              ┌─────▼─────┐           │
│              │ PostgreSQL │           │
│              └───────────┘           │
└──────────────────────────────────────┘
```

### 部署清单

- Go 后端服务 + PostgreSQL 数据库，部署在公司服务器上
- Chrome 插件安装包，内含 React 管理后台页面，无需单独部署前端

## 技术栈

| 组件 | 技术 |
|------|------|
| 浏览器插件 | Chrome Extension (Manifest V3) |
| 管理后台前端 | React（打包在插件内） |
| 后端 | Go (REST API) |
| 数据库 | PostgreSQL |
| 大模型 | 通义千问 |

## 数据模型

### 用户表 (users)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| username | varchar | 账号 |
| password | varchar | 密码（哈希存储） |
| role | varchar | 角色：admin / user |
| created_at | timestamp | 创建时间 |

### 公众号表 (accounts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| wx_account_id | varchar | 微信公众号 ID |
| name | varchar | 公众号名称 |
| created_at | timestamp | 创建时间 |

### 用户-公众号关联表 (user_accounts)

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | bigint | 关联用户 |
| account_id | bigint | 关联公众号 |

### 文章表 (articles)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| account_id | bigint | 所属公众号 |
| title | varchar | 文章标题 |
| url | varchar | 文章链接 |
| published_at | timestamp | 发布时间 |
| created_at | timestamp | 创建时间 |

### 留言表 (comments)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| article_id | bigint | 所属文章 |
| wx_comment_id | varchar | 微信留言原始 ID（用于去重） |
| reply_to_wx_id | varchar | 父留言的微信 ID；空字符串表示顶层留言 |
| reply_to_nickname | varchar | 回复对象的昵称；顶层留言为空 |
| content | text | 留言内容 |
| nickname | varchar | 留言者昵称 |
| comment_time | timestamp | 留言时间 |
| category | varchar | 分类标签（见下表） |
| status | varchar | 处理状态：pending / replied / ignored |
| created_at | timestamp | 创建时间 |

> **派生响应字段（不存储在表中）：** `parent_content_preview` 是 API 响应中的计算字段，由后端在查询时通过 JOIN 父留言并截断生成，不对应数据库列。

#### 留言层级说明

微信留言为两层结构，不支持无限嵌套：
- **顶层留言**：直接回复文章，`reply_to_wx_id` 为空字符串，`reply_to_nickname` 为空字符串
- **回复**：回复顶层留言，`reply_to_wx_id` 指向顶层留言的 `wx_comment_id`；`reply_to_nickname` 记录回复对象的昵称——当评论区内某人 @ 另一位用户时（如"回复@张三"），该字段为被 @ 者的昵称；若直接回复顶层留言（未 @ 任何人），则为空字符串

示例：顶层留言 A → 回复 B（直接回复 A，`reply_to_nickname` = ""）→ 回复 C（@ 了 B，`reply_to_nickname` = "B的昵称"）。B 和 C 在数据库中的 `reply_to_wx_id` 均指向 A。

#### 留言分类说明

| 分类值 | 中文名 | 说明 |
|--------|--------|------|
| question | 读者提问 | 读者在问问题，等待作者回答 |
| correction | 纠错质疑 | 指出文章中的错误或不准确之处 |
| negative | 负面不满 | 表达不满或批评 |
| suggestion | 建议需求 | 提出内容建议或需求 |
| discussion | 深度讨论 | 有独到见解或补充信息 |
| cooperation | 合作意向 | 表达合作或商务意向 |
| worthless | 无价值 | 普通留言，不需要特别关注 |
| unclassified | 未分类 | 大模型调用失败，待重试 |

#### 处理状态说明

| 状态值 | 中文名 | 说明 |
|--------|--------|------|
| pending | 待处理 | 新留言默认状态 |
| replied | 已回复 | 已在公众号后台回复 |
| ignored | 已忽略 | 确认不需要处理 |

父子留言处理状态互相独立，不联动。

## 核心业务流程

### 抓取流程

1. 用户打开微信公众号后台 (`mp.weixin.qq.com`) 的留言管理页面
2. 点击插件图标打开 Popup；Popup 自动触发 Content Script 拉取有留言的文章列表，展示文章标题和留言计数，默认全选
3. 用户确认或调整勾选，点击"抓取选中文章"按钮
4. Content Script 主动调用微信公众号后台接口（天然携带 Cookie），对选中文章逐篇拉取全量留言（含分页、回复）
5. 插件将留言数据（包含文章信息和公众号信息）逐篇发送到 Go 后端
6. 后端通过 `wx_comment_id` 去重，新留言存入数据库
7. 后端对新留言逐条调用通义千问分类
8. 分类结果写回数据库

### 大模型分类逻辑

**顶层留言**
- 单独送给通义千问，prompt 包含文章标题和留言内容

**回复留言**
- 内容 Unicode 码点数（Go 中 `len([]rune(s))`）≤ 10：跳过大模型，直接标记为 `worthless`
- 内容 Unicode 码点数 > 10：送给通义千问，prompt 包含文章标题、父留言内容、回复内容

**失败兜底**
- 大模型调用失败：留言正常存储，分类标为 `unclassified`，后续可重试

### 管理后台使用流程

1. 用户点击插件 Popup 的"打开管理后台"按钮，跳转到插件内的管理页面
2. 选择公众号 → 查看该公众号下的文章列表
3. 点击文章 → 前端拉取该文章下全量留言（接口不做服务端过滤，返回所有分类和状态的留言），本地缓存完整数据集
   - 默认隐藏 `worthless` 类留言（客户端过滤）
   - 可按分类类型筛选（客户端过滤，父子留言各自独立匹配，不联动）
4. 留言列表展示规则：
   - 每条留言作为独立条目展示
   - 回复留言在内容下方常驻显示一行灰色小字，格式：`↩ 父留言：[父留言内容，截断至 50 个 Unicode 码点]`；若 `parent_content_preview` 为空字符串则不显示该行
   - 点击任意条目 → 弹出 Modal；前端从本地缓存数据集（全量，含被过滤隐藏的条目）中取出对应顶层留言及其所有回复，展示完整串。Modal 始终显示完整上下文，不受当前筛选条件影响。若顶层留言被过滤隐藏，用户点击其某条可见回复时，Modal 中仍会显示该顶层留言。若顶层留言可见但其回复均被过滤，Modal 中只展示该顶层留言本身。
5. 对留言标记处理状态（待处理 → 已回复 / 已忽略）

## Chrome 插件结构

### Popup（点击插件图标弹出）

- 显示登录状态
- "打开管理后台"跳转按钮
- "抓取留言"按钮（仅在 `mp.weixin.qq.com` 域名下可用）
- 展示有留言的文章列表（含留言计数），支持勾选
- 抓取结果反馈（成功/失败、新增条数/重复跳过条数）

### Content Script

- 在 `mp.weixin.qq.com` 域名下所有页面激活（`manifest.json` matches: `https://mp.weixin.qq.com/*`）
- 文章列表拉取不依赖当前页面内容，而是通过当前 URL 中的 `token`、`sendtype`、`lang` 参数调用微信后台接口；这些参数在 `mp.weixin.qq.com` 的所有页面 URL 中均存在，因此 content script 在任意子页面下均可正常工作
- 响应 Popup 的两类消息：
  - `FETCH_ARTICLES`：主动请求文章列表（含留言计数），返回给 Popup 显示
  - `CAPTURE_COMMENTS`：对选中文章逐篇拉取全量留言（含分页、回复），返回给 Popup 提交后端

### 管理后台页面 (dashboard.html)

- 完整的 React SPA，打包在插件内
- 通过 `chrome-extension://xxx/dashboard.html` 访问
- 页面包含：登录页、公众号列表、文章列表、留言列表（含筛选、状态管理、父串 Modal）

## Go 后端 API

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录，返回 JWT token |
| POST | /api/auth/logout | 登出 |

认证方式：JWT。插件和管理后台在请求头中携带 `Authorization: Bearer <token>`。

### 用户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/users | 创建用户 |
| GET | /api/users | 用户列表 |

### 公众号

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/accounts | 当前用户管理的公众号列表 |
| POST | /api/accounts | 添加公众号 |

### 留言抓取

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/comments/batch | 插件批量提交留言数据，后端去重、存储、触发大模型分析 |

**POST /api/comments/batch 请求体格式：**

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
      "comment_time": "2026-03-21T12:00:00Z"
    }
  ]
}
```

**账号去重规则：** 以 `wx_account_id` 为唯一键做 upsert。若该公众号已存在，则用请求中的 `name` 更新其名称；若不存在，则新建记录。

**文章去重规则：** 以 `url` 为唯一键做 upsert。若文章已存在，不更新任何字段；若不存在，则新建记录。

**留言去重规则：** 以 `wx_comment_id` 为唯一键。已存在的留言跳过，仅插入新留言并触发分类。

### 文章

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/accounts/:id/articles | 某公众号下的文章列表（v1 返回全量，不分页） |

**GET /api/accounts/:id/articles 响应格式（单条文章）：**

```json
{
  "id": 1,
  "title": "文章标题",
  "url": "https://mp.weixin.qq.com/...",
  "published_at": "2026-03-21T10:00:00Z",
  "created_at": "2026-03-21T10:05:00Z"
}
```

响应中不包含 `account_id`，调用方已通过请求路径 `:id` 知晓所属公众号。

**权限：** 用户只能访问自己通过 `user_accounts` 关联的公众号；请求不属于该用户管理范围的公众号 ID 时，返回 403。

### 留言

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/articles/:id/comments | 某文章下的全量留言列表（v1 返回全量，不分页，不支持服务端过滤，由客户端筛选） |
| PUT | /api/comments/:id/status | 更新留言处理状态 |

**权限：** 两个接口均要求当前用户对该文章所属的公众号拥有 `user_accounts` 关联；否则返回 403。管理后台的文章列表只展示用户有权访问的公众号下的文章，不展示留言计数（计数由 Popup 从微信 API 实时获取，不存储在后端）。

**PUT /api/comments/:id/status 请求体格式：**

```json
{
  "status": "replied"
}
```

`status` 可选值：`pending` / `replied` / `ignored`。

**GET /api/articles/:id/comments 响应格式（单条留言）：**

```json
{
  "id": 1,
  "wx_comment_id": "100_1",
  "reply_to_wx_id": "100",
  "reply_to_nickname": "",
  "content": "感谢解答！",
  "nickname": "张三",
  "comment_time": "2026-03-21T12:00:00Z",
  "category": "worthless",
  "status": "pending",
  "parent_content_preview": "这篇文章太棒了，请问作者..."
}
```

`parent_content_preview`：顶层留言时为空字符串；回复留言时为父留言内容截断至 50 个 Unicode 码点的摘要（由后端在查询时生成）。若父留言在数据库中不存在（如抓取遗漏），返回空字符串，前端不显示摘要行。

## 第一版不包含的功能

以下功能计划在后续版本中实现：

- 从管理后台快速跳转到微信公众号后台对应留言的位置（方便直接在微信后台操作）
- 数据统计（每篇文章的留言分类分布、负面率等）
- 数据导出（导出为 Excel 等格式）
