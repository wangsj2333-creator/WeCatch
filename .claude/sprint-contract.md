# Sprint 1 Contract — Side Panel 基础 + Manifest 变更

> Sprint: 1 of 4
> Created: 2026-03-30
> Source spec: `.claude/spec.md` §8 Sprint 1

---

## 目标

将插件入口从 Popup 切换到 Chrome Side Panel，实现 Side Panel 基础 UI 框架、微信后台检测和 Dashboard 导航。完成后用户可以用常驻侧边栏替代弹窗。

---

## 功能范围

### 1. Manifest 变更
- 新增权限：`sidePanel`、`alarms`
- 配置 `side_panel.default_path: "sidepanel.html"`
- 移除 `action.default_popup`，改为空的 `action: {}`

### 2. Webpack 构建配置
- 新增 entry：`sidepanel: './src/sidepanel/index.jsx'`
- 新增 HTML 模板：`dist/sidepanel.html`

### 3. Side Panel 入口注册
- Service Worker 启动时调用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
- 点击插件图标时打开 Side Panel（而非 Popup）

### 4. Side Panel 基础 UI（`src/sidepanel/`）
- Header：WeCatch logo + 标题
- 状态卡片（Status Card）：静态占位内容（上次抓取 / 新增留言 / 倒计时字段均显示占位符）
- 控制卡片（Control Card）：间隔选择器（2/5/10 分钟胶囊按钮，本 sprint 仅渲染 UI，不接逻辑）+ "立即抓取"按钮（本 sprint 不接逻辑）
- 底部导航区：Ghost 按钮"打开数据看板"
- 整体遵循 Ethereal Greenhouse 设计系统（渐变背景、磨砂玻璃卡片、字体规范）

### 5. 微信后台检测 + 引导状态（F8）
- Side Panel 加载时检测是否存在 `mp.weixin.qq.com` 活跃 Tab
- 未检测到：整个内容区替换为引导界面（提示图标 + 标题 + 描述 + 按钮）
- "打开微信后台"按钮：`chrome.tabs.create({ url: 'https://mp.weixin.qq.com' })`
- 检测到 Tab 后自动切回正常状态（监听 `chrome.tabs.onUpdated`）

### 6. Dashboard 导航（F9）
- 点击"打开数据看板"：查找已有 `dashboard.html` Tab，存在则 activate + reload，不存在则新建

---

## 不在本 sprint 范围内

- chrome.alarms 自动轮询逻辑（Sprint 2）
- 间隔选择器实际生效（Sprint 2）
- 倒计时实时更新（Sprint 2）
- FETCH_AND_CAPTURE 消息 + 增量对比（Sprint 3）
- 存储迁移 session -> local（Sprint 3）
- 手动抓取流程（Sprint 4）
- 抓取进度展示（Sprint 4）

---

## 验收标准

以下所有条件必须全部满足，sprint 才算完成：

### Manifest & 构建
- [ ] `manifest.json` 包含 `sidePanel` 和 `alarms` 权限
- [ ] `manifest.json` 存在 `side_panel.default_path: "sidepanel.html"`，无 `action.default_popup`
- [ ] `npm run build` 成功，`dist/sidepanel.html` 和对应 JS bundle 存在

### Side Panel 入口
- [ ] 点击插件图标打开的是 Side Panel，而非 Popup 弹窗
- [ ] Side Panel 在切换浏览器标签页后依然保持打开

### Side Panel UI
- [ ] Side Panel 正确显示 WeCatch logo 和标题
- [ ] 状态卡片渲染占位内容（上次抓取 / 新增留言 / 倒计时三个字段可见）
- [ ] 控制卡片渲染间隔选择器（2分钟 / 5分钟 / 10分钟三个胶囊按钮）和"立即抓取"按钮
- [ ] 整体视觉符合 Ethereal Greenhouse 设计规范（渐变背景、磨砂玻璃卡片）

### 微信后台检测
- [ ] 未打开 `mp.weixin.qq.com` 时，Side Panel 显示引导界面（含提示文字和按钮）
- [ ] 引导界面中"打开微信后台"按钮点击后正确新建或切换到 `mp.weixin.qq.com` Tab
- [ ] 已打开 `mp.weixin.qq.com` 时，Side Panel 显示正常主界面（不显示引导）
- [ ] 打开微信后台后，Side Panel 自动从引导状态切换为正常状态（无需手动刷新）

### Dashboard 导航
- [ ] 点击"打开数据看板"：Dashboard Tab 不存在时新建并打开
- [ ] 点击"打开数据看板"：Dashboard Tab 已存在时切换到该 Tab 并刷新
