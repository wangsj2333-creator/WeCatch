# WeCatch v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that captures WeChat public account comments, sends them to a lightweight Go backend for LLM classification, and displays the results in a React dashboard with CSV/Excel export.

**Architecture:** Chrome Extension (Content Script + Service Worker + React SPA) communicates with a stateless Go backend. The backend organizes comments into threads and calls Qianwen to classify each thread. No database — data lives in `chrome.storage.session` for the browser session.

**Tech Stack:** Go (chi router), Chrome Extension MV3, React, webpack, Qianwen API

**Spec:** `docs/superpowers/specs/2026-03-26-wecatch-v2-design.md`

---

## Execution Order

```
Phase 1 (parallel): B1, P1
Phase 2 (parallel): B2, B3, P2
Phase 3 (sequential): B4 (needs B2+B3), then P3 (needs P2+B4)
Phase 4 (parallel): P4, P5
```

---

## File Map

### Backend

| File | Responsibility |
|------|---------------|
| `cmd/server/main.go` | Entry point, wires everything together |
| `internal/config/config.go` | Read env vars (port, API key, Qianwen key) |
| `internal/middleware/apikey.go` | API key validation middleware |
| `internal/server/server.go` | HTTP server, route registration |
| `internal/tree/builder.go` | Organize flat comment list into top-level + replies |
| `internal/llm/client.go` | HTTP client for Qianwen API |
| `internal/llm/analyzer.go` | Build prompts, call client, parse category response |
| `internal/handler/analyze.go` | POST /api/analyze: orchestrate tree + LLM, build response |

### Plugin

| File | Responsibility |
|------|---------------|
| `extension/manifest.json` | Chrome extension config, permissions |
| `extension/babel.config.json` | Babel preset config for JSX transformation |
| `extension/src/background/service-worker.js` | Receive data from content script, call backend, write session storage, push progress to popup |
| `extension/src/content/content-script.js` | Fetch WeChat article list and comments using page cookies |
| `extension/src/popup/popup.html` | Popup shell HTML |
| `extension/src/popup/index.jsx` | Popup React entry point |
| `extension/src/popup/Popup.jsx` | Article list with checkboxes, progress display, open dashboard button |
| `extension/src/dashboard/dashboard.html` | Dashboard shell HTML |
| `extension/src/dashboard/index.jsx` | Dashboard React entry point |
| `extension/src/dashboard/Dashboard.jsx` | Root component, reads from session storage |
| `extension/src/dashboard/categories.js` | Category key→label mapping |
| `extension/src/dashboard/components/CommentList.jsx` | Render comment list with reply indentation |
| `extension/src/dashboard/components/FilterBar.jsx` | Category filter UI |
| `extension/src/dashboard/components/ExportButton.jsx` | (inline in Dashboard.jsx — no separate file needed) |
| `extension/src/dashboard/export.js` | Build and download Excel file |
| `extension/webpack.config.js` | Build config: popup + dashboard + content script + service worker |
| `extension/package.json` | JS dependencies |

---

## Phase 1 — Foundation

### Task B1: Backend Server + API Key Middleware + CORS

**Files:**
- Create: `cmd/server/main.go`
- Create: `internal/config/config.go`
- Create: `internal/middleware/apikey.go`
- Create: `internal/middleware/cors.go`
- Create: `internal/server/server.go`
- Test: `internal/middleware/apikey_test.go`

- [ ] **Step 1: Initialize Go module**

```bash
cd backend   # (or wherever the Go code lives — confirm actual directory)
go mod init wecatch
go get github.com/go-chi/chi/v5
```

- [ ] **Step 2: Create config.go**

```go
package config

import "os"

type Config struct {
    Port        string
    APIKey      string
    QianwenKey  string
}

func Load() Config {
    return Config{
        Port:       getEnv("PORT", "8080"),
        APIKey:     mustEnv("API_KEY"),
        QianwenKey: mustEnv("QIANWEN_API_KEY"),
    }
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}

func mustEnv(key string) string {
    v := os.Getenv(key)
    if v == "" {
        panic("required env var not set: " + key)
    }
    return v
}
```

- [ ] **Step 3: Write failing test for API key middleware**

```go
// internal/middleware/apikey_test.go
package middleware_test

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "wecatch/internal/middleware"
)

func TestAPIKeyMiddleware_MissingKey(t *testing.T) {
    handler := middleware.APIKey("secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))
    req := httptest.NewRequest("POST", "/", nil)
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)
    if rr.Code != http.StatusUnauthorized {
        t.Fatalf("expected 401, got %d", rr.Code)
    }
}

func TestAPIKeyMiddleware_WrongKey(t *testing.T) {
    handler := middleware.APIKey("secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))
    req := httptest.NewRequest("POST", "/", nil)
    req.Header.Set("X-API-Key", "wrong")
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)
    if rr.Code != http.StatusUnauthorized {
        t.Fatalf("expected 401, got %d", rr.Code)
    }
}

func TestAPIKeyMiddleware_CorrectKey(t *testing.T) {
    handler := middleware.APIKey("secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))
    req := httptest.NewRequest("POST", "/", nil)
    req.Header.Set("X-API-Key", "secret")
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)
    if rr.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
}
```

- [ ] **Step 4: Run test — expect FAIL**

```bash
go test ./internal/middleware/...
```

- [ ] **Step 5: Implement middleware**

```go
// internal/middleware/apikey.go
package middleware

import "net/http"

func APIKey(key string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if r.Header.Get("X-API-Key") != key {
                http.Error(w, "unauthorized", http.StatusUnauthorized)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

- [ ] **Step 6: Run test — expect PASS**

```bash
go test ./internal/middleware/...
```

- [ ] **Step 7: Create cors.go, server.go and main.go**

```go
// internal/middleware/cors.go
package middleware

import "net/http"

// CORS adds headers to allow requests from Chrome extension origins.
func CORS(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

```go
// internal/server/server.go
package server

import (
    "net/http"
    "github.com/go-chi/chi/v5"
    "wecatch/internal/middleware"
)

// New creates the HTTP handler. analyzeHandler is injected in Phase 3 (B4).
func New(apiKey string) http.Handler {
    r := chi.NewRouter()
    r.Use(middleware.CORS)
    r.Use(middleware.APIKey(apiKey))
    // routes registered in B4
    return r
}
```

```go
// cmd/server/main.go
package main

import (
    "fmt"
    "net/http"
    "wecatch/internal/config"
    "wecatch/internal/server"
)

func main() {
    cfg := config.Load()
    h := server.New(cfg.APIKey)
    fmt.Printf("server starting on :%s\n", cfg.Port)
    http.ListenAndServe(":"+cfg.Port, h)
}
```

- [ ] **Step 8: Smoke test — server starts**

```bash
API_KEY=test QIANWEN_API_KEY=test go run cmd/server/main.go
# expected: "server starting on :8080"
# Ctrl+C to stop
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat(backend): HTTP server with API key middleware"
```

---

### Task P1: Chrome Extension Scaffold

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/package.json`
- Create: `extension/webpack.config.js`
- Create: `extension/src/popup/popup.html`
- Create: `extension/src/dashboard/dashboard.html`

- [ ] **Step 1: Initialize npm project**

```bash
mkdir -p extension && cd extension
npm init -y
npm install --save-dev webpack webpack-cli babel-loader @babel/core @babel/preset-env @babel/preset-react react react-dom
```

- [ ] **Step 2: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "WeCatch",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://mp.weixin.qq.com/*"],
  "background": {
    "service_worker": "dist/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://mp.weixin.qq.com/*"],
      "js": ["dist/content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html"
  },
  "web_accessible_resources": [
    {
      "resources": ["src/dashboard/dashboard.html"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 3: Create webpack.config.js**

```js
const path = require('path');

module.exports = {
  mode: 'development',
  devtool: 'cheap-source-map',
  entry: {
    'service-worker': './src/background/service-worker.js',
    'content-script': './src/content/content-script.js',
    popup: './src/popup/index.jsx',
    dashboard: './src/dashboard/index.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: { extensions: ['.js', '.jsx'] },
};
```

- [ ] **Step 4: Create stub entry files**

Create `extension/src/background/service-worker.js`:
```js
console.log('WeCatch service worker loaded');
```

Create `extension/src/content/content-script.js`:
```js
console.log('WeCatch content script loaded');
```

Create `extension/src/popup/index.jsx`:
```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<div>Popup</div>);
```

Create `extension/src/popup/popup.html`:
```html
<!DOCTYPE html>
<html><body><div id="root"></div><script src="../../dist/popup.js"></script></body></html>
```

Create `extension/src/dashboard/index.jsx`:
```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<div>Dashboard</div>);
```

Create `extension/src/dashboard/dashboard.html`:
```html
<!DOCTYPE html>
<html><body><div id="root"></div><script src="../../dist/dashboard.js"></script></body></html>
```

- [ ] **Step 4b: Create babel.config.json**

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-react"]
}
```

- [ ] **Step 5: Build and verify**

```bash
cd extension && npx webpack
# expected: dist/ folder created with 4 JS files, no errors
```

- [ ] **Step 6: Load extension in Chrome and verify**

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked", select the `extension/` folder
4. Verify extension icon appears in toolbar
5. Open `chrome-extension://<id>/src/popup/popup.html` — should show "Popup"

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(extension): Chrome extension scaffold with webpack build"
```

---

## Phase 2 — Core Logic

### Task B2: Tree Builder

**Files:**
- Create: `internal/tree/builder.go`
- Create: `internal/tree/builder_test.go`

- [ ] **Step 1: Define types**

```go
// internal/tree/builder.go
package tree

type RawComment struct {
    WxCommentID    string `json:"wx_comment_id"`
    ReplyToWxID    string `json:"reply_to_wx_id"`
    ReplyToNickname string `json:"reply_to_nickname"`
    Content        string `json:"content"`
    Nickname       string `json:"nickname"`
    CommentTime    int64  `json:"comment_time"`
}

type Thread struct {
    Top     RawComment
    Replies []RawComment
}
```

- [ ] **Step 2: Write failing tests**

```go
// internal/tree/builder_test.go
package tree_test

import (
    "testing"
    "wecatch/internal/tree"
)

func TestBuild_SingleTopLevel(t *testing.T) {
    comments := []tree.RawComment{
        {WxCommentID: "1", ReplyToWxID: "", Content: "hello"},
    }
    threads := tree.Build(comments)
    if len(threads) != 1 {
        t.Fatalf("expected 1 thread, got %d", len(threads))
    }
    if threads[0].Top.WxCommentID != "1" {
        t.Fatalf("unexpected top comment id")
    }
    if len(threads[0].Replies) != 0 {
        t.Fatalf("expected no replies")
    }
}

func TestBuild_WithReplies(t *testing.T) {
    comments := []tree.RawComment{
        {WxCommentID: "1", ReplyToWxID: "", Content: "top"},
        {WxCommentID: "2", ReplyToWxID: "1", Content: "reply1"},
        {WxCommentID: "3", ReplyToWxID: "1", Content: "reply2"},
    }
    threads := tree.Build(comments)
    if len(threads) != 1 {
        t.Fatalf("expected 1 thread, got %d", len(threads))
    }
    if len(threads[0].Replies) != 2 {
        t.Fatalf("expected 2 replies, got %d", len(threads[0].Replies))
    }
}

func TestBuild_MultipleTopLevel(t *testing.T) {
    comments := []tree.RawComment{
        {WxCommentID: "1", ReplyToWxID: "", Content: "top1"},
        {WxCommentID: "2", ReplyToWxID: "", Content: "top2"},
        {WxCommentID: "3", ReplyToWxID: "1", Content: "reply to top1"},
    }
    threads := tree.Build(comments)
    if len(threads) != 2 {
        t.Fatalf("expected 2 threads, got %d", len(threads))
    }
}
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
go test ./internal/tree/...
```

- [ ] **Step 4: Implement Build()**

```go
func Build(comments []RawComment) []Thread {
    index := make(map[string]*Thread)
    var order []string

    for _, c := range comments {
        if c.ReplyToWxID == "" {
            cp := c
            index[c.WxCommentID] = &Thread{Top: cp}
            order = append(order, c.WxCommentID)
        }
    }
    for _, c := range comments {
        if c.ReplyToWxID != "" {
            if t, ok := index[c.ReplyToWxID]; ok {
                t.Replies = append(t.Replies, c)
            }
        }
    }

    result := make([]Thread, 0, len(order))
    for _, id := range order {
        result = append(result, *index[id])
    }
    return result
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
go test ./internal/tree/...
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(backend): Tree Builder organizes flat comments into threads"
```

---

### Task B3: LLM Analyzer

> **⚠️ Before implementing:** Confirm the Qianwen API endpoint, request format, and response format by asking the user or checking the official documentation. Do not assume. The implementation below is a placeholder — fill in the actual API details before coding.

**Files:**
- Create: `internal/llm/client.go`
- Create: `internal/llm/analyzer.go`
- Create: `internal/llm/analyzer_test.go`

- [ ] **Step 1: Confirm Qianwen API details with user before writing any code**

Ask:
1. What is the Qianwen API endpoint URL?
2. What does the request body look like (model name, message format)?
3. What does the response look like (where is the generated text)?

- [ ] **Step 2: Write failing test for category parsing**

```go
// internal/llm/analyzer_test.go
package llm_test

import (
    "testing"
    "wecatch/internal/llm"
)

func TestParseCategory_ValidValues(t *testing.T) {
    cases := []struct {
        input    string
        expected string
    }{
        {"question", "question"},
        {"negative", "negative"},
        {"worthless", "worthless"},
        {"QUESTION", "question"},       // case insensitive
        {"  question  ", "question"},   // trim whitespace
        {"garbage", "unclassified"},    // unknown → unclassified
        {"", "unclassified"},           // empty → unclassified
    }
    for _, c := range cases {
        got := llm.ParseCategory(c.input)
        if got != c.expected {
            t.Errorf("ParseCategory(%q) = %q, want %q", c.input, got, c.expected)
        }
    }
}
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
go test ./internal/llm/...
```

- [ ] **Step 4: Implement ParseCategory()**

```go
// internal/llm/analyzer.go
package llm

import (
    "strings"
)

var validCategories = map[string]bool{
    "question": true, "correction": true, "negative": true,
    "suggestion": true, "discussion": true, "cooperation": true,
    "worthless": true,
}

func ParseCategory(raw string) string {
    s := strings.ToLower(strings.TrimSpace(raw))
    if validCategories[s] {
        return s
    }
    return "unclassified"
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
go test ./internal/llm/...
```

- [ ] **Step 6: Implement Qianwen client (fill in API details confirmed in Step 1)**

```go
// internal/llm/client.go
package llm

// TODO: fill in actual Qianwen API endpoint and request/response structs
// confirmed with user before coding

type Client struct {
    apiKey  string
    baseURL string // confirmed from user
}

func NewClient(apiKey string) *Client {
    return &Client{
        apiKey:  apiKey,
        baseURL: "TODO",
    }
}

// Classify sends a prompt to Qianwen and returns the raw text response.
func (c *Client) Classify(prompt string) (string, error) {
    // TODO: implement after confirming API details
    return "", nil
}
```

- [ ] **Step 6b: Confirm prompt wording with user before proceeding**

Ask the user: "这是我打算发给通义千问的 prompt 结构：文章标题 + 顶层留言 + 所有回复，最后要求模型只回答分类英文名。你觉得措辞需要调整吗？"

Only proceed to Step 7 after the user approves the prompt structure.

- [ ] **Step 7: Implement Analyzer.ClassifyThread()**

```go
// add to internal/llm/analyzer.go

import "wecatch/internal/tree"

type Analyzer struct {
    client *Client
}

func NewAnalyzer(client *Client) *Analyzer {
    return &Analyzer{client: client}
}

// ClassifyThread sends a full thread (top + replies) to Qianwen.
// Returns a category string for the top-level comment only.
func (a *Analyzer) ClassifyThread(articleTitle string, thread tree.Thread) string {
    prompt := buildPrompt(articleTitle, thread)
    raw, err := a.client.Classify(prompt)
    if err != nil {
        return "unclassified"
    }
    return ParseCategory(raw)
}

func buildPrompt(articleTitle string, thread tree.Thread) string {
    // TODO: finalize prompt wording with user before implementation
    var sb strings.Builder
    sb.WriteString("文章标题：" + articleTitle + "\n\n")
    sb.WriteString("留言：" + thread.Top.Content + "\n")
    for _, r := range thread.Replies {
        sb.WriteString("回复：" + r.Content + "\n")
    }
    sb.WriteString("\n请判断这条留言属于以下哪个类别，只回答类别英文名：\n")
    sb.WriteString("question / correction / negative / suggestion / discussion / cooperation / worthless")
    return sb.String()
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat(backend): LLM analyzer with Qianwen integration"
```

---

### Task P2: Content Script — Article List + Comment Capture

> **⚠️ Before implementing:** The WeChat backend API details (endpoints, request parameters, pagination fields, response structure) MUST be confirmed by exploring the Network panel in a real browser session. Do not guess. Follow the exploration process:
> 1. Open `mp.weixin.qq.com`, navigate to the comment management page
> 2. Open DevTools → Network tab
> 3. Find requests that return article list and comments
> 4. Record exact URLs, request parameters, and response field names
> 5. Ask the user to confirm before writing any parsing code

**Files:**
- Create: `extension/src/content/content-script.js`

- [ ] **Step 1: Explore WeChat API — confirm article list endpoint**

Before writing code, open DevTools on `mp.weixin.qq.com/cgi-bin/newappmsgmgr` (or the actual comments page — confirm with user), capture the network request for loading article list, and note:
- Request URL
- Required parameters (token, etc.)
- Response field names for: article title, article ID, comment count

**Ask the user to help identify the correct page and requests before proceeding.**

- [ ] **Step 2: Confirm comment fetch endpoint and pagination**

Similarly capture the request for fetching comments for a single article:
- Request URL
- Parameters needed (article ID, pagination cursor/begin)
- How to detect "no more pages"
- Response field names for: comment ID, content, nickname, reply_to, comment time

- [ ] **Step 3: Implement — only after Step 1 and 2 are confirmed**

```js
// extension/src/content/content-script.js

// Respond to messages from Service Worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_ARTICLES') {
    fetchArticles().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }
  if (msg.type === 'CAPTURE_COMMENTS') {
    captureComments(msg.articleId).then(sendResponse).catch(err => sendResponse({ error: err.message })); // singular articleId
    return true;
  }
});

// TODO: implement fetchArticles() and captureComments() after confirming API details
```

- [ ] **Step 4: Verify content script activates only on 留言 page**

The content script should only enable the fetch/capture functionality when the user is on the WeChat comment management page (留言页面). Confirm the exact URL pattern with the user, then add a guard:

```js
// Add at top of content-script.js
const isCommentPage = () => window.location.href.includes('TODO_CONFIRM_URL_PATTERN');

// In message handlers, return early if not on comment page
if (!isCommentPage()) {
  sendResponse({ error: 'not on comment page' });
  return;
}
```

- [ ] **Step 5: Manual test**

1. Open `mp.weixin.qq.com` comment management page
2. Open DevTools → Console
3. Send test message from console: `chrome.runtime.sendMessage({type: 'FETCH_ARTICLES'}, console.log)`
4. Verify article list is returned with titles and comment counts

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(extension): Content Script fetches WeChat articles and comments"
```

---

## Phase 3 — Integration

### Task B4: POST /api/analyze Handler

**Files:**
- Create: `internal/handler/analyze.go`
- Modify: `internal/server/server.go`
- Create: `internal/handler/analyze_test.go`

- [ ] **Step 1: Define request/response types**

```go
// internal/handler/analyze.go
package handler

import (
    "encoding/json"
    "net/http"
    "time"
    "unicode/utf8"
    "wecatch/internal/llm"
    "wecatch/internal/tree"
)

type AccountPayload struct {
    WxAccountID string `json:"wx_account_id"`
    Name        string `json:"name"`
}

type ArticlePayload struct {
    Title       string `json:"title"`
    URL         string `json:"url"`
    PublishedAt string `json:"published_at"`
}

type AnalyzeRequest struct {
    Account  AccountPayload    `json:"account"`
    Article  ArticlePayload    `json:"article"`
    Comments []tree.RawComment `json:"comments"`
}

type CommentResponse struct {
    WxCommentID     string `json:"wx_comment_id"`
    ReplyToWxID     string `json:"reply_to_wx_id"`
    ReplyToNickname string `json:"reply_to_nickname"`
    Content         string `json:"content"`
    Nickname        string `json:"nickname"`
    CommentTime     string `json:"comment_time"` // ISO 8601
    Category        string `json:"category,omitempty"` // top-level only; omitted for replies
    ParentPreview   string `json:"parent_content_preview"` // always present; empty string for top-level
}

type AnalyzeResponse struct {
    Account  AccountPayload    `json:"account"`
    Article  ArticlePayload    `json:"article"`
    Comments []CommentResponse `json:"comments"`
}
```

- [ ] **Step 2: Write failing test for parent preview generation**

```go
// internal/handler/analyze_test.go
package handler_test

import (
    "testing"
    "unicode/utf8"
    "wecatch/internal/handler"
)

func TestTruncate_ShortString(t *testing.T) {
    got := handler.TruncateRunes("hello", 50)
    if got != "hello" {
        t.Fatalf("unexpected: %q", got)
    }
}

func TestTruncate_LongString(t *testing.T) {
    input := "这是一条很长的留言内容，超过了五十个字符的限制，应该被截断到五十个Unicode码点处理"
    got := handler.TruncateRunes(input, 50)
    if utf8.RuneCountInString(got) > 50 {
        t.Fatalf("expected ≤50 runes, got %d", utf8.RuneCountInString(got))
    }
}
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
go test ./internal/handler/...
```

- [ ] **Step 4: Implement TruncateRunes and handler**

```go
func TruncateRunes(s string, n int) string {
    runes := []rune(s)
    if len(runes) <= n {
        return s
    }
    return string(runes[:n])
}

func NewAnalyzeHandler(analyzer *llm.Analyzer) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        var req AnalyzeRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
            http.Error(w, "bad request", http.StatusBadRequest)
            return
        }

        threads := tree.Build(req.Comments)

        // Build lookup for parent preview
        contentByID := make(map[string]string)
        for _, c := range req.Comments {
            contentByID[c.WxCommentID] = c.Content
        }

        // Classify each thread
        categoryByID := make(map[string]string)
        for _, th := range threads {
            cat := analyzer.ClassifyThread(req.Article.Title, th)
            categoryByID[th.Top.WxCommentID] = cat
        }

        // Build response comments
        var comments []CommentResponse
        for _, c := range req.Comments {
            cr := CommentResponse{
                WxCommentID:     c.WxCommentID,
                ReplyToWxID:     c.ReplyToWxID,
                ReplyToNickname: c.ReplyToNickname,
                Content:         c.Content,
                Nickname:        c.Nickname,
                CommentTime:     time.Unix(c.CommentTime, 0).UTC().Format(time.RFC3339),
            }
            if c.ReplyToWxID == "" {
                cr.Category = categoryByID[c.WxCommentID]
            } else {
                parent := contentByID[c.ReplyToWxID]
                cr.ParentPreview = TruncateRunes(parent, 50)
            }
            comments = append(comments, cr)
        }

        resp := AnalyzeResponse{
            Account:  req.Account,
            Article:  req.Article,
            Comments: comments,
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(resp)
    }
}
```

- [ ] **Step 5: Update server.go to accept analyzer and register route**

```go
// internal/server/server.go — updated signature
package server

import (
    "net/http"
    "github.com/go-chi/chi/v5"
    "wecatch/internal/handler"
    "wecatch/internal/llm"
    "wecatch/internal/middleware"
)

func New(apiKey string, analyzer *llm.Analyzer) http.Handler {
    r := chi.NewRouter()
    r.Use(middleware.CORS)
    r.Use(middleware.APIKey(apiKey))
    r.Post("/api/analyze", handler.NewAnalyzeHandler(analyzer))
    return r
}
```

- [ ] **Step 6: Wire analyzer in main.go**

```go
// cmd/server/main.go — add analyzer
client := llm.NewClient(cfg.QianwenKey)
analyzer := llm.NewAnalyzer(client)
h := server.New(cfg.APIKey, analyzer)
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
go test ./internal/handler/...
go test ./...
```

- [ ] **Step 8: Manual test with curl**

```bash
curl -X POST http://localhost:8080/api/analyze \
  -H "X-API-Key: test" \
  -H "Content-Type: application/json" \
  -d '{"account":{"wx_account_id":"123","name":"test"},"article":{"title":"test","url":"http://x","published_at":"2026-01-01T00:00:00Z"},"comments":[{"wx_comment_id":"1","reply_to_wx_id":"","content":"test comment","nickname":"user","comment_time":1742558400}]}'
```

Expected: 200 with JSON response including `category` on the comment.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat(backend): POST /api/analyze endpoint"
```

---

### Task P3: Background Service Worker

**Files:**
- Modify: `extension/src/background/service-worker.js`

> **Before implementing:** Confirm the backend URL format (e.g., `http://localhost:8080` for dev, actual server for prod). Ask user how the API Key and backend URL should be configured in the extension (hardcoded in build? user-configurable?).

- [ ] **Step 1: Confirm configuration approach with user**

Ask:
1. How should the backend URL be configured? (hardcoded constant, or configurable in extension settings?)
2. How should the API Key be stored? (hardcoded at build time, or entered by user?)

- [ ] **Step 2: Implement Service Worker**

```js
// extension/src/background/service-worker.js

const BACKEND_URL = 'TODO_CONFIRM_WITH_USER';
const API_KEY = 'TODO_CONFIRM_WITH_USER';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    handleCapture(msg.articleIds, msg.sender)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleCapture(articleIds) {
  const results = [];

  for (let i = 0; i < articleIds.length; i++) {
    // Push progress to popup
    chrome.runtime.sendMessage({
      type: 'PROGRESS',
      current: i + 1,
      total: articleIds.length,
    });

    // Ask content script to fetch this article's comments
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const raw = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_COMMENTS',
      articleId: articleIds[i], // singular — one article per request
    });

    // Send to backend
    const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(raw),
    });
    if (!resp.ok) {
      throw new Error(`backend error: ${resp.status}`);
    }
    const data = await resp.json();
    results.push(data);
  }

  // Store results in session storage
  await chrome.storage.session.set({ wecatchResults: results });

  // Notify popup: done
  chrome.runtime.sendMessage({ type: 'CAPTURE_DONE', total: results.length });
}
```

- [ ] **Step 3: Manual integration test**

1. Start Go backend locally
2. Load extension in Chrome
3. Open WeChat comment management page
4. Open popup, select an article, click "抓取"
5. Check DevTools → Service Worker logs for errors
6. Verify `chrome.storage.session` contains results: open any extension page and run `chrome.storage.session.get('wecatchResults', console.log)` in console

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(extension): Service Worker orchestrates capture and backend calls"
```

---

## Phase 4 — UI

### Task P4: Popup UI

**Files:**
- Modify: `extension/src/popup/Popup.jsx`

- [ ] **Step 1: Implement Popup component**

```jsx
// extension/src/popup/Popup.jsx
import React, { useEffect, useState } from 'react';

export default function Popup() {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState({});
  const [progress, setProgress] = useState(null); // {current, total}
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch article list from content script
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_ARTICLES' }, (resp) => {
        if (resp?.error) { setError(resp.error); return; }
        setArticles(resp.articles || []);
        const sel = {};
        (resp.articles || []).forEach(a => sel[a.id] = true);
        setSelected(sel);
      });
    });

    // Listen for progress updates
    const listener = (msg) => {
      if (msg.type === 'PROGRESS') setProgress({ current: msg.current, total: msg.total });
      if (msg.type === 'CAPTURE_DONE') setDone(true);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const toggle = (id) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const startCapture = () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', articleIds: ids });
    setProgress({ current: 0, total: ids.length });
  };

  const openDashboard = () => {
    // dashboard.html lives at extension/src/dashboard/dashboard.html
    // its script tag references ../../dist/dashboard.js which resolves to extension/dist/dashboard.js — correct
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
  };

  if (error) return <div style={{padding:12, color:'red'}}>{error}</div>;

  return (
    <div style={{ width: 320, padding: 12, fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 8px' }}>WeCatch</h3>

      {!progress && (
        <>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 8 }}>
            {articles.map(a => (
              <label key={a.id} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <input type="checkbox" checked={!!selected[a.id]} onChange={() => toggle(a.id)} />
                <span>{a.title} ({a.commentCount}条留言)</span>
              </label>
            ))}
          </div>
          <button onClick={startCapture} disabled={!Object.values(selected).some(Boolean)}>
            开始抓取
          </button>
        </>
      )}

      {progress && !done && (
        <div>处理中：{progress.current} / {progress.total}</div>
      )}

      {done && (
        <>
          <div>✓ 抓取完成</div>
          <button onClick={openDashboard} style={{ marginTop: 8 }}>打开数据看板</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update popup entry**

```jsx
// extension/src/popup/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
createRoot(document.getElementById('root')).render(<Popup />);
```

- [ ] **Step 3: Build and manual test**

```bash
cd extension && npx webpack
```

1. Open WeChat comment management page
2. Click extension icon
3. Verify article list loads with checkboxes
4. Click "开始抓取", verify progress shows
5. On completion, click "打开数据看板", verify dashboard opens

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(extension): Popup UI with article selection and progress"
```

---

### Task P5: Dashboard — Comment List, Filter, Export

**Files:**
- Create: `extension/src/dashboard/Dashboard.jsx`
- Create: `extension/src/dashboard/components/CommentList.jsx`
- Create: `extension/src/dashboard/components/FilterBar.jsx`
- Create: `extension/src/dashboard/components/ExportButton.jsx`
- Create: `extension/src/dashboard/export.js`
- Modify: `extension/src/dashboard/index.jsx`

> **Before implementing export:** Confirm which library to use for Excel export. Options: `xlsx` (SheetJS, MIT license) or `exceljs`. Ask user, then install the chosen library.

- [ ] **Step 1: Install export library (after confirming with user)**

```bash
cd extension
npm install xlsx   # or exceljs, pending confirmation
```

- [ ] **Step 2: Implement category filter labels**

```js
// extension/src/dashboard/categories.js
export const CATEGORIES = {
  question:    '读者提问',
  correction:  '纠错质疑',
  negative:    '负面不满',
  suggestion:  '建议需求',
  discussion:  '深度讨论',
  cooperation: '合作意向',
  worthless:   '无价值',
  unclassified:'未分类',
};
```

- [ ] **Step 3: Implement FilterBar**

```jsx
// extension/src/dashboard/components/FilterBar.jsx
import React from 'react';
import { CATEGORIES } from '../categories';

// All categories shown in filter UI. worthless is included but unchecked by default.
export default function FilterBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      {Object.entries(CATEGORIES).map(([key, label]) => (
        <label key={key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={active.includes(key)}
            onChange={() => onChange(key)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement CommentList**

```jsx
// extension/src/dashboard/components/CommentList.jsx
import React from 'react';
import { CATEGORIES } from '../categories';

export default function CommentList({ comments }) {
  return (
    <div>
      {comments.map(c => (
        <div key={c.wx_comment_id} style={{
          borderBottom: '1px solid #eee',
          padding: '8px 0',
          paddingLeft: c.reply_to_wx_id ? 24 : 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{c.nickname}</strong>
            <span style={{ fontSize: 12, color: '#888' }}>
              {c.category ? CATEGORIES[c.category] : '回复'}
            </span>
          </div>
          <div>{c.content}</div>
          {c.parent_content_preview && (
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              ↩ {c.parent_content_preview}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
            {new Date(c.comment_time).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement export.js**

```js
// extension/src/dashboard/export.js
import * as XLSX from 'xlsx';
import { CATEGORIES } from './categories';

export function exportToExcel(articles) {
  const rows = [];
  for (const article of articles) {
    for (const c of article.comments) {
      rows.push({
        '公众号名称': article.account.name,
        '文章标题': article.article.title,
        '留言者昵称': c.nickname,
        '留言内容': c.content,
        '分类': c.category ? CATEGORIES[c.category] : '',
        '是否为回复': c.reply_to_wx_id ? '是' : '否',
        '父留言摘要': c.parent_content_preview || '',
        '留言时间': c.comment_time,
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '留言');
  XLSX.writeFile(wb, 'wecatch-comments.xlsx');
}
```

- [ ] **Step 6: Implement Dashboard root**

```jsx
// extension/src/dashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import FilterBar from './components/FilterBar';
import CommentList from './components/CommentList';
import { exportToExcel } from './export';

// worthless excluded from defaults — user can enable it via filter
const DEFAULT_CATS = ['question','correction','negative','suggestion','discussion','cooperation','unclassified'];

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_CATS);

  useEffect(() => {
    chrome.storage.session.get('wecatchResults', (data) => {
      setArticles(data.wecatchResults || []);
    });
  }, []);

  const toggleFilter = (cat) => {
    setActiveFilters(f =>
      f.includes(cat) ? f.filter(c => c !== cat) : [...f, cat]
    );
  };

  const visibleComments = articles.flatMap(a => {
    // Build set of visible top-level comment IDs
    const visibleTopIds = new Set(
      a.comments
        .filter(c => !c.reply_to_wx_id && activeFilters.includes(c.category))
        .map(c => c.wx_comment_id)
    );
    // Include top-level comments that pass filter, and replies whose parent is visible
    return a.comments.filter(c =>
      c.reply_to_wx_id ? visibleTopIds.has(c.reply_to_wx_id) : activeFilters.includes(c.category)
    );
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>WeCatch 数据看板</h2>
        <button onClick={() => exportToExcel(articles)}>导出 Excel</button>
      </div>
      <FilterBar active={activeFilters} onChange={toggleFilter} />
      <CommentList comments={visibleComments} />
    </div>
  );
}
```

- [ ] **Step 7: Update dashboard entry**

```jsx
// extension/src/dashboard/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
createRoot(document.getElementById('root')).render(<Dashboard />);
```

- [ ] **Step 8: Build and end-to-end test**

```bash
cd extension && npx webpack
```

Full flow test:
1. Start backend
2. Open WeChat comment page, use popup to capture an article
3. Open Dashboard
4. Verify comments display with categories
5. Toggle filters — verify worthless comments hidden/shown
6. Click Export — verify Excel file downloads with correct columns

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat(extension): Dashboard with filter and Excel export"
```

---

## Done

All 9 modules implemented. The full flow works:
- Plugin captures WeChat comments using browser cookies
- Backend classifies threads via Qianwen
- Dashboard displays, filters, and exports results
