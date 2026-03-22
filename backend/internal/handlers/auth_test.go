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
