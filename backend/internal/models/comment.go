package models

import "time"

type Comment struct {
	ID            int64     `json:"id" gorm:"primaryKey"`
	ArticleID     int64     `json:"article_id" gorm:"index;not null"`
	WxCommentID   string    `json:"wx_comment_id" gorm:"uniqueIndex;not null"`
	ReplyToWxID      string    `json:"reply_to_wx_id" gorm:"default:''"`
	ReplyToNickname  string    `json:"reply_to_nickname" gorm:"default:''"`
	Content       string    `json:"content" gorm:"type:text;not null"`
	Nickname      string    `json:"nickname"`
	CommentTime   time.Time `json:"comment_time"`
	Category      string    `json:"category" gorm:"default:unclassified"`
	Status        string    `json:"status" gorm:"default:pending"`
	CreatedAt     time.Time `json:"created_at"`
}

const (
	CategoryQuestion     = "question"
	CategoryCorrection   = "correction"
	CategoryNegative     = "negative"
	CategorySuggestion   = "suggestion"
	CategoryDiscussion   = "discussion"
	CategoryCooperation  = "cooperation"
	CategoryWorthless    = "worthless"
	CategoryUnclassified = "unclassified"
)

const (
	StatusPending = "pending"
	StatusReplied = "replied"
	StatusIgnored = "ignored"
)
