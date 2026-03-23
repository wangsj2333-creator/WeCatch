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
