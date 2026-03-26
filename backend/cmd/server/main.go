package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/config"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/database"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/router"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	if err := database.SeedAdmin(db); err != nil {
		log.Fatalf("failed to seed admin user: %v", err)
	}

	var classifier *services.Classifier
	if cfg.QianwenKey != "" {
		classifier = services.NewClassifier(cfg.QianwenKey)
		log.Println("Qianwen classifier initialized")
	} else {
		log.Println("WARNING: QIANWEN_API_KEY not set, classification disabled")
	}

	handler := router.New(db, cfg.JWTSecret, classifier)

	log.Printf("WeCatch server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", cfg.Port), handler); err != nil {
		log.Fatal(err)
	}
}
