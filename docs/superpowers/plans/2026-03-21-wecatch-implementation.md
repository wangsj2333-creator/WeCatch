# WeCatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension + Go backend system that captures WeChat Official Account comments, classifies them via Tongyi Qianwen, and provides a management dashboard for operators.

**Architecture:** Chrome Extension (Manifest V3) with Content Script for comment interception and a React SPA dashboard page. Go REST API backend with PostgreSQL storage. JWT authentication. Tongyi Qianwen for comment classification.

**Tech Stack:** Go, PostgreSQL, React, TypeScript, Chrome Extension Manifest V3, Tongyi Qianwen API

---

## File Structure

### Backend (`backend/`)

```
backend/
├── cmd/server/main.go                  # Entry point
├── internal/
│   ├── config/config.go                # Config from env vars
│   ├── database/
│   │   ├── database.go                 # DB connection
│   │   └── migrations.go              # Auto-migrate models
│   ├── models/
│   │   ├── user.go                     # User model
│   │   ├── account.go                  # Account + UserAccount models
│   │   ├── article.go                  # Article model
│   │   └── comment.go                  # Comment model
│   ├── handlers/
│   │   ├── auth.go                     # Login/logout handlers
│   │   ├── user.go                     # User CRUD handlers
│   │   ├── account.go                  # Account handlers
│   │   ├── article.go                  # Article list handler
│   │   └── comment.go                  # Comment batch + query + status update
│   ├── middleware/auth.go              # JWT auth middleware
│   ├── services/
│   │   ├── auth.go                     # Password hashing, JWT generation
│   │   └── classifier.go              # Tongyi Qianwen API client
│   └── router/router.go               # Route definitions
├── go.mod
└── go.sum
```

### Chrome Extension (`extension/`)

```
extension/
├── manifest.json                       # Manifest V3 config
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
├── webpack.config.js                   # Build config
├── src/
│   ├── background/service-worker.ts    # Extension service worker
│   ├── content/content.ts              # Comment interception script
│   ├── popup/
│   │   ├── Popup.tsx                   # Popup React component
│   │   └── index.tsx                   # Popup entry
│   └── dashboard/
│       ├── index.tsx                   # Dashboard entry
│       ├── App.tsx                     # Dashboard root component
│       ├── api/client.ts              # API client (fetch wrapper with JWT)
│       ├── types/index.ts             # TypeScript types
│       ├── pages/
│       │   ├── LoginPage.tsx           # Login form
│       │   ├── AccountListPage.tsx     # Account list
│       │   ├── ArticleListPage.tsx     # Article list for an account
│       │   └── CommentListPage.tsx     # Comment list for an article
│       └── components/
│           ├── Layout.tsx              # Page layout with nav
│           ├── CommentCard.tsx         # Single comment display
│           └── CategoryFilter.tsx      # Category filter buttons
├── public/
│   ├── popup.html                      # Popup HTML
│   └── dashboard.html                  # Dashboard HTML
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Task 1: Go Backend Project Setup

**Files:**
- Create: `backend/go.mod`
- Create: `backend/cmd/server/main.go`
- Create: `backend/internal/config/config.go`

- [ ] **Step 1: Initialize Go module**

```bash
cd backend
go mod init github.com/wangsj2333-creator/WeCatch/backend
```

- [ ] **Step 2: Create config loader**

Create `backend/internal/config/config.go`:

```go
package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	QianwenKey  string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/wecatch?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		QianwenKey:  getEnv("QIANWEN_API_KEY", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

- [ ] **Step 3: Create main.go skeleton**

Create `backend/cmd/server/main.go`:

```go
package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/config"
)

func main() {
	cfg := config.Load()

	log.Printf("WeCatch server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", cfg.Port), nil); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd backend && go build ./cmd/server/
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: initialize Go backend project with config"
```

---

## Task 2: Database Models and Migrations

**Files:**
- Create: `backend/internal/models/user.go`
- Create: `backend/internal/models/account.go`
- Create: `backend/internal/models/article.go`
- Create: `backend/internal/models/comment.go`
- Create: `backend/internal/database/database.go`
- Create: `backend/internal/database/migrations.go`

- [ ] **Step 1: Install GORM and PostgreSQL driver**

```bash
cd backend
go get gorm.io/gorm
go get gorm.io/driver/postgres
```

- [ ] **Step 2: Create User model**

Create `backend/internal/models/user.go`:

```go
package models

import "time"

type User struct {
	ID        int64     `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex;not null"`
	Password  string    `json:"-" gorm:"not null"`
	Role      string    `json:"role" gorm:"not null;default:user"`
	CreatedAt time.Time `json:"created_at"`
}
```

- [ ] **Step 3: Create Account and UserAccount models**

Create `backend/internal/models/account.go`:

```go
package models

import "time"

type Account struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	WxAccountID string    `json:"wx_account_id" gorm:"uniqueIndex;not null"`
	Name        string    `json:"name" gorm:"not null"`
	CreatedAt   time.Time `json:"created_at"`
}

type UserAccount struct {
	UserID    int64 `gorm:"primaryKey"`
	AccountID int64 `gorm:"primaryKey"`
}
```

- [ ] **Step 4: Create Article model**

Create `backend/internal/models/article.go`:

```go
package models

import "time"

type Article struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	AccountID   int64     `json:"account_id" gorm:"index;not null"`
	Title       string    `json:"title" gorm:"not null"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at"`
}
```

- [ ] **Step 5: Create Comment model**

Create `backend/internal/models/comment.go`:

```go
package models

import "time"

type Comment struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	ArticleID   int64     `json:"article_id" gorm:"index;not null"`
	WxCommentID string    `json:"wx_comment_id" gorm:"uniqueIndex;not null"`
	Content     string    `json:"content" gorm:"type:text;not null"`
	Nickname    string    `json:"nickname"`
	CommentTime time.Time `json:"comment_time"`
	Category    string    `json:"category" gorm:"default:unclassified"`
	Status      string    `json:"status" gorm:"default:pending"`
	CreatedAt   time.Time `json:"created_at"`
}

const (
	CategoryQuestion     = "question"
	CategoryCorrection   = "correction"
	CategoryNegative     = "negative"
	CategorySuggestion   = "suggestion"
	CategoryDiscussion   = "discussion"
	CategoryCooperation  = "cooperation"
	CategoryWorthless    = "worthless"
	CategoryUnclassified = "unclassified"
)

const (
	StatusPending = "pending"
	StatusReplied = "replied"
	StatusIgnored = "ignored"
)
```

- [ ] **Step 6: Create database connection**

Create `backend/internal/database/database.go`:

```go
package database

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	return db, nil
}
```

- [ ] **Step 7: Create auto-migration**

Create `backend/internal/database/migrations.go`:

```go
package database

import (
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Account{},
		&models.UserAccount{},
		&models.Article{},
		&models.Comment{},
	)
}
```

- [ ] **Step 8: Verify it compiles**

```bash
cd backend && go build ./...
```

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: add database models and migration for all tables"
```

---

## Task 3: Auth Service (JWT + Password Hashing)

**Files:**
- Create: `backend/internal/services/auth.go`
- Create: `backend/internal/services/auth_test.go`

- [ ] **Step 1: Install dependencies**

```bash
cd backend
go get golang.org/x/crypto/bcrypt
go get github.com/golang-jwt/jwt/v5
```

- [ ] **Step 2: Write failing tests for auth service**

Create `backend/internal/services/auth_test.go`:

```go
package services

import "testing"

func TestHashPassword(t *testing.T) {
	hash, err := HashPassword("testpassword")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "testpassword" {
		t.Error("hash should not equal plaintext")
	}
}

func TestCheckPassword(t *testing.T) {
	hash, _ := HashPassword("testpassword")
	if !CheckPassword("testpassword", hash) {
		t.Error("correct password should pass check")
	}
	if CheckPassword("wrongpassword", hash) {
		t.Error("wrong password should fail check")
	}
}

func TestGenerateAndParseToken(t *testing.T) {
	secret := "test-secret"
	token, err := GenerateToken(1, "admin", secret)
	if err != nil {
		t.Fatal(err)
	}

	userID, role, err := ParseToken(token, secret)
	if err != nil {
		t.Fatal(err)
	}
	if userID != 1 {
		t.Errorf("expected userID 1, got %d", userID)
	}
	if role != "admin" {
		t.Errorf("expected role admin, got %s", role)
	}
}

func TestParseTokenInvalid(t *testing.T) {
	_, _, err := ParseToken("invalid-token", "test-secret")
	if err == nil {
		t.Error("expected error for invalid token")
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && go test ./internal/services/ -v
```

Expected: FAIL — functions not defined.

- [ ] **Step 4: Implement auth service**

Create `backend/internal/services/auth.go`:

```go
package services

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func GenerateToken(userID int64, role string, secret string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenString string, secret string) (int64, string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return 0, "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return 0, "", fmt.Errorf("invalid token")
	}

	userID := int64(claims["user_id"].(float64))
	role := claims["role"].(string)
	return userID, role, nil
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && go test ./internal/services/ -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/services/
git commit -m "feat: add auth service with JWT and password hashing"
```

---

## Task 4: Auth Middleware

**Files:**
- Create: `backend/internal/middleware/auth.go`
- Create: `backend/internal/middleware/auth_test.go`

- [ ] **Step 1: Write failing test for auth middleware**

Create `backend/internal/middleware/auth_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
)

func TestAuthMiddleware_ValidToken(t *testing.T) {
	secret := "test-secret"
	token, _ := services.GenerateToken(1, "admin", secret)

	handler := JWTAuth(secret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Context().Value(ContextKeyUserID).(int64)
		role := r.Context().Value(ContextKeyRole).(string)
		if userID != 1 {
			t.Errorf("expected userID 1, got %d", userID)
		}
		if role != "admin" {
			t.Errorf("expected role admin, got %s", role)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}

func TestAuthMiddleware_NoToken(t *testing.T) {
	handler := JWTAuth("test-secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && go test ./internal/middleware/ -v
```

Expected: FAIL — package not found.

- [ ] **Step 3: Implement auth middleware**

Create `backend/internal/middleware/auth.go`:

```go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
)

type contextKey string

const (
	ContextKeyUserID contextKey = "user_id"
	ContextKeyRole   contextKey = "role"
)

func JWTAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			userID, role, err := services.ParseToken(parts[1], secret)
			if err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, userID)
			ctx = context.WithValue(ctx, ContextKeyRole, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && go test ./internal/middleware/ -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/middleware/
git commit -m "feat: add JWT auth middleware"
```

---

## Task 5: Auth Handlers (Login/Logout)

**Files:**
- Create: `backend/internal/handlers/auth.go`
- Create: `backend/internal/handlers/auth_test.go`

- [ ] **Step 1: Write failing tests**

Create `backend/internal/handlers/auth_test.go`:

```go
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&models.User{}, &models.Account{}, &models.UserAccount{}, &models.Article{}, &models.Comment{})
	return db
}

func TestLogin_Success(t *testing.T) {
	db := setupTestDB(t)
	hash, _ := services.HashPassword("password123")
	db.Create(&models.User{Username: "testuser", Password: hash, Role: "user"})

	h := &AuthHandler{DB: db, JWTSecret: "test-secret"}

	body, _ := json.Marshal(map[string]string{"username": "testuser", "password": "password123"})
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.Login(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["token"] == "" {
		t.Error("expected token in response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	db := setupTestDB(t)
	hash, _ := services.HashPassword("password123")
	db.Create(&models.User{Username: "testuser", Password: hash, Role: "user"})

	h := &AuthHandler{DB: db, JWTSecret: "test-secret"}

	body, _ := json.Marshal(map[string]string{"username": "testuser", "password": "wrong"})
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.Login(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}
```

- [ ] **Step 2: Install SQLite driver for tests**

```bash
cd backend && go get gorm.io/driver/sqlite
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && go test ./internal/handlers/ -v
```

Expected: FAIL — AuthHandler not defined.

- [ ] **Step 4: Implement auth handlers**

Create `backend/internal/handlers/auth.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB        *gorm.DB
	JWTSecret string
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	var user models.User
	if err := h.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if !services.CheckPassword(req.Password, user.Password) {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := services.GenerateToken(user.ID, user.Role, h.JWTSecret)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && go test ./internal/handlers/ -v
```

Expected: All 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handlers/
git commit -m "feat: add login handler with JWT token response"
```

---

## Task 6: User Management Handlers

**Files:**
- Create: `backend/internal/handlers/user.go`
- Modify: `backend/internal/handlers/auth_test.go` (add user handler tests)

- [ ] **Step 1: Write failing tests**

Add to `backend/internal/handlers/auth_test.go` (or create `user_test.go`):

Create `backend/internal/handlers/user_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
)

func TestCreateUser_AsAdmin(t *testing.T) {
	db := setupTestDB(t)
	h := &UserHandler{DB: db}

	body, _ := json.Marshal(map[string]string{"username": "newuser", "password": "pass123", "role": "user"})
	req := httptest.NewRequest("POST", "/api/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.ContextKeyRole, "admin")
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.Create(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d, body: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateUser_AsNonAdmin(t *testing.T) {
	db := setupTestDB(t)
	h := &UserHandler{DB: db}

	body, _ := json.Marshal(map[string]string{"username": "newuser", "password": "pass123", "role": "user"})
	req := httptest.NewRequest("POST", "/api/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.ContextKeyRole, "user")
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.Create(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rr.Code)
	}
}

func TestListUsers(t *testing.T) {
	db := setupTestDB(t)
	h := &UserHandler{DB: db}

	req := httptest.NewRequest("GET", "/api/users", nil)
	ctx := context.WithValue(req.Context(), middleware.ContextKeyRole, "admin")
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && go test ./internal/handlers/ -v
```

Expected: FAIL — UserHandler not defined.

- [ ] **Step 3: Implement user handlers**

Create `backend/internal/handlers/user.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

type createUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextKeyRole).(string)
	if role != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	hash, err := services.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	user := models.User{
		Username: req.Username,
		Password: hash,
		Role:     req.Role,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		http.Error(w, "username already exists", http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextKeyRole).(string)
	if role != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var users []models.User
	h.DB.Find(&users)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && go test ./internal/handlers/ -v
```

Expected: All 5 tests PASS (2 auth + 3 user).

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/user.go backend/internal/handlers/user_test.go
git commit -m "feat: add user management handlers (create, list)"
```

---

## Task 7: Account Handlers

**Files:**
- Create: `backend/internal/handlers/account.go`
- Create: `backend/internal/handlers/account_test.go`

- [ ] **Step 1: Write failing tests**

Create `backend/internal/handlers/account_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
)

func TestListAccounts(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.User{ID: 1, Username: "test", Password: "x", Role: "user"})
	db.Create(&models.Account{ID: 1, WxAccountID: "wx001", Name: "TestAccount"})
	db.Create(&models.UserAccount{UserID: 1, AccountID: 1})

	h := &AccountHandler{DB: db}

	req := httptest.NewRequest("GET", "/api/accounts", nil)
	ctx := context.WithValue(req.Context(), middleware.ContextKeyUserID, int64(1))
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var accounts []models.Account
	json.Unmarshal(rr.Body.Bytes(), &accounts)
	if len(accounts) != 1 {
		t.Errorf("expected 1 account, got %d", len(accounts))
	}
}

func TestCreateAccount(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.User{ID: 1, Username: "test", Password: "x", Role: "user"})

	h := &AccountHandler{DB: db}

	body, _ := json.Marshal(map[string]string{"wx_account_id": "wx002", "name": "NewAccount"})
	req := httptest.NewRequest("POST", "/api/accounts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.ContextKeyUserID, int64(1))
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.Create(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d, body: %s", rr.Code, rr.Body.String())
	}

	// Verify user-account link was created
	var link models.UserAccount
	err := db.Where("user_id = ? AND account_id != 0", 1).First(&link).Error
	if err != nil {
		t.Error("expected user-account link to be created")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && go test ./internal/handlers/ -v -run TestListAccounts,TestCreateAccount
```

Expected: FAIL — AccountHandler not defined.

- [ ] **Step 3: Implement account handlers**

Create `backend/internal/handlers/account.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"gorm.io/gorm"
)

type AccountHandler struct {
	DB *gorm.DB
}

type createAccountRequest struct {
	WxAccountID string `json:"wx_account_id"`
	Name        string `json:"name"`
}

func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextKeyUserID).(int64)

	var accounts []models.Account
	h.DB.Joins("JOIN user_accounts ON user_accounts.account_id = accounts.id").
		Where("user_accounts.user_id = ?", userID).
		Find(&accounts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(accounts)
}

func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextKeyUserID).(int64)

	var req createAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	account := models.Account{
		WxAccountID: req.WxAccountID,
		Name:        req.Name,
	}

	// Upsert: find existing or create new
	var existing models.Account
	result := h.DB.Where("wx_account_id = ?", req.WxAccountID).First(&existing)
	if result.Error == nil {
		account = existing
	} else {
		if err := h.DB.Create(&account).Error; err != nil {
			http.Error(w, "failed to create account", http.StatusInternalServerError)
			return
		}
	}

	// Link user to account (ignore duplicate)
	h.DB.FirstOrCreate(&models.UserAccount{UserID: userID, AccountID: account.ID})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(account)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && go test ./internal/handlers/ -v -run TestListAccounts,TestCreateAccount
```

Expected: Both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/account.go backend/internal/handlers/account_test.go
git commit -m "feat: add account handlers (list, create with user linking)"
```

---

## Task 8: Comment Classifier Service (Tongyi Qianwen)

**Files:**
- Create: `backend/internal/services/classifier.go`
- Create: `backend/internal/services/classifier_test.go`

- [ ] **Step 1: Write failing test**

Create `backend/internal/services/classifier_test.go`:

```go
package services

import "testing"

func TestBuildClassifyPrompt(t *testing.T) {
	prompt := BuildClassifyPrompt("这篇文章写错了吧，第三段的数据明显不对", "2024年经济数据分析")
	if prompt == "" {
		t.Error("prompt should not be empty")
	}
}

func TestParseCategory_Valid(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"question", "question"},
		{"correction", "correction"},
		{"negative", "negative"},
		{"suggestion", "suggestion"},
		{"discussion", "discussion"},
		{"cooperation", "cooperation"},
		{"worthless", "worthless"},
	}
	for _, tt := range tests {
		result := ParseCategory(tt.input)
		if result != tt.expected {
			t.Errorf("ParseCategory(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestParseCategory_Invalid(t *testing.T) {
	result := ParseCategory("unknown_category")
	if result != "unclassified" {
		t.Errorf("expected unclassified for invalid input, got %q", result)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && go test ./internal/services/ -v -run TestBuildClassifyPrompt,TestParseCategory
```

Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement classifier service**

Create `backend/internal/services/classifier.go`:

```go
package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var validCategories = map[string]bool{
	"question":    true,
	"correction":  true,
	"negative":    true,
	"suggestion":  true,
	"discussion":  true,
	"cooperation": true,
	"worthless":   true,
}

func BuildClassifyPrompt(commentContent, articleTitle string) string {
	return fmt.Sprintf(`你是一个留言分类助手。请将以下微信公众号文章的留言分为以下类别之一，只返回类别英文标签，不要返回其他内容：

- question: 读者提问，在问问题
- correction: 纠错质疑，指出文章错误
- negative: 负面不满，表达批评或不满
- suggestion: 建议需求，提出内容建议
- discussion: 深度讨论，有独到见解或补充
- cooperation: 合作意向，表达商务或合作意向
- worthless: 无价值，如"写得好""感谢分享"等普通留言

文章标题：%s
留言内容：%s

请只返回一个英文分类标签。`, articleTitle, commentContent)
}

func ParseCategory(raw string) string {
	cleaned := strings.TrimSpace(strings.ToLower(raw))
	if validCategories[cleaned] {
		return cleaned
	}
	return "unclassified"
}

type Classifier struct {
	APIKey  string
	BaseURL string
}

func NewClassifier(apiKey string) *Classifier {
	return &Classifier{
		APIKey:  apiKey,
		BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
	}
}

type qianwenRequest struct {
	Model    string          `json:"model"`
	Messages []qianwenMsg    `json:"messages"`
}

type qianwenMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type qianwenResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *Classifier) Classify(commentContent, articleTitle string) (string, error) {
	prompt := BuildClassifyPrompt(commentContent, articleTitle)

	reqBody := qianwenRequest{
		Model: "qwen-turbo",
		Messages: []qianwenMsg{
			{Role: "user", Content: prompt},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "unclassified", err
	}

	req, err := http.NewRequest("POST", c.BaseURL, bytes.NewReader(jsonBody))
	if err != nil {
		return "unclassified", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "unclassified", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "unclassified", err
	}

	var result qianwenResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "unclassified", err
	}

	if len(result.Choices) == 0 {
		return "unclassified", fmt.Errorf("no choices in response")
	}

	raw := result.Choices[0].Message.Content
	return ParseCategory(raw), nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && go test ./internal/services/ -v -run TestBuildClassifyPrompt,TestParseCategory
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/services/classifier.go backend/internal/services/classifier_test.go
git commit -m "feat: add Tongyi Qianwen classifier service"
```

---

## Task 9: Comment & Article Handlers

**Files:**
- Create: `backend/internal/handlers/comment.go`
- Create: `backend/internal/handlers/article.go`
- Create: `backend/internal/handlers/comment_test.go`
- Create: `backend/internal/handlers/article_test.go`

- [ ] **Step 1: Write failing tests for comment batch endpoint**

Create `backend/internal/handlers/comment_test.go`:

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
)

func TestBatchComments(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.User{ID: 1, Username: "test", Password: "x", Role: "user"})

	h := &CommentHandler{DB: db, Classifier: nil} // nil classifier = skip classification

	payload := BatchCommentsRequest{
		Account: batchAccount{WxAccountID: "wx001", Name: "TestAccount"},
		Article: batchArticle{Title: "Test Article", URL: "https://example.com"},
		Comments: []batchComment{
			{WxCommentID: "c001", Content: "Great article!", Nickname: "User1"},
			{WxCommentID: "c002", Content: "I have a question", Nickname: "User2"},
		},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/comments/batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.ContextKeyUserID, int64(1))
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.Batch(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d, body: %s", rr.Code, rr.Body.String())
	}

	// Verify comments were created
	var count int64
	db.Model(&models.Comment{}).Count(&count)
	if count != 2 {
		t.Errorf("expected 2 comments, got %d", count)
	}
}

func TestBatchComments_Dedup(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.User{ID: 1, Username: "test", Password: "x", Role: "user"})
	db.Create(&models.Account{ID: 1, WxAccountID: "wx001", Name: "TestAccount"})
	db.Create(&models.Article{ID: 1, AccountID: 1, Title: "Test"})
	db.Create(&models.Comment{ArticleID: 1, WxCommentID: "c001", Content: "Existing", Nickname: "User1", Category: "worthless", Status: "pending"})

	h := &CommentHandler{DB: db, Classifier: nil}

	payload := BatchCommentsRequest{
		Account:  batchAccount{WxAccountID: "wx001", Name: "TestAccount"},
		Article:  batchArticle{Title: "Test", URL: "https://example.com"},
		Comments: []batchComment{{WxCommentID: "c001", Content: "Existing", Nickname: "User1"}},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/comments/batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.ContextKeyUserID, int64(1))
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	h.Batch(rr, req)

	var count int64
	db.Model(&models.Comment{}).Count(&count)
	if count != 1 {
		t.Errorf("expected 1 comment (deduped), got %d", count)
	}
}

func TestListComments(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.Article{ID: 1, AccountID: 1, Title: "Test"})
	db.Create(&models.Comment{ArticleID: 1, WxCommentID: "c1", Content: "Q?", Category: "question", Status: "pending"})
	db.Create(&models.Comment{ArticleID: 1, WxCommentID: "c2", Content: "Nice", Category: "worthless", Status: "pending"})

	h := &CommentHandler{DB: db}

	// Filter by category=question
	req := httptest.NewRequest("GET", "/api/articles/1/comments?category=question", nil)
	rr := httptest.NewRecorder()

	h.List(rr, req, 1)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var comments []models.Comment
	json.Unmarshal(rr.Body.Bytes(), &comments)
	if len(comments) != 1 {
		t.Errorf("expected 1 comment, got %d", len(comments))
	}
}

func TestUpdateCommentStatus(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.Comment{ID: 1, ArticleID: 1, WxCommentID: "c1", Content: "Q?", Category: "question", Status: "pending"})

	h := &CommentHandler{DB: db}

	body, _ := json.Marshal(map[string]string{"status": "replied"})
	req := httptest.NewRequest("PUT", "/api/comments/1/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.UpdateStatus(rr, req, 1)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var comment models.Comment
	db.First(&comment, 1)
	if comment.Status != "replied" {
		t.Errorf("expected status replied, got %s", comment.Status)
	}
}
```

- [ ] **Step 2: Write failing test for article list**

Create `backend/internal/handlers/article_test.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
)

func TestListArticles(t *testing.T) {
	db := setupTestDB(t)
	db.Create(&models.Account{ID: 1, WxAccountID: "wx001", Name: "TestAccount"})
	db.Create(&models.Article{AccountID: 1, Title: "Article 1"})
	db.Create(&models.Article{AccountID: 1, Title: "Article 2"})
	db.Create(&models.Article{AccountID: 2, Title: "Other Account Article"})

	h := &ArticleHandler{DB: db}

	req := httptest.NewRequest("GET", "/api/accounts/1/articles", nil)
	rr := httptest.NewRecorder()

	h.List(rr, req, 1)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var articles []models.Article
	json.Unmarshal(rr.Body.Bytes(), &articles)
	if len(articles) != 2 {
		t.Errorf("expected 2 articles, got %d", len(articles))
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && go test ./internal/handlers/ -v
```

Expected: FAIL — CommentHandler, ArticleHandler not defined.

- [ ] **Step 4: Implement comment handler**

Create `backend/internal/handlers/comment.go`:

```go
package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/gorm"
)

type CommentHandler struct {
	DB         *gorm.DB
	Classifier *services.Classifier
}

type BatchCommentsRequest struct {
	Account  batchAccount  `json:"account"`
	Article  batchArticle  `json:"article"`
	Comments []batchComment `json:"comments"`
}

type batchAccount struct {
	WxAccountID string `json:"wx_account_id"`
	Name        string `json:"name"`
}

type batchArticle struct {
	Title       string    `json:"title"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"published_at"`
}

type batchComment struct {
	WxCommentID string    `json:"wx_comment_id"`
	Content     string    `json:"content"`
	Nickname    string    `json:"nickname"`
	CommentTime time.Time `json:"comment_time"`
}

type batchResponse struct {
	NewComments int `json:"new_comments"`
	Skipped     int `json:"skipped"`
}

func (h *CommentHandler) Batch(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextKeyUserID).(int64)

	var req BatchCommentsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	// Upsert account
	var account models.Account
	result := h.DB.Where("wx_account_id = ?", req.Account.WxAccountID).First(&account)
	if result.Error != nil {
		account = models.Account{WxAccountID: req.Account.WxAccountID, Name: req.Account.Name}
		h.DB.Create(&account)
	}

	// Link user to account
	h.DB.FirstOrCreate(&models.UserAccount{UserID: userID, AccountID: account.ID})

	// Upsert article
	var article models.Article
	result = h.DB.Where("account_id = ? AND title = ? AND url = ?", account.ID, req.Article.Title, req.Article.URL).First(&article)
	if result.Error != nil {
		article = models.Article{
			AccountID:   account.ID,
			Title:       req.Article.Title,
			URL:         req.Article.URL,
			PublishedAt: req.Article.PublishedAt,
		}
		h.DB.Create(&article)
	}

	// Insert comments with dedup
	newCount := 0
	skipped := 0
	for _, c := range req.Comments {
		var existing models.Comment
		if h.DB.Where("wx_comment_id = ?", c.WxCommentID).First(&existing).Error == nil {
			skipped++
			continue
		}

		comment := models.Comment{
			ArticleID:   article.ID,
			WxCommentID: c.WxCommentID,
			Content:     c.Content,
			Nickname:    c.Nickname,
			CommentTime: c.CommentTime,
			Category:    models.CategoryUnclassified,
			Status:      models.StatusPending,
		}
		h.DB.Create(&comment)
		newCount++

		// Classify asynchronously
		if h.Classifier != nil {
			go func(commentID int64, content, title string) {
				category, err := h.Classifier.Classify(content, title)
				if err != nil {
					log.Printf("classification failed for comment %d: %v", commentID, err)
					return
				}
				h.DB.Model(&models.Comment{}).Where("id = ?", commentID).Update("category", category)
			}(comment.ID, c.Content, req.Article.Title)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(batchResponse{NewComments: newCount, Skipped: skipped})
}

func (h *CommentHandler) List(w http.ResponseWriter, r *http.Request, articleID int64) {
	query := h.DB.Where("article_id = ?", articleID)

	if category := r.URL.Query().Get("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	if status := r.URL.Query().Get("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var comments []models.Comment
	query.Order("comment_time DESC").Find(&comments)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *CommentHandler) UpdateStatus(w http.ResponseWriter, r *http.Request, commentID int64) {
	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.Status != models.StatusPending && req.Status != models.StatusReplied && req.Status != models.StatusIgnored {
		http.Error(w, "invalid status", http.StatusBadRequest)
		return
	}

	h.DB.Model(&models.Comment{}).Where("id = ?", commentID).Update("status", req.Status)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
```

- [ ] **Step 5: Implement article handler**

Create `backend/internal/handlers/article.go`:

```go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"gorm.io/gorm"
)

type ArticleHandler struct {
	DB *gorm.DB
}

func (h *ArticleHandler) List(w http.ResponseWriter, r *http.Request, accountID int64) {
	var articles []models.Article
	h.DB.Where("account_id = ?", accountID).Order("published_at DESC").Find(&articles)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(articles)
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && go test ./internal/handlers/ -v
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/handlers/comment.go backend/internal/handlers/comment_test.go backend/internal/handlers/article.go backend/internal/handlers/article_test.go
git commit -m "feat: add comment batch/list/status and article list handlers"
```

---

## Task 10: Router and Server Wiring

**Files:**
- Create: `backend/internal/router/router.go`
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Install chi router**

```bash
cd backend && go get github.com/go-chi/chi/v5
```

- [ ] **Step 2: Create router**

Create `backend/internal/router/router.go`:

```go
package router

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/handlers"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/gorm"
)

func New(db *gorm.DB, jwtSecret string, classifier *services.Classifier) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(corsMiddleware)

	authHandler := &handlers.AuthHandler{DB: db, JWTSecret: jwtSecret}
	userHandler := &handlers.UserHandler{DB: db}
	accountHandler := &handlers.AccountHandler{DB: db}
	articleHandler := &handlers.ArticleHandler{DB: db}
	commentHandler := &handlers.CommentHandler{DB: db, Classifier: classifier}

	// Public routes
	r.Post("/api/auth/login", authHandler.Login)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(jwtSecret))

		r.Post("/api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		// User management
		r.Post("/api/users", userHandler.Create)
		r.Get("/api/users", userHandler.List)

		// Accounts
		r.Get("/api/accounts", accountHandler.List)
		r.Post("/api/accounts", accountHandler.Create)

		// Comment batch
		r.Post("/api/comments/batch", commentHandler.Batch)

		// Articles
		r.Get("/api/accounts/{accountID}/articles", func(w http.ResponseWriter, r *http.Request) {
			id, err := strconv.ParseInt(chi.URLParam(r, "accountID"), 10, 64)
			if err != nil {
				http.Error(w, "invalid account id", http.StatusBadRequest)
				return
			}
			articleHandler.List(w, r, id)
		})

		// Comments
		r.Get("/api/articles/{articleID}/comments", func(w http.ResponseWriter, r *http.Request) {
			id, err := strconv.ParseInt(chi.URLParam(r, "articleID"), 10, 64)
			if err != nil {
				http.Error(w, "invalid article id", http.StatusBadRequest)
				return
			}
			commentHandler.List(w, r, id)
		})

		r.Put("/api/comments/{commentID}/status", func(w http.ResponseWriter, r *http.Request) {
			id, err := strconv.ParseInt(chi.URLParam(r, "commentID"), 10, 64)
			if err != nil {
				http.Error(w, "invalid comment id", http.StatusBadRequest)
				return
			}
			commentHandler.UpdateStatus(w, r, id)
		})
	})

	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 3: Update main.go to wire everything**

Update `backend/cmd/server/main.go`:

```go
package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/config"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/database"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/router"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Seed admin user if none exists
	var count int64
	db.Model(&models.User{}).Count(&count)
	if count == 0 {
		hash, _ := services.HashPassword("admin123")
		db.Create(&models.User{Username: "admin", Password: hash, Role: "admin"})
		log.Println("created default admin user (admin/admin123)")
	}

	var classifier *services.Classifier
	if cfg.QianwenKey != "" {
		classifier = services.NewClassifier(cfg.QianwenKey)
		log.Println("Tongyi Qianwen classifier enabled")
	} else {
		log.Println("WARNING: QIANWEN_API_KEY not set, classification disabled")
	}

	r := router.New(db, cfg.JWTSecret, classifier)

	log.Printf("WeCatch server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", cfg.Port), r); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd backend && go build ./cmd/server/
```

Expected: Build succeeds.

- [ ] **Step 5: Run all tests**

```bash
cd backend && go test ./... -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add router, CORS, and wire up server with all handlers"
```

---

## Task 11: Chrome Extension Setup (Manifest + Popup)

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/webpack.config.js`
- Create: `extension/public/popup.html`
- Create: `extension/public/dashboard.html`
- Create: `extension/src/popup/index.tsx`
- Create: `extension/src/popup/Popup.tsx`

- [ ] **Step 1: Create manifest.json**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "WeCatch",
  "version": "1.0.0",
  "description": "抓取微信公众号留言，筛选有价值的留言",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://mp.weixin.qq.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["https://mp.weixin.qq.com/*"],
      "js": ["content.js"]
    }
  ],
  "background": {
    "service_worker": "service-worker.js"
  }
}
```

- [ ] **Step 2: Create package.json**

Create `extension/package.json`:

```json
{
  "name": "wecatch-extension",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "copy-webpack-plugin": "^12.0.0",
    "css-loader": "^6.8.0",
    "html-webpack-plugin": "^5.5.0",
    "style-loader": "^3.3.0",
    "ts-loader": "^9.5.0",
    "typescript": "^5.3.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create webpack.config.js**

Create `extension/webpack.config.js`:

```js
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup/index.tsx',
    dashboard: './src/dashboard/index.tsx',
    content: './src/content/content.ts',
    'service-worker': './src/background/service-worker.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './public/dashboard.html',
      filename: 'dashboard.html',
      chunks: ['dashboard'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons', noErrorOnMissing: true },
      ],
    }),
  ],
};
```

- [ ] **Step 5: Create HTML files**

Create `extension/public/popup.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 300px; min-height: 200px; margin: 0; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

Create `extension/public/dashboard.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WeCatch 管理后台</title>
  <style>
    body { margin: 0; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

- [ ] **Step 6: Create Popup component**

Create `extension/src/popup/index.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
```

Create `extension/src/popup/Popup.tsx`:

```tsx
import React, { useState, useEffect } from 'react';

export function Popup() {
  const [isOnWechat, setIsOnWechat] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // Check if we're on mp.weixin.qq.com
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      setIsOnWechat(url.includes('mp.weixin.qq.com'));
    });

    // Load saved token
    chrome.storage.local.get(['token'], (result) => {
      setToken(result.token || '');
    });
  }, []);

  const handleCapture = async () => {
    if (!token) {
      setStatus('请先登录');
      return;
    }

    setStatus('抓取中...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_COMMENTS' }, (response) => {
        if (response?.success) {
          setStatus(`抓取完成，新增 ${response.newComments} 条留言`);
        } else {
          setStatus(`抓取失败: ${response?.error || '未知错误'}`);
        }
      });
    }
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>WeCatch</h2>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={openDashboard}
          style={{ width: '100%', padding: '8px 0', cursor: 'pointer' }}
        >
          打开管理后台
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleCapture}
          disabled={!isOnWechat || !token}
          style={{ width: '100%', padding: '8px 0', cursor: isOnWechat ? 'pointer' : 'not-allowed' }}
        >
          抓取留言
        </button>
        {!isOnWechat && (
          <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
            请在微信公众平台页面使用
          </p>
        )}
      </div>

      {status && (
        <p style={{ fontSize: 13, color: '#333', margin: 0 }}>{status}</p>
      )}

      {!token && (
        <p style={{ fontSize: 12, color: '#e44', margin: '8px 0 0' }}>
          未登录，请先在管理后台登录
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create placeholder files for webpack entry points**

Create `extension/src/background/service-worker.ts`:

```ts
// Service worker for WeCatch extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('WeCatch extension installed');
});
```

Create `extension/src/content/content.ts`:

```ts
// Placeholder - will be implemented in Task 12
console.log('WeCatch content script loaded');
```

Create `extension/src/dashboard/index.tsx`:

```tsx
// Placeholder - will be implemented in Task 13
import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <div>Dashboard placeholder</div>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

- [ ] **Step 8: Install dependencies and verify build**

```bash
cd extension && npm install && npm run build
```

Expected: Build succeeds, `dist/` folder created with popup.html, dashboard.html, content.js, service-worker.js.

- [ ] **Step 9: Commit**

```bash
git add extension/
echo "node_modules/" >> extension/.gitignore
echo "dist/" >> extension/.gitignore
git add extension/.gitignore
git commit -m "feat: set up Chrome extension with Manifest V3, popup, and webpack build"
```

---

## Task 12: Content Script (Comment Interception)

**Files:**
- Modify: `extension/src/content/content.ts`

- [ ] **Step 1: Implement content script**

Replace `extension/src/content/content.ts`:

```ts
interface CapturedComment {
  wx_comment_id: string;
  content: string;
  nickname: string;
  comment_time: string;
}

interface CapturedData {
  account: {
    wx_account_id: string;
    name: string;
  };
  article: {
    title: string;
    url: string;
    published_at: string;
  };
  comments: CapturedComment[];
}

let capturedResponses: any[] = [];

// Intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
  (this as any)._url = url.toString();
  return originalXHROpen.apply(this, [method, url, ...args] as any);
};

XMLHttpRequest.prototype.send = function (...args: any[]) {
  this.addEventListener('load', function () {
    const url = (this as any)._url || '';
    // Capture comment-related API responses from WeChat backend
    if (url.includes('/comment') || url.includes('/appmsg_comment')) {
      try {
        const data = JSON.parse(this.responseText);
        capturedResponses.push({ url, data, timestamp: Date.now() });
      } catch (e) {
        // ignore non-JSON responses
      }
    }
  });
  return originalXHRSend.apply(this, args);
};

// Intercept fetch
const originalFetch = window.fetch;
window.fetch = async function (...args: Parameters<typeof fetch>) {
  const response = await originalFetch.apply(this, args);
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;

  if (url.includes('/comment') || url.includes('/appmsg_comment')) {
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      capturedResponses.push({ url, data, timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }

  return response;
};

// Extract comment data from captured responses
function extractComments(): CapturedComment[] {
  const comments: CapturedComment[] = [];
  const seen = new Set<string>();

  for (const resp of capturedResponses) {
    const data = resp.data;
    // WeChat comment API returns comments in various structures
    // Adapt parsing based on actual API response format
    const commentList = data?.elected_comment?.elected_comment_list
      || data?.comment?.comment_list
      || data?.reply_new_list
      || [];

    for (const item of commentList) {
      const id = String(item.content_id || item.comment_id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);

      comments.push({
        wx_comment_id: id,
        content: item.content || '',
        nickname: item.nick_name || item.nickname || '',
        comment_time: item.create_time
          ? new Date(item.create_time * 1000).toISOString()
          : new Date().toISOString(),
      });
    }
  }

  return comments;
}

// Extract page context (account and article info)
function extractPageContext(): { account: CapturedData['account']; article: CapturedData['article'] } {
  // Try to extract from page DOM or URL parameters
  const title = document.querySelector('title')?.textContent || '';

  return {
    account: {
      wx_account_id: new URLSearchParams(window.location.search).get('token') || 'unknown',
      name: document.querySelector('.nickname')?.textContent || 'unknown',
    },
    article: {
      title: title,
      url: window.location.href,
      published_at: new Date().toISOString(),
    },
  };
}

// Listen for capture command from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_COMMENTS') {
    const comments = extractComments();
    if (comments.length === 0) {
      sendResponse({ success: false, error: '未找到留言数据，请先在页面上加载留言' });
      return true;
    }

    const context = extractPageContext();
    const payload: CapturedData = {
      account: context.account,
      article: context.article,
      comments,
    };

    // Get API URL and token from storage
    chrome.storage.local.get(['apiUrl', 'token'], async (result) => {
      const apiUrl = result.apiUrl || 'http://localhost:8080';
      const token = result.token || '';

      try {
        const resp = await fetch(`${apiUrl}/api/comments/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await resp.json();
        capturedResponses = []; // Clear after successful send
        sendResponse({ success: true, newComments: data.new_comments });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
    });

    return true; // Keep message channel open for async response
  }
});

console.log('WeCatch content script loaded on', window.location.hostname);
```

- [ ] **Step 2: Verify build**

```bash
cd extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add extension/src/content/content.ts
git commit -m "feat: implement content script with XHR/fetch interception for comments"
```

---

## Task 13: Dashboard - API Client and Types

**Files:**
- Create: `extension/src/dashboard/types/index.ts`
- Create: `extension/src/dashboard/api/client.ts`

- [ ] **Step 1: Create TypeScript types**

Create `extension/src/dashboard/types/index.ts`:

```ts
export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export interface Account {
  id: number;
  wx_account_id: string;
  name: string;
  created_at: string;
}

export interface Article {
  id: number;
  account_id: number;
  title: string;
  url: string;
  published_at: string;
  created_at: string;
}

export type CommentCategory =
  | 'question'
  | 'correction'
  | 'negative'
  | 'suggestion'
  | 'discussion'
  | 'cooperation'
  | 'worthless'
  | 'unclassified';

export type CommentStatus = 'pending' | 'replied' | 'ignored';

export interface Comment {
  id: number;
  article_id: number;
  wx_comment_id: string;
  content: string;
  nickname: string;
  comment_time: string;
  category: CommentCategory;
  status: CommentStatus;
  created_at: string;
}

export const CATEGORY_LABELS: Record<CommentCategory, string> = {
  question: '读者提问',
  correction: '纠错质疑',
  negative: '负面不满',
  suggestion: '建议需求',
  discussion: '深度讨论',
  cooperation: '合作意向',
  worthless: '无价值',
  unclassified: '未分类',
};

export const STATUS_LABELS: Record<CommentStatus, string> = {
  pending: '待处理',
  replied: '已回复',
  ignored: '已忽略',
};
```

- [ ] **Step 2: Create API client**

Create `extension/src/dashboard/api/client.ts`:

```ts
let baseUrl = 'http://localhost:8080';
let token = '';

// Load settings from chrome storage
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(['apiUrl', 'token'], (result) => {
    baseUrl = result.apiUrl || baseUrl;
    token = result.token || '';
  });
}

export function setToken(t: string) {
  token = t;
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ token: t });
  }
}

export function getToken(): string {
  return token;
}

export function setApiUrl(url: string) {
  baseUrl = url;
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ apiUrl: url });
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (resp.status === 401) {
    setToken('');
    throw new Error('unauthorized');
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }

  return resp.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getAccounts: () => request<import('../types').Account[]>('/api/accounts'),

  getArticles: (accountId: number) =>
    request<import('../types').Article[]>(`/api/accounts/${accountId}/articles`),

  getComments: (articleId: number, params?: { category?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return request<import('../types').Comment[]>(
      `/api/articles/${articleId}/comments${qs ? '?' + qs : ''}`
    );
  },

  updateCommentStatus: (commentId: number, status: string) =>
    request<{ status: string }>(`/api/comments/${commentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};
```

- [ ] **Step 3: Verify build**

```bash
cd extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add extension/src/dashboard/types/ extension/src/dashboard/api/
git commit -m "feat: add dashboard TypeScript types and API client"
```

---

## Task 14: Dashboard - Login Page

**Files:**
- Create: `extension/src/dashboard/pages/LoginPage.tsx`

- [ ] **Step 1: Create login page**

Create `extension/src/dashboard/pages/LoginPage.tsx`:

```tsx
import React, { useState } from 'react';
import { api, setToken } from '../api/client';

interface Props {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token } = await api.login(username, password);
      setToken(token);
      onLogin();
    } catch (err) {
      setError('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 24 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 24 }}>WeCatch</h1>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        {error && <p style={{ color: 'red', fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 10, cursor: 'pointer' }}
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add extension/src/dashboard/pages/LoginPage.tsx
git commit -m "feat: add dashboard login page"
```

---

## Task 15: Dashboard - Account and Article List Pages

**Files:**
- Create: `extension/src/dashboard/pages/AccountListPage.tsx`
- Create: `extension/src/dashboard/pages/ArticleListPage.tsx`
- Create: `extension/src/dashboard/components/Layout.tsx`

- [ ] **Step 1: Create Layout component**

Create `extension/src/dashboard/components/Layout.tsx`:

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../api/client';

interface Props {
  children: React.ReactNode;
  title: string;
  onLogout: () => void;
}

export function Layout({ children, title, onLogout }: Props) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken('');
    onLogout();
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #eee', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20, cursor: 'pointer' }} onClick={() => navigate('/')}>
            WeCatch
          </h1>
          <span style={{ color: '#666' }}>{title}</span>
        </div>
        <button onClick={handleLogout} style={{ cursor: 'pointer' }}>退出登录</button>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create account list page**

Create `extension/src/dashboard/pages/AccountListPage.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Account } from '../types';
import { Layout } from '../components/Layout';

interface Props {
  onLogout: () => void;
}

export function AccountListPage({ onLogout }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getAccounts()
      .then(setAccounts)
      .catch(() => onLogout())
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="公众号列表" onLogout={onLogout}>
      {loading ? (
        <p>加载中...</p>
      ) : accounts.length === 0 ? (
        <p style={{ color: '#999' }}>暂无公众号，请先使用插件抓取留言</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => navigate(`/accounts/${account.id}/articles`)}
              style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
            >
              <h3 style={{ margin: 0 }}>{account.name}</h3>
              <p style={{ margin: '4px 0 0', color: '#999', fontSize: 13 }}>
                ID: {account.wx_account_id}
              </p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
```

- [ ] **Step 3: Create article list page**

Create `extension/src/dashboard/pages/ArticleListPage.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Article } from '../types';
import { Layout } from '../components/Layout';

interface Props {
  onLogout: () => void;
}

export function ArticleListPage({ onLogout }: Props) {
  const { accountId } = useParams<{ accountId: string }>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!accountId) return;
    api.getArticles(Number(accountId))
      .then(setArticles)
      .catch(() => onLogout())
      .finally(() => setLoading(false));
  }, [accountId]);

  return (
    <Layout title="文章列表" onLogout={onLogout}>
      <button onClick={() => navigate('/')} style={{ marginBottom: 16, cursor: 'pointer' }}>
        ← 返回公众号列表
      </button>

      {loading ? (
        <p>加载中...</p>
      ) : articles.length === 0 ? (
        <p style={{ color: '#999' }}>暂无文章</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {articles.map((article) => (
            <div
              key={article.id}
              onClick={() => navigate(`/articles/${article.id}/comments`)}
              style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
            >
              <h3 style={{ margin: 0 }}>{article.title}</h3>
              <p style={{ margin: '4px 0 0', color: '#999', fontSize: 13 }}>
                {article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add extension/src/dashboard/components/ extension/src/dashboard/pages/AccountListPage.tsx extension/src/dashboard/pages/ArticleListPage.tsx
git commit -m "feat: add dashboard layout, account list, and article list pages"
```

---

## Task 16: Dashboard - Comment List Page with Filtering

**Files:**
- Create: `extension/src/dashboard/pages/CommentListPage.tsx`
- Create: `extension/src/dashboard/components/CommentCard.tsx`
- Create: `extension/src/dashboard/components/CategoryFilter.tsx`

- [ ] **Step 1: Create CategoryFilter component**

Create `extension/src/dashboard/components/CategoryFilter.tsx`:

```tsx
import React from 'react';
import { CommentCategory, CATEGORY_LABELS } from '../types';

const VALUABLE_CATEGORIES: CommentCategory[] = [
  'question', 'correction', 'negative', 'suggestion', 'discussion', 'cooperation',
];

interface Props {
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button
        onClick={() => onChange('')}
        style={{
          padding: '4px 12px',
          cursor: 'pointer',
          background: selected === '' ? '#1890ff' : '#fff',
          color: selected === '' ? '#fff' : '#333',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
        }}
      >
        全部有价值
      </button>
      {VALUABLE_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          style={{
            padding: '4px 12px',
            cursor: 'pointer',
            background: selected === cat ? '#1890ff' : '#fff',
            color: selected === cat ? '#fff' : '#333',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
          }}
        >
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
      <button
        onClick={() => onChange('worthless')}
        style={{
          padding: '4px 12px',
          cursor: 'pointer',
          background: selected === 'worthless' ? '#1890ff' : '#fff',
          color: selected === 'worthless' ? '#fff' : '#999',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
        }}
      >
        无价值
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create CommentCard component**

Create `extension/src/dashboard/components/CommentCard.tsx`:

```tsx
import React from 'react';
import { Comment, CATEGORY_LABELS, STATUS_LABELS, CommentStatus } from '../types';
import { api } from '../api/client';

interface Props {
  comment: Comment;
  onStatusChange: (id: number, status: CommentStatus) => void;
}

export function CommentCard({ comment, onStatusChange }: Props) {
  const handleStatusChange = async (status: CommentStatus) => {
    await api.updateCommentStatus(comment.id, status);
    onStatusChange(comment.id, status);
  };

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <strong>{comment.nickname}</strong>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
            {new Date(comment.comment_time).toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
            background: '#e6f7ff',
            color: '#1890ff',
          }}>
            {CATEGORY_LABELS[comment.category]}
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
            background: comment.status === 'pending' ? '#fff7e6' : '#f6ffed',
            color: comment.status === 'pending' ? '#fa8c16' : '#52c41a',
          }}>
            {STATUS_LABELS[comment.status]}
          </span>
        </div>
      </div>

      <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>{comment.content}</p>

      {comment.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleStatusChange('replied')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            标记已回复
          </button>
          <button
            onClick={() => handleStatusChange('ignored')}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            忽略
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create comment list page**

Create `extension/src/dashboard/pages/CommentListPage.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Comment, CommentStatus } from '../types';
import { Layout } from '../components/Layout';
import { CategoryFilter } from '../components/CategoryFilter';
import { CommentCard } from '../components/CommentCard';

interface Props {
  onLogout: () => void;
}

export function CommentListPage({ onLogout }: Props) {
  const { articleId } = useParams<{ articleId: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const navigate = useNavigate();

  const fetchComments = (category: string) => {
    if (!articleId) return;
    setLoading(true);
    const params = category ? { category } : undefined;
    api.getComments(Number(articleId), params)
      .then((data) => {
        // Default: hide worthless unless explicitly selected
        if (!category) {
          setComments(data.filter((c) => c.category !== 'worthless'));
        } else {
          setComments(data);
        }
      })
      .catch(() => onLogout())
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchComments(selectedCategory);
  }, [articleId, selectedCategory]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const handleStatusChange = (id: number, status: CommentStatus) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  };

  return (
    <Layout title="留言列表" onLogout={onLogout}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16, cursor: 'pointer' }}>
        ← 返回文章列表
      </button>

      <CategoryFilter selected={selectedCategory} onChange={handleCategoryChange} />

      {loading ? (
        <p>加载中...</p>
      ) : comments.length === 0 ? (
        <p style={{ color: '#999' }}>暂无留言</p>
      ) : (
        comments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            onStatusChange={handleStatusChange}
          />
        ))
      )}
    </Layout>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add extension/src/dashboard/pages/CommentListPage.tsx extension/src/dashboard/components/
git commit -m "feat: add comment list page with category filter and status management"
```

---

## Task 17: Dashboard - App Router and Entry Point

**Files:**
- Modify: `extension/src/dashboard/index.tsx`
- Create: `extension/src/dashboard/App.tsx`

- [ ] **Step 1: Create App with router**

Create `extension/src/dashboard/App.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { AccountListPage } from './pages/AccountListPage';
import { ArticleListPage } from './pages/ArticleListPage';
import { CommentListPage } from './pages/CommentListPage';

export function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  useEffect(() => {
    // Re-check token from storage on mount
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['token'], (result) => {
        setLoggedIn(!!result.token);
      });
    }
  }, []);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccountListPage onLogout={() => setLoggedIn(false)} />} />
        <Route path="/accounts/:accountId/articles" element={<ArticleListPage onLogout={() => setLoggedIn(false)} />} />
        <Route path="/articles/:articleId/comments" element={<CommentListPage onLogout={() => setLoggedIn(false)} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 2: Update dashboard entry point**

Replace `extension/src/dashboard/index.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

- [ ] **Step 3: Verify build**

```bash
cd extension && npm run build
```

Expected: Build succeeds, dist/ contains all files.

- [ ] **Step 4: Commit**

```bash
git add extension/src/dashboard/
git commit -m "feat: wire up dashboard app with routing (login, accounts, articles, comments)"
```

---

## Task 18: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Create .env.example for backend**

Create `backend/.env.example`:

```
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/wecatch?sslmode=disable
JWT_SECRET=change-me-in-production
QIANWEN_API_KEY=your-api-key-here
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && go test ./... -v
```

Expected: All tests PASS.

- [ ] **Step 3: Build extension**

```bash
cd extension && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Build backend binary**

```bash
cd backend && go build -o wecatch-server ./cmd/server/
```

Expected: `wecatch-server` binary created.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example
git commit -m "feat: add env example and verify full build"
```

- [ ] **Step 6: Update README.md**

Update `README.md`:

```markdown
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

### 插件

1. 安装依赖：`cd extension && npm install`
2. 构建：`npm run build`
3. 在 Chrome 中加载 `extension/dist/` 目录为解压的扩展程序
```

- [ ] **Step 7: Final commit**

```bash
git add README.md
git commit -m "docs: update README with project structure and quickstart"
```
