# WeCatch

抓取微信公众号留言，通过大模型自动分类，筛选有价值的留言供运营人员处理。

## 功能概览

1. 在微信公众号后台选择文章，一键抓取所有留言
2. 后端用通义千问对留言自动分类（读者提问 / 建议需求 / 合作意向 / 负面不满）
3. 管理后台查看分类结果，支持筛选、排序、展开回复，并导出 Excel

## 项目结构

```
WeCatch/
├── backend/                # Go REST API 后端
│   ├── cmd/server/         # 入口 main.go
│   └── internal/
│       ├── config/         # 环境变量配置
│       ├── handler/        # HTTP 请求处理（/api/analyze）
│       ├── llm/            # 通义千问 API 集成
│       ├── middleware/      # API Key 验证、CORS
│       └── tree/           # 留言线程组装逻辑
├── extension/              # Chrome 插件（Manifest V3）
│   ├── src/
│   │   ├── background/     # Service Worker（调度抓取流程）
│   │   ├── content/        # Content Script（注入微信公众号后台）
│   │   ├── popup/          # 插件弹窗（文章选择 + 抓取进度）
│   │   └── dashboard/      # 管理后台（留言浏览 + 导出）
│   └── dist/               # 构建产物（加载到 Chrome 的目录）
└── docs/                   # 设计文档与开发日志
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + JSX，Webpack 5 打包，内嵌 Chrome 插件 |
| 后端 | Go 1.25，chi 路由 |
| 大模型 | 通义千问 qwen-turbo（留言分类） |
| 认证 | X-API-Key 请求头 |

数据库：当前版本为无状态架构，不需要数据库。

---

## 环境要求

- Go 1.25+
- Node.js 18+
- 通义千问 API Key（[阿里云百炼平台](https://bailian.console.aliyun.com/) 申请）

---

## 启动后端

### 配置环境变量

**PowerShell：**

```powershell
$env:API_KEY = "dev-key"
$env:QIANWEN_API_KEY = "你的通义千问 API Key"
```

**bash：**

```bash
export API_KEY=dev-key
export QIANWEN_API_KEY=你的通义千问APIKey
```

`API_KEY` 是插件与后端通信的密钥，开发时保持默认 `dev-key` 即可（已与插件代码对应）。

### 启动

```bash
cd C:\Internship\WeCatch\backend
go run ./cmd/server/
```

启动成功输出：

```
WeCatch server starting on port 8080
```

---

## 构建并加载 Chrome 插件

### 第一步：安装依赖并构建

```bash
cd C:\Internship\WeCatch\extension
npm install
npm run build
```

构建成功输出 `webpack compiled successfully`，产物在 `extension/dist/`。

### 第二步：加载到 Chrome

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择 `C:\Internship\WeCatch\extension\dist\` 目录

---

## 使用流程

1. 打开微信公众号后台（`mp.weixin.qq.com`）“留言”页面
2. 点击 Chrome 工具栏中的 WeCatch 图标
3. 弹窗中显示文章列表，勾选要抓取的文章
4. 点击**抓取留言**，进度条实时更新
5. 抓取完成后点击**打开管理后台**
6. 管理后台左侧选择文章，右侧查看分类留言
7. 点击**导出**可将结果保存为 Excel 文件

### 留言分类说明

| 分类 | 说明 |
|------|------|
| 读者提问 | 读者对内容提出的问题 |
| 建议需求 | 对内容或产品的建议和期望 |
| 合作意向 | 商务合作相关留言 |
| 负面不满 | 批评或负面反馈 |
| 未分类 | 无法判断类别（模型返回异常或内容模糊） |

---

## 二次开发

修改前端代码后重新构建：

```bash
cd C:\Internship\WeCatch\extension
npm run build
```

回到 `chrome://extensions/` 点插件卡片上的**刷新按钮**即可生效。

运行后端测试：

```bash
cd C:\Internship\WeCatch\backend
go test ./...
```
