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
