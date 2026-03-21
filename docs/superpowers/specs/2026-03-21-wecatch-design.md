# WeCatch 设计文档

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
│  │ 拦截留言    │  │ 查看/筛选/     │  │
│  │ 手动触发    │  │ 管理留言       │  │
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
| content | text | 留言内容 |
| nickname | varchar | 留言者昵称 |
| comment_time | timestamp | 留言时间 |
| category | varchar | 分类：question / correction / negative / suggestion / discussion / cooperation / worthless |
| status | varchar | 处理状态：pending / replied / ignored |
| created_at | timestamp | 创建时间 |

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

## 核心业务流程

### 抓取流程

1. 用户打开微信公众号后台 (`mp.weixin.qq.com`) 的留言管理页面
2. 点击插件 Popup 上的"抓取留言"按钮
3. Content Script 拦截页面上的留言接口数据
4. 插件将留言数据（包含文章信息和公众号信息）发送到 Go 后端
5. 后端通过 `wx_comment_id` 去重，新留言存入数据库
6. 后端立即调用通义千问对新留言逐条分类
7. 分类结果写回数据库

### 大模型分析逻辑

- 每条留言单独发送给通义千问
- Prompt 包含留言内容和文章标题作为上下文
- 返回一个分类标签（八选一）
- 如果通义千问调用失败，留言正常存储，分类标为 `unclassified`，后续可重试

### 管理后台使用流程

1. 用户点击插件 Popup 的"打开管理后台"按钮，跳转到插件内的管理页面
2. 选择公众号 → 查看该公众号下的文章列表
3. 点击文章 → 查看该文章下的有价值留言（默认隐藏"无价值"类）
4. 可按分类类型筛选留言
5. 对留言标记处理状态（待处理 → 已回复 / 已忽略）

## Chrome 插件结构

### Popup（点击插件图标弹出）

- 显示登录状态
- "打开管理后台"跳转按钮
- "抓取留言"按钮（仅在 `mp.weixin.qq.com` 域名下可用）
- 抓取结果反馈（成功/失败、抓取条数）

### Content Script

- 仅在 `mp.weixin.qq.com` 域名下激活
- 拦截留言相关接口请求
- 等待 Popup 发出抓取指令后，将拦截到的数据发送给后端

### 管理后台页面 (dashboard.html)

- 完整的 React SPA，打包在插件内
- 通过 `chrome-extension://xxx/dashboard.html` 访问
- 页面包含：登录页、公众号列表、文章列表、留言列表、筛选和状态管理

## Go 后端 API

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |

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

### 文章

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/accounts/:id/articles | 某公众号下的文章列表 |

### 留言

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/articles/:id/comments | 某文章下的留言列表（支持按分类、处理状态筛选） |
| PUT | /api/comments/:id/status | 更新留言处理状态 |

## 第一版不包含的功能

以下功能计划在后续版本中实现：

- 数据统计（每篇文章的留言分类分布、负面率等）
- 数据导出（导出为 Excel 等格式）
