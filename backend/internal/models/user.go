package models

import "time"

type User struct {
	ID        int64     `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex;not null"`
	Password  string    `json:"-" gorm:"not null"`
	Role      string    `json:"role" gorm:"not null;default:user"`
	CreatedAt time.Time `json:"created_at"`
}
