package main

import (
	"log"
	"os"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/database"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/wecatch?sslmode=disable"
	}

	db, err := database.Connect(dbURL)
	if err != nil {
		log.Fatal("failed to connect to database:", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatal("failed to migrate:", err)
	}

	var count int64
	db.Model(&models.User{}).Where("username = ?", "admin").Count(&count)
	if count > 0 {
		log.Println("admin user already exists, skipping")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("failed to hash password:", err)
	}

	user := models.User{
		Username: "admin",
		Password: string(hash),
		Role:     "admin",
	}
	if err := db.Create(&user).Error; err != nil {
		log.Fatal("failed to create admin user:", err)
	}

	log.Println("admin user created: username=admin password=admin123")
}
