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
