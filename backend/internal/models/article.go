package models

import "time"

type Article struct {
	ID          int64     `json:"id" gorm:"primaryKey"`
	AccountID   int64     `json:"account_id" gorm:"index;not null"`
	Title       string    `json:"title" gorm:"not null"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at"`
}
