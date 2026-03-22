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
