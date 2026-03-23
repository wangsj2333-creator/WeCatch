package database

import (
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Account{},
		&models.UserAccount{},
		&models.Article{},
		&models.Comment{},
	)
}
