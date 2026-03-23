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
	Account  batchAccount   `json:"account"`
	Article  batchArticle   `json:"article"`
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
	ReplyToWxID string    `json:"reply_to_wx_id"`
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
			ReplyToWxID: c.ReplyToWxID,
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

	// Update account's last captured time
	now := time.Now()
	h.DB.Model(&account).Update("last_captured_at", now)

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
