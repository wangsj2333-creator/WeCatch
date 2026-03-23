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
