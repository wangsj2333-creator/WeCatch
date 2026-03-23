# WeCatch

抓取微信公众号留言，通过大模型自动分类，筛选有价值的留言。

## 项目结构

```
WeCatch/
├── backend/          # Go REST API 后端（在 .worktrees/backend/backend/）
├── extension/        # Chrome 插件源码
│   ├── src/          # React TypeScript 源码
│   ├── dist/         # 构建产物（加载到 Chrome 的目录）
│   ├── popup/        # 插件弹窗（纯 JS）
│   └── content/      # 留言抓取脚本
└── docs/             # 设计文档和实施计划
```

---

## 环境要求

- Go 1.21+
- Node.js 18+
- PostgreSQL 14+

---

## 启动后端

### 第一步：创建数据库

```bash
# 用 psql 连接后执行
CREATE DATABASE wecatch;
```

或者用命令行：

```bash
createdb wecatch
```

### 第二步：配置环境变量（PowerShell）

```powershell
$env:DATABASE_URL = "postgres://postgres:你的密码@localhost:5432/wecatch?sslmode=disable"
$env:JWT_SECRET = "随便填一个字符串"
$env:QIANWEN_API_KEY = "你的通义千问 API Key"  # 可选，不填则分类功能禁用
```

如果 PostgreSQL 密码就是 `postgres`，`DATABASE_URL` 可以不设，用默认值即可。

### 第三步：启动

```powershell
cd C:\Internship\WeCatch\.worktrees\backend\backend
go run ./cmd/server/
```

启动成功后输出：

```
Default admin user created (username: admin, password: admin123)
WeCatch server starting on port 8080
```

> 默认账号：用户名 `admin`，密码 `admin123`，首次登录后请修改密码。

---

## 构建并加载 Chrome 插件

### 第一步：安装依赖并构建

```powershell
cd C:\Internship\WeCatch\extension
npm install
npm run build
```

构建成功后输出：`webpack compiled successfully`，产物在 `extension/dist/`。

### 第二步：加载到 Chrome

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择 `C:\Internship\WeCatch\extension\dist\` 目录

### 第三步：使用

1. Chrome 工具栏点击 WeCatch 图标
2. 点击**打开管理后台** → 用 `admin / admin123` 登录
3. 登录成功后，在微信公众号后台（`mp.weixin.qq.com`）任意页面点插件图标
4. 点击**抓取留言** → 留言自动上传后端并完成 AI 分类
5. 管理后台查看分类结果，处理留言

---

## 二次开发

修改前端代码后重新构建：

```powershell
cd C:\Internship\WeCatch\extension
npm run build
```

然后回到 `chrome://extensions/` 点击插件卡片上的刷新按钮即可生效。
