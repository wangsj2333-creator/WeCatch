package database

import (
	"log"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/gorm"
)

// SeedAdmin creates the default admin user if none exists.
func SeedAdmin(db *gorm.DB) error {
	var count int64
	db.Model(&models.User{}).Where("role = ?", "admin").Count(&count)
	if count > 0 {
		return nil
	}

	hash, err := services.HashPassword("admin123")
	if err != nil {
		return err
	}

	admin := models.User{
		Username: "admin",
		Password: hash,
		Role:     "admin",
	}
	if err := db.Create(&admin).Error; err != nil {
		return err
	}

	log.Println("Default admin user created (username: admin, password: admin123) — change the password after first login")
	return nil
}
