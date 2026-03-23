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
