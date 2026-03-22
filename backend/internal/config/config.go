package config

import (
	"log"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	QianwenKey  string
}

func Load() *Config {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if os.Getenv("APP_ENV") == "development" {
			jwtSecret = "dev-secret-change-in-production"
			log.Println("WARNING: using default JWT secret, set JWT_SECRET in production")
		} else {
			log.Fatal("JWT_SECRET environment variable is required")
		}
	}

	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/wecatch?sslmode=disable"),
		JWTSecret:   jwtSecret,
		QianwenKey:  os.Getenv("QIANWEN_API_KEY"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
