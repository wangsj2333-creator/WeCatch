# WeCatch

抓取微信公众号留言，通过大模型自动分类，筛选有价值的留言。

## 项目结构

- `backend/` — Go REST API 后端
- `extension/` — Chrome 插件（含 React 管理后台）
- `docs/` — 设计文档和实施计划

## 快速开始

### 后端

1. 安装 PostgreSQL 并创建数据库 `wecatch`
2. 复制 `backend/.env.example` 为 `.env`，修改配置
3. 启动：`cd backend && go run ./cmd/server/`

### Chrome 插件

1. 安装依赖：`cd extension && npm install`
2. 构建：`npm run build`
3. 在 Chrome 中加载 `extension/dist/` 目录为解压的扩展程序
4. 点击插件图标 → 打开管理后台 → 登录后即可使用
