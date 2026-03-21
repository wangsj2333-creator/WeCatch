# WeCatch

抓取微信公众号留言，通过大模型自动分类，筛选出有价值的留言供运营人员处理。

## 项目结构

- Chrome 插件（Manifest V3）：抓取留言 + React 管理后台页面
- Go 后端：REST API
- PostgreSQL：数据存储
- 大模型：通义千问（留言分类）

## 技术栈

- 前端：React（打包在 Chrome 插件内）
- 后端：Go
- 数据库：PostgreSQL
- 认证：JWT

## 设计文档

- 完整设计规格：`docs/superpowers/specs/2026-03-21-wecatch-design.md`

## 开发语言

- 代码和注释使用英文
- 面向用户的文档使用中文
