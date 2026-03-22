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
