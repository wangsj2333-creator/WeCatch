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
